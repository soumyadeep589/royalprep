import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ErrorMessage } from '../components/ErrorMessage'
import { ScreenLayout } from '../components/ScreenLayout'
import type { Attempt } from '../models/attempt'
import { api } from '../services/api'
import './mocks.css'

export function MockAttempt() {
  const { id } = useParams()
  const [attempt, setAttempt] = useState<Attempt>()
  const [index, setIndex] = useState(0)
  const [clock, setClock] = useState(Date.now())
  const [offset, setOffset] = useState(0)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const update = useCallback((next: Attempt) => {
    setAttempt(next); setOffset(next.serverTime - Date.now()); setClock(Date.now())
  }, [])
  const load = useCallback(async () => {
    if (!id) return
    setLoading(true); setError('')
    try { update(await api<Attempt>('/student/attempts/' + encodeURIComponent(id), {}, false, true)) }
    catch (e) { setError((e as Error).message) }
    finally { setLoading(false) }
  }, [id, update])
  useEffect(() => { void load() }, [load])
  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible' && !busy) void load() }
    document.addEventListener('visibilitychange', refresh)
    return () => document.removeEventListener('visibilitychange', refresh)
  }, [busy, load])
  const remaining = attempt ? Math.max(0, Math.ceil((attempt.deadline - (clock + offset)) / 1000)) : 0
  const question = attempt?.questions[index]
  async function mutate(path: string, method: 'PUT' | 'POST', body: object) {
    if (!attempt) return
    setBusy(true); setError(''); setMessage('')
    try {
      update(await api<Attempt>(`/student/attempts/${encodeURIComponent(attempt.id)}${path}`, { method, body: JSON.stringify(body) }, false, true))
      setMessage('Saved.')
    } catch (e) { setError((e as Error).message) }
    finally { setBusy(false) }
  }
  function submit() {
    if (!attempt) return
    const unanswered = attempt.questions.length - Object.keys(attempt.answers).length
    if (window.confirm(`Submit this mock? ${unanswered} question(s) are unanswered.`)) void mutate('/submit', 'POST', { expectedVersion: attempt.version })
  }
  return <ScreenLayout><div className="mocks-heading"><div><p className="screen-kicker">CUSTOM MOCK</p><h1>{attempt?.status === 'submitted' ? 'Mock review' : 'Timed mock'}</h1></div><Link to="/app/mocks">All mocks</Link></div>
    <ErrorMessage text={error}/>{error && <button className="outline-button" onClick={load} disabled={loading || busy}>Reload saved state</button>}{message && <p className="screen-message" role="status">{message}</p>}
    {loading && !attempt ? <p role="status">Loading mock...</p> : attempt && <>
      {attempt.status === 'active' ? <>
        <div className="mock-status"><p role="timer">Time remaining: {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}</p><span>{Object.keys(attempt.answers).length} of {attempt.questions.length} answered</span></div>
        {remaining === 0 && <p role="status">Time is up. Reload to finalize and see your result.</p>}
        <div className="mock-layout">
          <section className="screen-card">
            {question && <><p className="screen-kicker">QUESTION {index + 1} OF {attempt.questions.length} · {question.chapter}</p><p className="question-stem">{question.stem}</p>
              <fieldset disabled={busy || remaining === 0}><legend>Choose one answer</legend>
                {question.options.map((option, choice) => <label key={choice} className={'practice-option' + (attempt.answers[question.id] === choice ? ' chosen' : '')}><input type="radio" name="mock-answer" checked={attempt.answers[question.id] === choice} onChange={() => void mutate(`/answers/${encodeURIComponent(question.id)}`, 'PUT', { expectedVersion: attempt.version, option: choice })}/><span className="option-letter">{String.fromCharCode(65 + choice)}</span><span>{option}</span></label>)}
              </fieldset>
              <div className="mock-actions"><button className="outline-button" disabled={busy || remaining === 0} onClick={() => void mutate(`/flags/${encodeURIComponent(question.id)}`, 'PUT', { expectedVersion: attempt.version, flagged: !attempt.flags.includes(question.id) })}>{attempt.flags.includes(question.id) ? 'Remove flag' : 'Flag for review'}</button>
                <button className="outline-button" disabled={busy || remaining === 0 || attempt.answers[question.id] === undefined} onClick={() => void mutate(`/answers/${encodeURIComponent(question.id)}`, 'PUT', { expectedVersion: attempt.version, option: null })}>Clear answer</button></div>
            </>}
            <div className="mock-controls"><button className="outline-button" disabled={busy || index === 0} onClick={() => setIndex(value => value - 1)}>Previous</button><button className="outline-button" disabled={busy || index >= attempt.questions.length - 1} onClick={() => setIndex(value => value + 1)}>Next</button><button className="screen-button" disabled={busy || remaining === 0} onClick={submit}>Submit mock</button>{remaining === 0 && <button className="screen-button" disabled={busy} onClick={load}>View result</button>}</div>
          </section>
          <aside className="screen-card"><h2>Question navigator</h2><div className="mock-grid">{attempt.questions.map((item, i) => <button key={item.id} type="button" disabled={busy} className={index === i ? 'active' : ''} aria-label={`Question ${i + 1}${attempt.answers[item.id] !== undefined ? ', answered' : ''}${attempt.flags.includes(item.id) ? ', flagged' : ''}`} onClick={() => setIndex(i)}>{i + 1}{attempt.flags.includes(item.id) ? ' ⚑' : ''}</button>)}</div><p>Answers are saved when selected. Flagged questions are marked.</p></aside>
        </div>
      </> : <><section className="screen-card"><h2>Result: {attempt.score} / {attempt.questions.length}</h2><p>Correct answers out of {attempt.questions.length} questions. No pass prediction or percentile is available.</p><Link className="outline-button" to="/app/results">All results</Link></section>
        <div className="mock-review">{attempt.questions.map((item, i) => <section className="screen-card" key={item.id}><h2>Question {i + 1} · {item.chapter}</h2><p>{item.stem}</p><p>Your answer: {attempt.answers[item.id] === undefined ? 'Not answered' : item.options[attempt.answers[item.id]]}</p><p>Correct answer: {item.correct === undefined ? 'Unavailable' : item.options[item.correct]}</p><p>{item.explanation}</p></section>)}</div>
      </>}
    </>}
  </ScreenLayout>
}
