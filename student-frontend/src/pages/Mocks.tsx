import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ErrorMessage } from '../components/ErrorMessage'
import { ScreenLayout } from '../components/ScreenLayout'
import type { AttemptSummary } from '../models/attempt'
import { api } from '../services/api'
import './mocks.css'

export function Mocks({ results = false }: { results?: boolean }) {
  const [attempts, setAttempts] = useState<AttemptSummary[]>()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { setAttempts(await api<AttemptSummary[]>('/student/attempts', {}, false, true)) }
    catch (e) { setError((e as Error).message) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])
  const shown = attempts?.filter(item => !results || item.status === 'submitted') ?? []
  return <ScreenLayout>
    <div className="mocks-heading"><div><p className="screen-kicker">{results ? 'YOUR PERFORMANCE' : 'ASSESSMENTS'}</p><h1>{results ? 'Results' : 'Mock exams'}</h1><p>{results ? 'Review submitted custom mocks.' : 'Build a timed mock or resume an existing attempt.'}</p></div><Link className="screen-button" to="/app/mocks/new">Create custom mock</Link></div>
    {!results && <p>Daily and Grand Mocks are not available yet. Custom mocks use published questions.</p>}
    <ErrorMessage text={error}/>{error && <button className="outline-button" type="button" onClick={load}>Try again</button>}
    {loading ? <p role="status">Loading attempts...</p> : !error && (shown.length ? <ul className="attempt-list">{shown.map(attempt => <li className="screen-card" key={attempt.id}>
      <div><strong>{attempt.status === 'active' ? 'In progress' : 'Submitted'}</strong><p>{new Date(attempt.createdAt).toLocaleString()} · {attempt.count} questions{attempt.score !== null && ` · ${attempt.score}/${attempt.count} correct`}</p></div>
      <Link className="outline-button" to={'/app/attempts/' + attempt.id}>{attempt.status === 'active' ? 'Resume' : 'Review result'}</Link>
    </li>)}</ul> : <section className="screen-card"><p>{results ? 'No submitted mocks yet.' : 'No custom mocks yet.'}</p></section>)}
  </ScreenLayout>
}
