import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ErrorMessage } from '../components/ErrorMessage'
import { ScreenLayout } from '../components/ScreenLayout'
import type { ChapterProgress, StudentChapter } from '../models/chapter'
import { api } from '../services/api'
import './library.css'

export function ChapterReader() {
  const { id } = useParams()
  const [chapter, setChapter] = useState<StudentChapter>()
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const load = useCallback(async (signal?: AbortSignal) => {
    if (!id) return
    setLoading(true); setError('')
    try { setChapter(await api<StudentChapter>('/student/chapters/' + encodeURIComponent(id), { signal }, false, true)) }
    catch (e) { if (!signal?.aborted) setError(e instanceof Error ? e.message : 'Unable to load this chapter.') }
    finally { if (!signal?.aborted) setLoading(false) }
  }, [id])
  useEffect(() => {
    const controller = new AbortController()
    setChapter(undefined); setMessage('')
    void load(controller.signal)
    return () => controller.abort()
  }, [load])

  async function save(sectionId: string) {
    if (!id || !chapter) return
    setBusy(true); setError(''); setMessage('')
    try {
      const progress = await api<ChapterProgress>('/student/chapters/' + encodeURIComponent(id) + '/progress', {
        method: 'PUT', body: JSON.stringify({ expectedVersion: chapter.progress?.version ?? 0, revision: chapter.revision, sectionId }),
      }, false, true)
      setChapter({ ...chapter, progress }); setMessage('Reading position saved.')
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to save reading position.') }
    finally { setBusy(false) }
  }
  const savedSection = chapter?.content.sections.find(section => section.id === chapter.progress?.sectionId)
  return <ScreenLayout>
    <p><Link to="/app/chapters">← Chapter library</Link></p>
    <ErrorMessage text={error}/>{error && <button className="outline-button" onClick={() => void load()} disabled={loading || busy}>Reload chapter</button>}
    {message && <p role="status" className="screen-message">{message}</p>}
    {loading ? <p role="status">Loading chapter...</p> : chapter && <>
      <p className="screen-kicker">CHAPTER NOTES</p><h1>{chapter.content.title}</h1>
      {chapter.progress && (savedSection ? <p>Last read: <a href={'#section-' + savedSection.id}>{savedSection.title}</a>{chapter.progress.revision !== chapter.revision && ' (chapter updated since your last visit)'}</p> : <p>Your saved section is no longer available in this revision.</p>)}
      <nav aria-label="Chapter sections"><ul>{chapter.content.sections.map(section => <li key={section.id}><a href={'#section-' + section.id}>{section.title}</a></li>)}</ul></nav>
      <div className="chapter-sections">{chapter.content.sections.map(section => <section id={'section-' + section.id} className="screen-card" key={section.id}>
        <h2>{section.title}</h2><p className="chapter-section-text">{section.body}</p>
        <button className="outline-button" disabled={busy} onClick={() => void save(section.id)}>Mark last read</button>
      </section>)}</div>
      {chapter.content.practiceChapter && <p><Link className="screen-button" to={'/practice?chapter=' + encodeURIComponent(chapter.content.practiceChapter)}>Practice this chapter</Link></p>}
    </>}
  </ScreenLayout>
}
