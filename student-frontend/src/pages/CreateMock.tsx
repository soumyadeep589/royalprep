import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ErrorMessage } from '../components/ErrorMessage'
import { ScreenLayout } from '../components/ScreenLayout'
import type { Attempt } from '../models/attempt'
import { api } from '../services/api'
import './mocks.css'

type Chapter = { name: string; questionCount: number }

export function CreateMock() {
  const [chapters, setChapters] = useState<Chapter[]>()
  const [selected, setSelected] = useState<string[]>([])
  const [count, setCount] = useState(10)
  const [duration, setDuration] = useState(30)
  const [requestId, setRequestId] = useState(() => crypto.randomUUID())
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()
  useEffect(() => {
    const controller = new AbortController()
    api<Chapter[]>('/public/chapters', { signal: controller.signal }).then(setChapters)
      .catch(e => { if (!controller.signal.aborted) setError((e as Error).message) })
    return () => controller.abort()
  }, [])
  const inventory = chapters?.filter(chapter => selected.includes(chapter.name)).reduce((sum, chapter) => sum + chapter.questionCount, 0) ?? 0
  async function start(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError('')
    try {
      const attempt = await api<Attempt>('/student/attempts', { method: 'POST', body: JSON.stringify({ requestId, chapters: selected, count, durationMinutes: duration }) }, false, true)
      navigate('/app/attempts/' + attempt.id, { replace: true })
    } catch (e) { setError((e as Error).message) }
    finally { setBusy(false) }
  }
  return <ScreenLayout><p className="screen-kicker">CUSTOM MOCK</p><h1>Create a mock</h1><p>Select chapters and choose how many questions to take under a server-enforced timer.</p>
    <Link to="/app/mocks">← All mocks</Link><ErrorMessage text={error}/>
    {!chapters && !error ? <p role="status">Loading chapters...</p> : chapters && <form className="screen-card mock-builder" onSubmit={start}>
      <fieldset disabled={busy}><legend>Chapters</legend>
        {chapters.length ? chapters.map(chapter => <label className="check" key={chapter.name}><input type="checkbox" checked={selected.includes(chapter.name)} onChange={event => {
          setSelected(current => event.target.checked ? [...current, chapter.name] : current.filter(name => name !== chapter.name))
          setRequestId(crypto.randomUUID())
        }}/><span>{chapter.name} ({chapter.questionCount})</span></label>) : <p>No published questions are available yet.</p>}
      </fieldset>
      <p>{inventory} published questions available in selected chapters.</p>
      <div className="mock-builder-fields">
        <label>Number of questions<input type="number" min="1" max={Math.min(100, inventory)} required value={count} disabled={busy} onChange={event => { setCount(Number(event.target.value)); setRequestId(crypto.randomUUID()) }}/></label>
        <label>Duration in minutes<input type="number" min="1" max="240" required value={duration} disabled={busy} onChange={event => { setDuration(Number(event.target.value)); setRequestId(crypto.randomUUID()) }}/></label>
      </div>
      <p>All selected published questions are eligible. History filters and tutor mode are not available yet.</p>
      <button className="screen-button" disabled={busy || !selected.length || count < 1 || count > inventory || count > 100}>Start timed mock</button>
    </form>}
  </ScreenLayout>
}
