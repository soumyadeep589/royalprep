import { readFile } from 'node:fs/promises'
import { test, type TestContext } from 'node:test'
import assert from 'node:assert/strict'
import { createHmac, randomUUID } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import request from 'supertest'
import { newDb } from 'pg-mem'
import { createApp } from './app.js'
import { migrateLegacyReports, migrateLegacySets } from './services/legacyMigration.js'
import { consoleVerificationEmail } from './services/verificationEmail.js'

const question = { chapter: 'Anatomy', published: true, stem: 'Pick the right answer', options: ['A', 'B', 'C', 'D'], correct: 1, explanation: 'B is correct.', source: 'Original' }
const adminEmail = 'admin@example.com'
const verificationEmail = { generateCode: () => '123456', sendCode: async () => {} }

type ApiConfig = Omit<Parameters<typeof createApp>[0], 'postgres'>

async function createTestApi(t: TestContext, config: ApiConfig) {
  const db = newDb()
  db.public.registerFunction({ name: 'jsonb_typeof', args: ['jsonb'], returns: 'text', implementation: value => Array.isArray(value) ? 'array' : typeof value })
  db.public.registerFunction({ name: 'jsonb_array_length', args: ['jsonb'], returns: 'integer', implementation: value => value.length })
  for (const migration of ['001_questions.sql', '002_hero.sql', '003_study_plans.sql', '004_custom_attempts.sql', '005_flashcards.sql', '006_student_accounts.sql', '007_chapters.sql', '008_student_soft_deletion.sql', '009_chapter_publications.sql', '010_practice_answers.sql']) {
    db.public.none(await readFile(new URL(`../migrations/${migration}`, import.meta.url), 'utf8'))
  }
  const { Pool } = db.adapters.createPg()
  const pool = new Pool()
  t.after(async () => { await pool.end() })
  const makeApi = (overrides: Partial<ApiConfig> = {}) => request(createApp({ verificationEmail, ...config, ...overrides, postgres: pool }))
  return { api: makeApi(), makeApi, pool }
}

async function loginAdmin(api: ReturnType<typeof request>) {
  const otp = await api.post('/api/admin/otp/request').send({ password: 'test-password-long' })
  return api.post('/api/admin/login').send({ challenge: otp.body.challenge, code: '123456' })
}

async function signInStudent(api: ReturnType<typeof request>, email = 'student@example.com') {
  const requested = await api.post('/api/auth/otp/request').send({ email })
  assert.equal(requested.status, 200)
  const verified = await api.post('/api/auth/otp/verify').send({ email, code: '123456' })
  assert.equal(verified.status, 200)
  return { Authorization: 'Bearer ' + verified.body.token }
}

test('health checks PostgreSQL and identifies it as the application database', async t => {
  const { api } = await createTestApi(t, { adminPassword: 'test-password-long', secret: 'secret'.repeat(10) })
  assert.deepEqual((await api.get('/api/health')).body, { ok: true, storage: 'postgresql' })
})

test('chapter publication migration records only the known live revision', async () => {
  const db = newDb()
  for (const migration of ['006_student_accounts.sql', '007_chapters.sql']) {
    db.public.none(await readFile(new URL(`../migrations/${migration}`, import.meta.url), 'utf8'))
  }
  db.public.none("INSERT INTO chapter_documents (id, current_revision, draft_revision, published_revision) VALUES ('chapter', 2, 2, 1)")
  db.public.none(`INSERT INTO chapter_revisions (chapter_id, revision, content) VALUES ('chapter', 1, '{}'), ('chapter', 2, '{}')`)
  db.public.none(await readFile(new URL('../migrations/009_chapter_publications.sql', import.meta.url), 'utf8'))
  const rows = db.public.many('SELECT revision, published_at FROM chapter_publications')
  assert.equal(rows.length, 1)
  assert.equal(rows[0].revision, 1)
  assert.equal(rows[0].published_at, null)
})

test('soft deletion retains records and denies all sessions and subsequent sign-in', async t => {
  const { api, makeApi, pool } = await createTestApi(t, { adminPassword: 'test-password-long', secret: 'secret'.repeat(10), dummyOtpEnabled: true })
  const student = await signInStudent(api)
  const anotherProcess = makeApi()
  const otherSession = await signInStudent(anotherProcess)
  const other = await signInStudent(api, 'other@example.com')
  await anotherProcess.post('/api/auth/otp/request').send({ email: 'student@example.com' })
  const card = await api.post('/api/student/flashcards').set(student).send({ chapter: 'Anatomy', front: 'Question', back: 'Answer' })
  assert.equal(card.status, 201)
  assert.equal((await api.post('/api/auth/delete').send({ confirmation: 'DELETE' })).status, 401)
  assert.equal((await api.post('/api/auth/delete').set(student).send({ confirmation: 'delete' })).status, 422)
  assert.equal((await api.post('/api/auth/delete').set(student).send({ confirmation: 'DELETE' })).status, 200)
  assert.equal((await api.get('/api/auth/session').set(student)).status, 401)
  assert.equal((await anotherProcess.get('/api/auth/session').set(otherSession)).status, 401)
  assert.equal((await anotherProcess.post('/api/auth/otp/verify').send({ email: 'student@example.com', code: '123456' })).status, 403)
  assert.equal((await api.get('/api/student/flashcards').set(other)).status, 200)
  assert.equal((await pool.query('SELECT * FROM student_flashcards WHERE owner_email = $1', ['student@example.com'])).rows.length, 1)
  assert.notEqual((await pool.query('SELECT deleted_at FROM student_accounts WHERE email = $1', ['student@example.com'])).rows[0].deleted_at, null)
  await api.post('/api/auth/otp/request').send({ email: 'student@example.com' })
  assert.equal((await api.post('/api/auth/otp/verify').send({ email: 'student@example.com', code: '123456' })).status, 403)
})

test('chapter drafts stay private and reading progress is owned and versioned', async t => {
  const { api, makeApi } = await createTestApi(t, { adminPassword: 'test-password-long', secret: 'secret'.repeat(10), adminEmail, dummyOtpEnabled: true, chapterNotesEnabled: true })
  const admin = { Authorization: 'Bearer ' + (await loginAdmin(api)).body.token }
  const student = await signInStudent(api)
  const disabled = makeApi({ chapterNotesEnabled: false })
  const disabledStudent = await signInStudent(disabled, 'disabled@example.com')
  assert.equal((await disabled.get('/api/student/chapters').set(disabledStudent)).status, 503)
  const other = await signInStudent(api, 'other@example.com')
  const sectionId = randomUUID()
  const content = { title: 'Anatomy', practiceChapter: 'Anatomy', sections: [{ id: sectionId, title: 'Introduction', body: 'Approved content.' }] }
  assert.equal((await api.post('/api/admin/chapters').send(content)).status, 401)
  assert.equal((await api.post('/api/admin/chapters').set(admin).send({ ...content, sections: [content.sections[0], content.sections[0]] })).status, 422)
  const created = await api.post('/api/admin/chapters').set(admin).send(content)
  assert.equal(created.status, 201)
  const id = created.body.id as string
  assert.deepEqual((await api.get('/api/student/chapters').set(student)).body, [])
  assert.equal((await api.get(`/api/student/chapters/${id}`).set(student)).status, 404)
  assert.equal((await api.post(`/api/admin/chapters/${id}/publish`).set(admin).send({ expectedRevision: 1 })).status, 200)
  assert.equal((await api.get('/api/student/chapters')).status, 401)
  assert.equal((await api.get('/api/student/chapters').set(student)).body[0].title, 'Anatomy')
  const progress = { expectedVersion: 0, revision: 1, sectionId }
  assert.equal((await api.put(`/api/student/chapters/${id}/progress`).set(student).send(progress)).body.version, 1)
  assert.ok((await api.get('/api/student/chapters').set(student)).body[0].lastReadAt)
  assert.equal((await api.get('/api/student/chapters').set(other)).body[0].lastReadAt, null)
  assert.equal((await api.put(`/api/student/chapters/${id}/progress`).set(student).send(progress)).status, 409)
  assert.equal((await api.get(`/api/student/chapters/${id}`).set(other)).body.progress, null)
  assert.equal((await api.put(`/api/student/chapters/${id}/progress`).set(other).send({ ...progress, sectionId: randomUUID() })).status, 404)
  const updated = { ...content, title: 'Revised anatomy' }
  assert.equal((await api.put(`/api/admin/chapters/${id}/draft`).set(admin).send({ expectedRevision: 1, content: updated })).body.revision, 2)
  assert.equal((await api.put(`/api/admin/chapters/${id}/draft`).set(admin).send({ expectedRevision: 1, content })).status, 409)
  assert.equal((await api.get(`/api/student/chapters/${id}`).set(student)).body.content.title, 'Anatomy')
  assert.equal((await api.post(`/api/admin/chapters/${id}/publish`).set(admin).send({ expectedRevision: 2 })).status, 200)
  assert.equal((await api.put(`/api/student/chapters/${id}/progress`).set(student).send({ ...progress, expectedVersion: 1 })).status, 409)
  assert.equal((await api.put(`/api/student/chapters/${id}/progress`).set(student).send({ ...progress, expectedVersion: 1, revision: 2 })).body.version, 2)
  assert.equal((await api.put(`/api/admin/chapters/${id}/draft`).set(admin).send({ expectedRevision: 2, content: { ...content, title: 'Unpublished draft' } })).body.revision, 3)
  const restorePath = `/api/admin/chapters/${id}/restore`
  assert.equal((await api.post(restorePath).send({ expectedRevision: 3, sourceRevision: 1 })).status, 401)
  assert.equal((await api.post(restorePath).set(admin).send({ expectedRevision: 3, sourceRevision: 3 })).status, 404)
  assert.equal((await api.post(restorePath).set(admin).send({ expectedRevision: 2, sourceRevision: 1 })).status, 409)
  assert.equal((await api.post(restorePath).set(admin).send({ expectedRevision: 3, sourceRevision: 1 })).body.revision, 4)
  assert.equal((await api.get(`/api/student/chapters/${id}`).set(student)).body.content.title, 'Anatomy')
  const history = (await api.get(`/api/admin/chapters/${id}`).set(admin)).body.history
  assert.deepEqual(history.map((entry: { revision: number }) => entry.revision), [4, 2, 1])
  assert.equal(history[0].sourceRevision, 1)
})

test('custom mocks freeze questions, protect ownership, score once and enforce deadlines', async t => {
  const { api } = await createTestApi(t, { adminPassword: 'test-password-long', secret: 'secret'.repeat(10), adminEmail, dummyOtpEnabled: true })
  const admin = { Authorization: 'Bearer ' + (await loginAdmin(api)).body.token }
  const student = await signInStudent(api)
  const other = await signInStudent(api, 'other@example.com')
  const created = (await api.post('/api/admin/questions').set(admin).send(question)).body
  await api.post('/api/admin/questions').set(admin).send({ ...question, chapter: 'Other', stem: 'Another question' })
  const input = { requestId: randomUUID(), chapters: ['Anatomy'], count: 1, durationMinutes: 5 }
  assert.equal((await api.post('/api/student/attempts').send(input)).status, 401)
  assert.equal((await api.post('/api/student/attempts').set(student).send({ ...input, count: 2 })).status, 422)
  const start = await api.post('/api/student/attempts').set(student).send(input)
  assert.equal(start.status, 201)
  assert.equal(start.body.questions[0].correct, undefined)
  assert.equal(start.body.questions[0].explanation, undefined)
  assert.equal((await api.post('/api/student/attempts').set(student).send(input)).body.id, start.body.id)
  assert.equal((await api.post('/api/student/attempts').set(student).send({ ...input, durationMinutes: 6 })).status, 409)
  const path = `/api/student/attempts/${start.body.id}`
  assert.equal((await api.get(path).set(other)).status, 404)
  const answerPath = `${path}/answers/${created.id}`
  assert.equal((await api.put(answerPath).set(other).send({ expectedVersion: 1, option: 1 })).status, 404)
  const answered = await api.put(answerPath).set(student).send({ expectedVersion: 1, option: 1 })
  assert.equal(answered.body.version, 2)
  assert.equal((await api.put(answerPath).set(student).send({ expectedVersion: 1, option: 0 })).status, 409)
  const flagged = await api.put(`${path}/flags/${created.id}`).set(student).send({ expectedVersion: 2, flagged: true })
  assert.deepEqual(flagged.body.flags, [created.id])
  await api.put(`/api/admin/questions/${created.id}`).set(admin).send({ ...created, correct: 0, explanation: 'Changed later.' })
  const submitted = await api.post(`${path}/submit`).set(student).send({ expectedVersion: 3 })
  assert.equal(submitted.body.score, 1)
  assert.equal(submitted.body.questions[0].explanation, 'B is correct.')
  assert.deepEqual((await api.post(`${path}/submit`).set(student).send({ expectedVersion: 3 })).body.score, 1)
  assert.equal((await api.put(answerPath).set(student).send({ expectedVersion: 4, option: 0 })).status, 409)
  const expiring = await api.post('/api/student/attempts').set(student).send({ ...input, requestId: randomUUID(), durationMinutes: 1 })
  const realNow = Date.now
  Date.now = () => realNow() + 61_000
  try {
    assert.equal((await api.put(`/api/student/attempts/${expiring.body.id}/answers/${created.id}`).set(student).send({ expectedVersion: 1, option: 1 })).status, 409)
    const expired = await api.get(`/api/student/attempts/${expiring.body.id}`).set(student)
    assert.equal(expired.body.status, 'submitted')
    assert.equal(expired.body.score, 0)
  } finally { Date.now = realNow }
})

test('mistakes show owned incorrect mock answers and clear when answered correctly later', async t => {
  const { api } = await createTestApi(t, { adminPassword: 'test-password-long', secret: 'secret'.repeat(10), adminEmail, dummyOtpEnabled: true })
  const admin = { Authorization: 'Bearer ' + (await loginAdmin(api)).body.token }
  const student = await signInStudent(api)
  const other = await signInStudent(api, 'other@example.com')
  const created = (await api.post('/api/admin/questions').set(admin).send(question)).body
  const take = async (option: number) => {
    const started = (await api.post('/api/student/attempts').set(student).send({ requestId: randomUUID(), chapters: ['Anatomy'], count: 1, durationMinutes: 5 })).body
    await api.put(`/api/student/attempts/${started.id}/answers/${created.id}`).set(student).send({ expectedVersion: 1, option })
    await api.post(`/api/student/attempts/${started.id}/submit`).set(student).send({ expectedVersion: 2 })
  }
  await take(0)
  assert.equal((await api.get('/api/student/mistakes').set(student)).body[0].questionId, created.id)
  assert.equal((await api.get('/api/student/mistakes').set(other)).body.length, 0)
  await take(1)
  assert.equal((await api.get('/api/student/mistakes').set(student)).body.length, 0)
})

test('practice answers persist per student and update mistakes without accepting stale questions', async t => {
  const { api, makeApi } = await createTestApi(t, { adminPassword: 'test-password-long', secret: 'secret'.repeat(10), adminEmail, dummyOtpEnabled: true })
  const admin = { Authorization: 'Bearer ' + (await loginAdmin(api)).body.token }
  const student = await signInStudent(api)
  const other = await signInStudent(api, 'other@example.com')
  const created = (await api.post('/api/admin/questions').set(admin).send(question)).body
  const path = `/api/practice/questions/${created.id}/answer`
  assert.equal((await api.get('/api/practice/answers')).status, 401)
  assert.deepEqual((await api.get('/api/practice/answers').set(other)).body, [])
  assert.equal((await api.post(path).set(student).send({ version: 1, option: 0 })).body.isCorrect, false)
  const answer = (await api.get('/api/practice/answers').set(student)).body[0]
  assert.equal(answer.questionId, created.id)
  assert.equal(answer.questionVersion, 1)
  assert.equal(answer.selected, 0)
  assert.equal(answer.isCorrect, false)
  assert.equal((await api.get('/api/student/mistakes').set(student)).body[0].attemptId, null)
  assert.deepEqual((await api.get('/api/student/mistakes').set(other)).body, [])
  const restarted = makeApi()
  const newSession = await signInStudent(restarted)
  assert.equal((await restarted.get('/api/practice/answers').set(newSession)).body[0].selected, 0)
  assert.equal((await api.post(path).set(student).send({ version: 1, option: 1 })).body.isCorrect, true)
  assert.deepEqual((await api.get('/api/student/mistakes').set(student)).body, [])
  await api.put(`/api/admin/questions/${created.id}`).set(admin).send({ ...created, explanation: 'Revised explanation.' })
  assert.equal((await api.post(path).set(student).send({ version: 1, option: 0 })).status, 409)
  assert.equal((await api.get('/api/practice/answers').set(student)).body[0].questionVersion, 1)
  assert.equal((await api.post(path).set(student).send({ version: 2, option: 0 })).body.isCorrect, false)
  assert.equal((await api.get('/api/practice/answers').set(student)).body[0].explanation, 'Revised explanation.')
})

test('mistakes merge practice and mock answers in time order', async t => {
  const { api } = await createTestApi(t, { adminPassword: 'test-password-long', secret: 'secret'.repeat(10), adminEmail, dummyOtpEnabled: true })
  const admin = { Authorization: 'Bearer ' + (await loginAdmin(api)).body.token }
  const student = await signInStudent(api)
  const created = (await api.post('/api/admin/questions').set(admin).send(question)).body
  const realNow = Date.now
  let now = realNow()
  Date.now = () => now
  try {
    const takeIncorrectMock = async () => {
      const start = (await api.post('/api/student/attempts').set(student).send({ requestId: randomUUID(), chapters: ['Anatomy'], count: 1, durationMinutes: 5 })).body
      await api.put(`/api/student/attempts/${start.id}/answers/${created.id}`).set(student).send({ expectedVersion: 1, option: 0 })
      assert.equal((await api.post(`/api/student/attempts/${start.id}/submit`).set(student).send({ expectedVersion: 2 })).status, 200)
    }
    await takeIncorrectMock()
    now += 1000
    await api.post(`/api/practice/questions/${created.id}/answer`).set(student).send({ version: 1, option: 1 })
    assert.deepEqual((await api.get('/api/student/mistakes').set(student)).body, [])
    now += 1000
    await takeIncorrectMock()
    assert.equal((await api.get('/api/student/mistakes').set(student)).body.length, 1)
    await api.post(`/api/practice/questions/${created.id}/answer`).set(student).send({ version: 1, option: 1 })
    assert.equal((await api.get('/api/student/mistakes').set(student)).body.length, 1)
    now += 1000
    await api.post(`/api/practice/questions/${created.id}/answer`).set(student).send({ version: 1, option: 1 })
    assert.deepEqual((await api.get('/api/student/mistakes').set(student)).body, [])
  } finally { Date.now = realNow }
})

test('personal flashcard reviews are owned, versioned and idempotent', async t => {
  const { api } = await createTestApi(t, { adminPassword: 'test-password-long', secret: 'secret'.repeat(10), dummyOtpEnabled: true })
  const student = await signInStudent(api)
  const other = await signInStudent(api, 'other@example.com')
  assert.equal((await api.get('/api/student/flashcards')).status, 401)
  const created = await api.post('/api/student/flashcards').set(student).send({ chapter: 'Anatomy', front: 'Question', back: 'Answer' })
  assert.equal(created.status, 201)
  assert.deepEqual((await api.get('/api/student/flashcards').set(other)).body.cards, [])
  const path = `/api/student/flashcards/${created.body.id}`
  const eventId = randomUUID()
  const reviewed = await api.post(path + '/review').set(student).send({ eventId, expectedVersion: 1, rating: 'good' })
  assert.equal(reviewed.body.version, 2)
  assert.equal(reviewed.body.intervalDays, 3)
  assert.equal((await api.post(path + '/review').set(student).send({ eventId, expectedVersion: 1, rating: 'good' })).body.version, 2)
  assert.equal((await api.post(path + '/review').set(student).send({ eventId, expectedVersion: 1, rating: 'easy' })).status, 409)
  assert.equal((await api.post(path + '/review').set(student).send({ eventId: randomUUID(), expectedVersion: 1, rating: 'again' })).status, 409)
  assert.equal((await api.post(path + '/review').set(other).send({ eventId: randomUUID(), expectedVersion: 1, rating: 'good' })).status, 404)
  assert.equal((await api.delete(path).set(student).send({ expectedVersion: 1 })).status, 409)
  assert.equal((await api.delete(path).set(student).send({ expectedVersion: 2 })).status, 200)
  assert.equal((await api.get('/api/student/flashcards').set(student)).body.cards.length, 0)
})

test('study plans enforce ownership, validation and optimistic edits', async t => {
  const { api } = await createTestApi(t, { adminPassword: 'test-password-long', secret: 'secret'.repeat(10), dummyOtpEnabled: true })
  const student = await signInStudent(api)
  const other = await signInStudent(api, 'other@example.com')
  const plan = { targetDate: '2027-06-01', daysPerWeek: 4, hoursPerWeek: 10, tasks: [{ id: '550e8400-e29b-41d4-a716-446655440000', chapter: 'Anatomy', title: 'Review anatomy', dueDate: '2027-05-01', done: false }] }
  assert.equal((await api.get('/api/student/study-plan')).status, 401)
  assert.deepEqual((await api.get('/api/student/study-plan').set(student)).body, { version: 0, plan: null })
  assert.equal((await api.put('/api/student/study-plan').set(student).send({ expectedVersion: 0, plan: { ...plan, targetDate: '2027-02-31' } })).status, 422)
  assert.equal((await api.put('/api/student/study-plan').set(student).send({ expectedVersion: 0, plan })).body.version, 1)
  assert.deepEqual((await api.get('/api/student/study-plan').set(other)).body, { version: 0, plan: null })
  assert.equal((await api.put('/api/student/study-plan').set(student).send({ expectedVersion: 0, plan })).status, 409)
  const updated = { ...plan, tasks: [{ ...plan.tasks[0], done: true }] }
  assert.equal((await api.put('/api/student/study-plan').set(student).send({ expectedVersion: 1, plan: updated })).body.version, 2)
  assert.equal((await api.get('/api/student/study-plan').set(student)).body.plan.tasks[0].done, true)
  const chosenDays = { ...updated, studyDays: [1, 2, 3, 4] }
  assert.equal((await api.put('/api/student/study-plan').set(student).send({ expectedVersion: 2, plan: { ...chosenDays, studyDays: [1, 1, 3, 4] } })).status, 422)
  assert.equal((await api.put('/api/student/study-plan').set(student).send({ expectedVersion: 2, plan: { ...chosenDays, studyDays: [1, 2] } })).status, 422)
  assert.equal((await api.put('/api/student/study-plan').set(student).send({ expectedVersion: 2, plan: chosenDays })).status, 200)
  assert.deepEqual((await api.get('/api/student/study-plan').set(student)).body.plan.studyDays, [1, 2, 3, 4])
})

test('standalone questions support editing, practice, reports and version conflicts', async t => {
  const { api } = await createTestApi(t, { adminPassword: 'test-password-long', secret: 'secret'.repeat(10), adminEmail, dummyOtpEnabled: true })
  const student = await signInStudent(api)
  assert.equal((await api.post('/api/admin/questions').send(question)).status, 401)
  const login = await loginAdmin(api)
  const auth = { Authorization: 'Bearer ' + login.body.token }
  const created = await api.post('/api/admin/questions').set(auth).send(question)
  assert.equal(created.status, 201)
  await api.post('/api/admin/questions').set(auth).send({ ...question, stem: 'A draft question', published: false })
  const list = await api.get('/api/practice/questions').set(student)
  assert.equal(list.body.length, 1)
  assert.deepEqual((await api.get('/api/public/catalog-summary')).body, { questionCount: 1, chapterCount: 1 })
  assert.deepEqual((await api.get('/api/public/chapters')).body, [{ name: 'Anatomy', questionCount: 1 }])
  assert.equal((await api.get('/api/practice/questions').set(student).query({ chapter: 'Other' })).body.length, 0)
  assert.equal((await api.get('/api/practice/questions').set(student).query({ chapter: 'Anatomy' })).body.length, 1)
  assert.equal((await api.get('/api/practice/questions').set(student).query({ chapter: '' })).status, 422)
  assert.equal(list.body[0].id, created.body.id)
  assert.equal(list.body[0].correct, undefined)
  assert.equal(list.body[0].explanation, undefined)
  const path = '/api/practice/questions/' + created.body.id
  assert.equal((await api.post(path + '/answer').set(student).send({ version: 2, option: 1 })).status, 409)
  assert.deepEqual((await api.post(path + '/answer').set(student).send({ version: 1, option: 0 })).body, { correct: 1, explanation: 'B is correct.', isCorrect: false })
  assert.equal((await api.post(path + '/reports').set(student).send({ version: 1, message: 'Please review' })).status, 201)
  assert.equal((await api.get('/api/admin/question-reports')).status, 401)
  const reports = await api.get('/api/admin/question-reports').set(auth)
  assert.equal(reports.body[0].questionId, created.body.id)
  assert.equal(reports.body[0].questionVersion, 1)
  assert.equal(reports.body[0].questionStem, question.stem)
  const updated = await api.put('/api/admin/questions/' + created.body.id).set(auth).send({ ...created.body, stem: 'Updated question', published: false })
  assert.equal(updated.status, 200)
  assert.equal(updated.body.version, 2)
  assert.equal((await api.put('/api/admin/questions/' + created.body.id).set(auth).send(created.body)).status, 409)
  assert.equal((await api.post(path + '/answer').set(student).send({ version: 2, option: 1 })).status, 404)
  assert.equal((await api.get('/api/practice/questions').set(student)).body.length, 0)
  assert.equal((await api.get('/api/sets')).status, 404)
  assert.equal((await api.get('/api/admin/sets').set(auth)).status, 404)
})

test('CSV import accepts individual questions and rejects invalid rows before writing', async t => {
  const { api } = await createTestApi(t, { adminPassword: 'test-password-long', secret: 'secret'.repeat(10), adminEmail, dummyOtpEnabled: true })
  const login = await loginAdmin(api)
  const auth = { Authorization: 'Bearer ' + login.body.token }
  const header = 'chapter,published,stem,option_a,option_b,option_c,option_d,correct,explanation,source'
  const row = 'Anatomy,true,"A question, with a comma",A,B,C,D,B,Explanation,Book'
  const invalid = 'Anatomy,true,Invalid question,A,A,C,D,B,Explanation,Book'
  assert.equal((await api.post('/api/admin/questions/import').send({ csv: [header, row].join('\n') })).status, 401)
  assert.equal((await api.post('/api/admin/questions/import').set(auth).send({ csv: [header, row, invalid].join('\n') })).status, 422)
  assert.equal((await api.get('/api/admin/questions').set(auth)).body.length, 0)
  const imported = await api.post('/api/admin/questions/import').set(auth).send({ csv: [header, row].join('\n') })
  assert.equal(imported.status, 201)
  assert.equal(imported.body.count, 1)
  const all = await api.get('/api/admin/questions').set(auth)
  assert.equal(all.body[0].stem, 'A question, with a comma')
  assert.equal(all.body[0].correct, 1)
  assert.equal(all.body[0].source, 'Book')
})

test('public chapter catalog and filtered practice include only published questions', async t => {
  const { api } = await createTestApi(t, { adminPassword: 'test-password-long', secret: 'secret'.repeat(10), adminEmail, dummyOtpEnabled: true })
  const student = await signInStudent(api)
  const login = await loginAdmin(api)
  const auth = { Authorization: 'Bearer ' + login.body.token }
  await api.post('/api/admin/questions').set(auth).send(question)
  await api.post('/api/admin/questions').set(auth).send({ ...question, chapter: 'Surgery & care', stem: 'Another question' })
  await api.post('/api/admin/questions').set(auth).send({ ...question, chapter: 'Draft only', published: false })
  assert.deepEqual((await api.get('/api/public/chapters')).body, [
    { name: 'Anatomy', questionCount: 1 }, { name: 'Surgery & care', questionCount: 1 },
  ])
  const filtered = await api.get('/api/practice/questions').set(student).query({ chapter: 'Surgery & care' })
  assert.equal(filtered.body.length, 1)
  assert.equal(filtered.body[0].stem, 'Another question')
  assert.equal(filtered.body[0].correct, undefined)
  assert.equal((await api.get('/api/practice/questions').set(student).query({ chapter: 'Draft only' })).body.length, 0)
})

test('legacy questions and reports retain stable identity and report context', () => {
  const [migrated] = migrateLegacySets([{ id: 'legacy-id', title: 'MRCS Mock 1: Applied Anatomy', version: 3, published: true, questions: [question] }])
  assert.equal(migrated.id, 'legacy-id-0')
  assert.equal(migrated.chapter, 'Applied Anatomy')
  assert.equal(migrated.version, 3)
  assert.equal(migrated.correct, question.correct)
  const [report] = migrateLegacyReports([{ id: 'report-id', setId: 'legacy-id', questionIndex: 0, setVersion: 2, questionStem: 'Original stem', message: 'Review', createdAt: 123 }], new Set([migrated.id]))
  assert.equal(report.questionId, migrated.id)
  assert.equal(report.questionVersion, 2)
  assert.equal(report.questionStem, 'Original stem')
  assert.throws(() => migrateLegacyReports([{ id: 'report-id', setId: 'missing', questionIndex: 0, setVersion: 1, questionStem: 'Original', message: 'Review', createdAt: 123 }], new Set()))
})

test('student OTP verifies only the issued code and is single-use', async t => {
  const { api, pool } = await createTestApi(t, { adminPassword: 'test-password-long', secret: 'secret'.repeat(10), adminEmail, dummyOtpEnabled: true })
  assert.equal((await api.post('/api/auth/otp/verify').send({ email: 'student@example.com', code: '000000' })).status, 401)
  const requested = await api.post('/api/auth/otp/request').send({ email: ' Student@Example.com ' })
  assert.equal(requested.status, 200)
  assert.equal(requested.body.demoOtp, undefined)
  assert.equal(requested.headers['cache-control'], 'no-store')

  assert.equal((await api.post('/api/auth/otp/verify').send({ email: 'other@example.com', code: '000000' })).status, 401)
  assert.equal((await api.post('/api/auth/otp/verify').send({ email: 'student@example.com', code: '12345a' })).status, 422)
  assert.equal((await api.post('/api/auth/otp/verify').send({ email: 'student@example.com', code: '000000' })).status, 401)
  const verified = await api.post('/api/auth/otp/verify').send({ email: 'student@example.com', code: '123456' })
  assert.equal(verified.status, 200)
  assert.deepEqual(verified.body.user, { email: 'student@example.com' })
  await api.post('/api/auth/otp/request').send({ email: 'STUDENT@example.com' })
  const returning = await api.post('/api/auth/otp/verify').send({ email: 'student@example.com', code: '123456' })
  assert.equal(returning.status, 200)
  assert.equal((await pool.query('SELECT count(*)::int AS count FROM student_accounts')).rows[0].count, 1)

  const studentAuth = { Authorization: 'Bearer ' + verified.body.token }
  assert.equal((await api.get('/api/auth/session').set(studentAuth)).body.user.email, 'student@example.com')
  assert.equal((await api.get('/api/admin/questions').set(studentAuth)).status, 401)
  assert.equal((await api.post('/api/auth/otp/verify').send({ email: 'student@example.com', code: '123456' })).status, 401)

  const adminLogin = await loginAdmin(api)
  assert.equal((await api.get('/api/auth/session').set({ Authorization: 'Bearer ' + adminLogin.body.token })).status, 401)
  assert.equal((await api.get('/api/practice/questions')).status, 401)
  assert.equal((await api.get('/api/practice/questions').set(studentAuth)).headers['cache-control'], 'no-store')
  assert.equal((await api.post('/api/practice/questions/example/answer').send({ version: 1, option: 0 })).status, 401)
  assert.equal((await api.post('/api/practice/questions/example/reports').send({ version: 1, message: 'Review' })).status, 401)
  assert.equal((await api.get('/api/practice/questions').set({ Authorization: 'Bearer ' + adminLogin.body.token })).status, 401)
  assert.equal((await api.get('/api/admin/session').set(studentAuth)).status, 401)
  assert.equal((await api.get('/api/admin/session').set({ Authorization: 'Bearer ' + adminLogin.body.token })).status, 200)
  assert.equal((await api.post('/api/auth/logout').set(studentAuth)).status, 200)
  assert.equal((await api.get('/api/practice/questions').set(studentAuth)).status, 401)
  const adminAuth = { Authorization: 'Bearer ' + adminLogin.body.token }
  assert.equal((await api.post('/api/admin/logout').set(adminAuth)).status, 200)
  assert.equal((await api.get('/api/admin/session').set(adminAuth)).status, 401)
})

test('verification codes are delivered, replaced, and locked after repeated failures', async t => {
  const sent: { email: string; code: string }[] = []
  let next = 111111
  const service = { generateCode: () => String(next++), sendCode: async (email: string, code: string) => { sent.push({ email, code }) } }
  const { api } = await createTestApi(t, { adminPassword: 'test-password-long', secret: 'secret'.repeat(10), adminEmail, dummyOtpEnabled: true, verificationEmail: service })
  const first = await api.post('/api/auth/otp/request').send({ email: 'student@example.com' })
  assert.equal(first.status, 200)
  assert.deepEqual(sent[0], { email: 'student@example.com', code: '111111' })
  assert.equal(JSON.stringify(first.body).includes('111111'), false)
  await api.post('/api/auth/otp/request').send({ email: 'student@example.com' })
  assert.equal((await api.post('/api/auth/otp/verify').send({ email: 'student@example.com', code: '111111' })).status, 401)
  assert.equal((await api.post('/api/auth/otp/verify').send({ email: 'student@example.com', code: '111112' })).status, 200)
  await api.post('/api/auth/otp/request').send({ email: 'student@example.com' })
  for (let i = 0; i < 5; i++) assert.equal((await api.post('/api/auth/otp/verify').send({ email: 'student@example.com', code: '000000' })).status, 401)
  assert.equal((await api.post('/api/auth/otp/verify').send({ email: 'student@example.com', code: '111113' })).status, 401)
  const adminOtp = await api.post('/api/admin/otp/request').send({ password: 'test-password-long' })
  assert.deepEqual(sent[3], { email: adminEmail, code: '111114' })
  for (let i = 0; i < 5; i++) assert.equal((await api.post('/api/admin/login').send({ challenge: adminOtp.body.challenge, code: '000000' })).status, 401)
  assert.equal((await api.post('/api/admin/login').send({ challenge: adminOtp.body.challenge, code: '111114' })).status, 401)
})

test('console email service logs a generated code without returning it to the client', async t => {
  const { api } = await createTestApi(t, { adminPassword: 'test-password-long', secret: 'secret'.repeat(10), dummyOtpEnabled: true, verificationEmail: consoleVerificationEmail })
  const original = console.log
  let log = ''
  console.log = (message: string) => { log = message }
  let responseBody: unknown
  let status = 0
  try {
    const response = await api.post('/api/auth/otp/request').send({ email: 'student@example.com' })
    responseBody = response.body; status = response.status
  }
  finally { console.log = original }
  const code = /^Verification code for student@example\.com: (\d{6})$/.exec(log)?.[1]
  assert.ok(code)
  assert.equal(status, 200)
  assert.equal(JSON.stringify(responseBody).includes(code), false)
  assert.equal((await api.post('/api/auth/otp/verify').send({ email: 'student@example.com', code })).status, 200)
})

test('a delivery failure does not leave a usable student challenge', async t => {
  const service = { generateCode: () => '123456', sendCode: async () => { throw Error('Delivery unavailable') } }
  const { api } = await createTestApi(t, { adminPassword: 'test-password-long', secret: 'secret'.repeat(10), dummyOtpEnabled: true, verificationEmail: service })
  assert.equal((await api.post('/api/auth/otp/request').send({ email: 'student@example.com' })).status, 500)
  assert.equal((await api.post('/api/auth/otp/verify').send({ email: 'student@example.com', code: '123456' })).status, 401)
})

test('admin requires password and a single-use email challenge', async t => {
  const secret = 'secret'.repeat(10)
  const { api, makeApi } = await createTestApi(t, { adminPassword: 'test-password-long', secret, adminEmail, dummyOtpEnabled: true })
  const missing = makeApi({ adminEmail: undefined })
  assert.equal((await missing.post('/api/admin/otp/request').send({ password: 'test-password-long' })).status, 503)
  assert.equal((await api.post('/api/admin/otp/request').send({ password: 'wrong-password' })).status, 401)
  assert.equal((await api.post('/api/admin/login').send({ password: 'test-password-long', code: '123456' })).status, 422)
  const otp = await api.post('/api/admin/otp/request').send({ password: 'test-password-long' })
  assert.equal(otp.status, 200)
  assert.equal(otp.body.demoOtp, undefined)
  assert.equal((await api.post('/api/admin/login').send({ challenge: otp.body.challenge, code: '12345a' })).status, 422)
  assert.equal((await api.post('/api/admin/login').send({ challenge: otp.body.challenge, code: '000000' })).status, 401)
  const login = await api.post('/api/admin/login').send({ challenge: otp.body.challenge, code: '123456' })
  assert.equal(login.status, 200)
  assert.equal((await api.post('/api/admin/login').send({ challenge: otp.body.challenge, code: '999999' })).status, 401)
  assert.equal((await api.get('/api/admin/session').set({ Authorization: 'Bearer ' + login.body.token + '.extra' })).status, 401)
  const expiry = String(Date.now() + 60_000)
  const oldToken = expiry + '.' + createHmac('sha256', secret).update(expiry).digest('base64url')
  assert.equal((await api.get('/api/admin/session').set({ Authorization: 'Bearer ' + oldToken })).status, 401)
  const concurrentApi = makeApi()
  const concurrentOtp = await concurrentApi.post('/api/admin/otp/request').send({ password: 'test-password-long' })
  const concurrent = await Promise.all([
    concurrentApi.post('/api/admin/login').send({ challenge: concurrentOtp.body.challenge, code: '123456' }),
    concurrentApi.post('/api/admin/login').send({ challenge: concurrentOtp.body.challenge, code: '123456' }),
  ])
  assert.deepEqual(concurrent.map(response => response.status).sort(), [200, 401])
})

test('student demo OTP is disabled unless explicitly enabled', async t => {
  const { api } = await createTestApi(t, { adminPassword: 'test-password-long', secret: 'secret'.repeat(10), adminEmail })
  assert.equal((await api.post('/api/auth/otp/request').send({ email: 'student@example.com' })).status, 503)
  assert.equal((await api.post('/api/admin/otp/request').send({ password: 'test-password-long' })).status, 503)
  assert.equal((await api.post('/api/auth/otp/verify').send({ email: 'student@example.com', code: '123456' })).status, 503)
  assert.equal((await api.post('/api/admin/login').send({ challenge: 'a'.repeat(43), code: '123456' })).status, 503)
})

test('server refuses dummy OTP outside development', () => {
  const result = spawnSync(process.execPath, ['--import', 'tsx', 'src/server.ts'], {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, ADMIN_PASSWORD: 'test-password-long', SESSION_SECRET: 'secret'.repeat(10), NODE_ENV: 'production', DUMMY_OTP_ENABLED: 'true' },
    encoding: 'utf8',
  })
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /DUMMY_OTP_ENABLED is only allowed when NODE_ENV=development/)
})

test('student and admin demo challenges expire', async t => {
  const config = { adminPassword: 'test-password-long', secret: 'secret'.repeat(10), dummyOtpEnabled: true }
  const { makeApi } = await createTestApi(t, config)
  const expiredApi = makeApi()
  await expiredApi.post('/api/auth/otp/request').send({ email: 'expired@example.com' })
  const realNow = Date.now
  Date.now = () => realNow() + 6 * 60_000
  try {
    assert.equal((await expiredApi.post('/api/auth/otp/verify').send({ email: 'expired@example.com', code: '123456' })).status, 401)
  } finally {
    Date.now = realNow
  }

  const adminApi = makeApi({ adminEmail })
  const otp = await adminApi.post('/api/admin/otp/request').send({ password: 'test-password-long' })
  Date.now = () => realNow() + 6 * 60_000
  try {
    assert.equal((await adminApi.post('/api/admin/login').send({ challenge: otp.body.challenge, code: '123456' })).status, 401)
  } finally { Date.now = realNow }
})
