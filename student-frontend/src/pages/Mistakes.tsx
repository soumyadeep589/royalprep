import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ScreenLayout } from '../components/ScreenLayout'
import { ErrorMessage } from '../components/ErrorMessage'
import { api } from '../services/api'
import './mocks.css'

type Mistake = { questionId: string; chapter: string; stem: string; attemptId: string | null; submittedAt: number }

export function Mistakes() {
  const [items, setItems] = useState<Mistake[]>()
  const [chapter, setChapter] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { setItems(await api<Mistake[]>('/student/mistakes', {}, false, true)) }
    catch (e) { setError((e as Error).message) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])
  const chapters = [...new Set(items?.map(item => item.chapter) ?? [])].sort()
  const visible = items?.filter(item => !chapter || item.chapter === chapter) ?? []
  return <ScreenLayout><p className="screen-kicker">RETAIN AND REVIEW</p><h1>My mistakes</h1>
    <p>Your latest practice answers and submitted answers among your most recent 100 custom mocks. A later correct answer removes a question from this list; if answers share the same timestamp, an incorrect answer takes precedence.</p>
    <ErrorMessage text={error}/>{error && <button className="outline-button" type="button" onClick={load}>Try again</button>}
    {loading ? <p role="status">Loading mistakes...</p> : !error && <>
      <label>Filter by chapter<select value={chapter} onChange={event => setChapter(event.target.value)}><option value="">All chapters</option>{chapters.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
      {visible.length ? <ul className="attempt-list">{visible.map(item => <li className="screen-card" key={item.questionId}><div><strong>{item.chapter}</strong><p>{item.stem}</p><small>Last answered {new Date(item.submittedAt).toLocaleString()}</small></div><div className="mock-actions"><Link className="outline-button" to={'/practice?question=' + encodeURIComponent(item.questionId)}>Retest question</Link>{item.attemptId && <Link className="outline-button" to={'/app/attempts/' + item.attemptId + '/review'}>Review mock</Link>}</div></li>)}</ul> : <section className="screen-card"><p>{items?.length ? 'No mistakes match this chapter.' : 'No incorrect answers to review yet.'}</p><Link to="/app/mocks">Go to mocks</Link></section>}
    </>}
  </ScreenLayout>
}
