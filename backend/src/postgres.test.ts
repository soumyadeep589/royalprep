import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { newDb } from 'pg-mem'
import request from 'supertest'
import { createApp } from './app.js'

const adminEmail = 'admin@example.com'
const verificationEmail = { generateCode: () => '123456', sendCode: async () => {} }

async function loginAdmin(api: ReturnType<typeof request>) {
  const otp = await api.post('/api/admin/otp/request').send({ password: 'test-password-long' })
  return api.post('/api/admin/login').send({ challenge: otp.body.challenge, code: '123456' })
}

test('PostgreSQL flashcards and review events persist across requests', async () => {
  const db = newDb()
  db.public.none(await readFile(new URL('../migrations/005_flashcards.sql', import.meta.url), 'utf8'))
  db.public.none(await readFile(new URL('../migrations/006_student_accounts.sql', import.meta.url), 'utf8'))
  db.public.none(await readFile(new URL('../migrations/008_student_soft_deletion.sql', import.meta.url), 'utf8'))
  const { Pool } = db.adapters.createPg()
  const pool = new Pool()
  try {
    const api = request(createApp({ adminPassword: 'test-password-long', secret: 'secret'.repeat(10), postgres: pool, dummyOtpEnabled: true, verificationEmail }))
    const otp = await api.post('/api/auth/otp/request').send({ email: 'student@example.com' })
    const auth = { Authorization: 'Bearer ' + (await api.post('/api/auth/otp/verify').send({ email: 'student@example.com', code: '123456' })).body.token }
    const card = (await api.post('/api/student/flashcards').set(auth).send({ chapter: 'Anatomy', front: 'Question', back: 'Answer' })).body
    const eventId = randomUUID()
    const review = { eventId, expectedVersion: 1, rating: 'hard' }
    assert.equal((await api.post(`/api/student/flashcards/${card.id}/review`).set(auth).send(review)).body.version, 2)
    assert.equal((await api.post(`/api/student/flashcards/${card.id}/review`).set(auth).send(review)).body.version, 2)
    assert.equal((await api.get('/api/student/flashcards').set(auth)).body.cards[0].intervalDays, 1)
  } finally { await pool.end() }
})

test('PostgreSQL custom mocks survive application restart', async () => {
  const db = newDb()
  db.public.registerFunction({ name: 'jsonb_typeof', args: ['jsonb'], returns: 'text', implementation: value => Array.isArray(value) ? 'array' : typeof value })
  db.public.registerFunction({ name: 'jsonb_array_length', args: ['jsonb'], returns: 'integer', implementation: value => value.length })
  db.public.none(await readFile(new URL('../migrations/001_questions.sql', import.meta.url), 'utf8'))
  db.public.none(await readFile(new URL('../migrations/004_custom_attempts.sql', import.meta.url), 'utf8'))
  db.public.none(await readFile(new URL('../migrations/006_student_accounts.sql', import.meta.url), 'utf8'))
  db.public.none(await readFile(new URL('../migrations/008_student_soft_deletion.sql', import.meta.url), 'utf8'))
  const { Pool } = db.adapters.createPg()
  const pool = new Pool()
  try {
    const newApi = () => request(createApp({ adminPassword: 'test-password-long', secret: 'secret'.repeat(10), adminEmail, postgres: pool, dummyOtpEnabled: true, verificationEmail }))
    const loginStudent = async (api: ReturnType<typeof request>) => {
      const otp = await api.post('/api/auth/otp/request').send({ email: 'student@example.com' })
      return { Authorization: 'Bearer ' + (await api.post('/api/auth/otp/verify').send({ email: 'student@example.com', code: '123456' })).body.token }
    }
    const api = newApi()
    const admin = { Authorization: 'Bearer ' + (await loginAdmin(api)).body.token }
    const question = await api.post('/api/admin/questions').set(admin).send({ chapter: 'Anatomy', published: true, stem: 'Pick the right answer', options: ['A', 'B', 'C', 'D'], correct: 1, explanation: 'B is correct.' })
    const student = await loginStudent(api)
    const created = await api.post('/api/student/attempts').set(student).send({ requestId: randomUUID(), chapters: ['Anatomy'], count: 1, durationMinutes: 5 })
    assert.equal(created.status, 201)
    const answered = await api.put(`/api/student/attempts/${created.body.id}/answers/${question.body.id}`).set(student).send({ expectedVersion: 1, option: 1 })
    assert.equal(answered.body.version, 2)
    const restarted = newApi()
    const newStudent = await loginStudent(restarted)
    const resumed = await restarted.get(`/api/student/attempts/${created.body.id}`).set(newStudent)
    assert.equal(resumed.body.answers[question.body.id], 1)
    assert.equal((await restarted.get('/api/student/attempts').set(newStudent)).body.length, 1)
    assert.equal((await restarted.post(`/api/student/attempts/${created.body.id}/submit`).set(newStudent).send({ expectedVersion: 2 })).body.score, 1)
  } finally { await pool.end() }
})

test('PostgreSQL study plans persist per student and reject stale versions', async () => {
  const db = newDb()
  db.public.none(await readFile(new URL('../migrations/003_study_plans.sql', import.meta.url), 'utf8'))
  db.public.none(await readFile(new URL('../migrations/006_student_accounts.sql', import.meta.url), 'utf8'))
  db.public.none(await readFile(new URL('../migrations/008_student_soft_deletion.sql', import.meta.url), 'utf8'))
  const { Pool } = db.adapters.createPg()
  const pool = new Pool()
  try {
    const app = () => request(createApp({ adminPassword: 'test-password-long', secret: 'secret'.repeat(10), postgres: pool, dummyOtpEnabled: true, verificationEmail }))
    const api = app()
    const otp = await api.post('/api/auth/otp/request').send({ email: 'student@example.com' })
    const student = { Authorization: 'Bearer ' + (await api.post('/api/auth/otp/verify').send({ email: 'student@example.com', code: '123456' })).body.token }
    const plan = { targetDate: '2027-06-01', daysPerWeek: 3, hoursPerWeek: 6, tasks: [] }
    assert.equal((await api.put('/api/student/study-plan').set(student).send({ expectedVersion: 0, plan })).status, 200)
    assert.equal((await api.put('/api/student/study-plan').set(student).send({ expectedVersion: 0, plan })).status, 409)
    assert.deepEqual((await api.get('/api/student/study-plan').set(student)).body, { version: 1, plan })
    const updated = { ...plan, hoursPerWeek: 8 }
    assert.equal((await api.put('/api/student/study-plan').set(student).send({ expectedVersion: 1, plan: updated })).body.version, 2)
    assert.equal((await api.put('/api/student/study-plan').set(student).send({ expectedVersion: 1, plan })).status, 409)
    assert.deepEqual((await api.get('/api/student/study-plan').set(student)).body, { version: 2, plan: updated })
  } finally { await pool.end() }
})

test('PostgreSQL-backed question API persists questions, versions and reports', async () => {
  const db = newDb()
  db.public.registerFunction({ name: 'jsonb_typeof', args: ['jsonb'], returns: 'text', implementation: value => Array.isArray(value) ? 'array' : typeof value })
  db.public.registerFunction({ name: 'jsonb_array_length', args: ['jsonb'], returns: 'integer', implementation: value => value.length })
  db.public.none(await readFile(new URL('../migrations/001_questions.sql', import.meta.url), 'utf8'))
  db.public.none(await readFile(new URL('../migrations/006_student_accounts.sql', import.meta.url), 'utf8'))
  db.public.none(await readFile(new URL('../migrations/008_student_soft_deletion.sql', import.meta.url), 'utf8'))
  db.public.none(await readFile(new URL('../migrations/010_practice_answers.sql', import.meta.url), 'utf8'))
  const { Pool } = db.adapters.createPg()
  const pool = new Pool()
  try {
    const api = request(createApp({ adminPassword: 'test-password-long', secret: 'secret'.repeat(10), adminEmail, postgres: pool, dummyOtpEnabled: true, verificationEmail }))
    const auth = { Authorization: 'Bearer ' + (await loginAdmin(api)).body.token }
    const otp = await api.post('/api/auth/otp/request').send({ email: 'student@example.com' })
    const student = { Authorization: 'Bearer ' + (await api.post('/api/auth/otp/verify').send({ email: 'student@example.com', code: '123456' })).body.token }
    const payload = { chapter: 'Anatomy', published: true, stem: 'Pick the right answer', options: ['A', 'B', 'C', 'D'], correct: 1, explanation: 'B is correct.' }
    const created = await api.post('/api/admin/questions').set(auth).send(payload)
    assert.equal(created.status, 201)
    assert.deepEqual((await api.get('/api/public/catalog-summary')).body, { questionCount: 1, chapterCount: 1 })
    const practice = await api.get('/api/practice/questions').set(student)
    assert.equal(practice.body[0].correct, undefined)
    assert.equal((await api.post(`/api/practice/questions/${created.body.id}/reports`).set(student).send({ version: 1, message: 'Please review' })).status, 201)
    const updated = await api.put(`/api/admin/questions/${created.body.id}`).set(auth).send({ ...created.body, stem: 'Updated question' })
    assert.equal(updated.body.version, 2)
    assert.equal((await api.put(`/api/admin/questions/${created.body.id}`).set(auth).send(created.body)).status, 409)
    const reports = await api.get('/api/admin/question-reports').set(auth)
    assert.equal(reports.body[0].questionStem, payload.stem)
    assert.equal(reports.body[0].questionVersion, 1)
  } finally {
    await pool.end()
  }
})

test('hero drafts stay private and publications can be restored without overwriting history', async () => {
  const db = newDb()
  db.public.none(await readFile(new URL('../migrations/002_hero.sql', import.meta.url), 'utf8'))
  const { Pool } = db.adapters.createPg()
  const pool = new Pool()
  try {
    const api = request(createApp({ adminPassword: 'test-password-long', secret: 'secret'.repeat(10), adminEmail, postgres: pool, dummyOtpEnabled: true, verificationEmail }))
    const auth = { Authorization: 'Bearer ' + (await loginAdmin(api)).body.token }
    const content = { eyebrow: 'Study', headline: 'Original headline', highlight: 'Part A', description: 'Study at your pace.', primaryLabel: 'Practice', primaryPath: '/practice', secondaryLabel: 'Sign in', secondaryPath: '/sign-in' }
    assert.equal((await api.get('/api/public/site/hero')).status, 404)
    assert.equal((await api.put('/api/admin/site/hero/draft').send({ expectedRevision: 0, content })).status, 401)
    assert.equal((await api.put('/api/admin/site/hero/draft').set(auth).send({ expectedRevision: 0, content: { ...content, primaryPath: '//example.com' } })).status, 422)
    assert.equal((await api.put('/api/admin/site/hero/draft').set(auth).send({ expectedRevision: 0, content })).body.revision, 1)
    assert.equal((await api.get('/api/public/site/hero')).status, 404)
    assert.equal((await api.post('/api/admin/site/hero/publish').set(auth).send({ expectedRevision: 1 })).body.revision, 1)
    assert.equal((await api.get('/api/public/site/hero')).body.content.headline, 'Original headline')
    assert.equal((await api.put('/api/admin/site/hero/draft').set(auth).send({ expectedRevision: 0, content })).status, 409)
    assert.equal((await api.put('/api/admin/site/hero/draft').set(auth).send({ expectedRevision: 1, content: { ...content, headline: 'New headline' } })).body.revision, 2)
    assert.equal((await api.get('/api/public/site/hero')).body.content.headline, 'Original headline')
    assert.equal((await api.post('/api/admin/site/hero/publish').set(auth).send({ expectedRevision: 2 })).body.revision, 2)
    assert.equal((await api.post('/api/admin/site/hero/restore').set(auth).send({ expectedRevision: 2, sourceRevision: 1 })).body.revision, 3)
    assert.equal((await api.get('/api/public/site/hero')).body.content.headline, 'Original headline')
    const state = await api.get('/api/admin/site/hero').set(auth)
    assert.equal(state.body.currentRevision, 3)
    assert.deepEqual(state.body.history.map((item: { revision: number }) => item.revision), [3, 2, 1])
  } finally {
    await pool.end()
  }
})
