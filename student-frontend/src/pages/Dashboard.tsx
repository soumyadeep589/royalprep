import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ErrorMessage } from '../components/ErrorMessage'
import { ScreenLayout } from '../components/ScreenLayout'
import type { StoredStudyPlan } from '../models/studyPlan'
import type { ChapterSummary } from '../models/chapter'
import type { AttemptSummary } from '../models/attempt'
import { api } from '../services/api'
import './study-planner.css'

export function Dashboard() {
  const [stored, setStored] = useState<StoredStudyPlan>()
  const [error, setError] = useState('')
  const [dueCards, setDueCards] = useState<number>()
  const [cardError, setCardError] = useState('')
  const [attempts, setAttempts] = useState<AttemptSummary[]>()
  const [attemptError, setAttemptError] = useState('')
  const chapterNotesEnabled = import.meta.env.VITE_CHAPTER_NOTES_ENABLED === 'true'
  const [chapterNotes, setChapterNotes] = useState<ChapterSummary[]>()
  const [chapterError, setChapterError] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    api<StoredStudyPlan>('/student/study-plan', { signal: controller.signal }, false, true)
      .then(setStored).catch(e => { if (!controller.signal.aborted) setError((e as Error).message) })
    api<{ cards: { dueAt: number }[]; serverTime: number }>('/student/flashcards', { signal: controller.signal }, false, true)
      .then(result => setDueCards(result.cards.filter(card => card.dueAt <= result.serverTime).length))
      .catch(e => { if (!controller.signal.aborted) setCardError((e as Error).message) })
    api<AttemptSummary[]>('/student/attempts', { signal: controller.signal }, false, true)
      .then(setAttempts).catch(e => { if (!controller.signal.aborted) setAttemptError(e instanceof Error ? e.message : 'Unable to load mocks.') })
    if (chapterNotesEnabled) {
      api<ChapterSummary[]>('/student/chapters', { signal: controller.signal }, false, true)
        .then(setChapterNotes).catch(e => { if (!controller.signal.aborted) setChapterError(e instanceof Error ? e.message : 'Unable to load chapter notes.') })
    }
    return () => controller.abort()
  }, [chapterNotesEnabled])
  const next = stored?.plan?.tasks.filter(task => !task.done).sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 3) ?? []
  const recentChapter = chapterNotes?.filter(chapter => chapter.lastReadAt).sort((a, b) => (b.lastReadAt ?? '').localeCompare(a.lastReadAt ?? ''))[0]
  const activeMock = attempts?.find(attempt => attempt.status === 'active')
  const latestResult = attempts?.filter(attempt => attempt.status === 'submitted').sort((a, b) => (b.submittedAt ?? 0) - (a.submittedAt ?? 0))[0]
  return <ScreenLayout><p className="screen-kicker">YOUR STUDY WORKSPACE</p><h1>Dashboard</h1><p>Pick up your preparation and review your plan.</p>
    <div className="dashboard-grid">
      {chapterNotesEnabled && <section className="screen-card"><h2>Continue reading</h2><ErrorMessage text={chapterError}/>
        {!chapterNotes && !chapterError ? <p role="status">Loading chapter notes...</p> : recentChapter ? <><p>{recentChapter.title}</p><Link className="outline-button" to={'/app/chapters/' + recentChapter.id}>Continue reading</Link></> : !chapterError && <><p>No reading progress yet.</p><Link className="outline-button" to="/app/chapters">Browse chapter notes</Link></>}
      </section>}
      <section className="screen-card"><h2>Practice questions</h2><p>Review published questions and explanations.</p><Link className="outline-button" to="/study/library">Browse chapters</Link></section>
      <section className="screen-card"><h2>Study plan</h2><ErrorMessage text={error}/>{!stored && !error ? <p role="status">Loading study plan...</p> : stored?.plan ? <><p>{stored.plan.tasks.filter(task => task.done).length} of {stored.plan.tasks.length} tasks completed. Target: {stored.plan.targetDate}.</p>{next.length > 0 && <ul>{next.map(task => <li key={task.id}>{task.title} — {task.dueDate}</li>)}</ul>}</> : !error && <p>No study plan saved yet.</p>}<Link className="outline-button" to="/tools/planner">Open planner</Link></section>
      <section className="screen-card"><h2>Mocks and results</h2><ErrorMessage text={attemptError}/>
        {!attempts && !attemptError ? <p role="status">Loading mocks...</p> : attempts && <>
          {activeMock && <p>Mock in progress · {activeMock.count} questions. <Link to={'/app/attempts/' + activeMock.id}>Resume</Link></p>}
          {latestResult && <p>Latest result: {latestResult.score}/{latestResult.count} correct. <Link to={'/app/attempts/' + latestResult.id + '/review'}>Review</Link></p>}
          {!activeMock && !latestResult && <p>No custom mocks yet.</p>}
        </>}
        <Link className="outline-button" to="/app/mocks">Open mocks</Link>
      </section>
      <section className="screen-card"><h2>Flashcards</h2><ErrorMessage text={cardError}/>{dueCards !== undefined ? <p>{dueCards} personal {dueCards === 1 ? 'card' : 'cards'} due for review.</p> : !cardError && <p role="status">Loading cards...</p>}<Link className="outline-button" to="/app/flashcards">Review flashcards</Link></section>
    </div>
  </ScreenLayout>
}
