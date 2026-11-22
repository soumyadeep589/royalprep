import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ErrorMessage } from '../components/ErrorMessage'
import { ScreenLayout } from '../components/ScreenLayout'
import type { ChapterContent, ChapterState } from '../models/chapter'
import { api } from '../services/api'
import './hero-editor.css'

type AdminChapterSummary = { id: string; currentRevision: number; publishedRevision: number | null; title: string }
const newSection = () => ({ id: crypto.randomUUID(), title: '', body: '' })
const emptyChapter = (): ChapterContent => ({ title: '', practiceChapter: '', sections: [newSection()] })

export function ChapterEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [chapters, setChapters] = useState<AdminChapterSummary[]>()
  const [state, setState] = useState<ChapterState>()
  const [content, setContent] = useState<ChapterContent>(emptyChapter)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); setError('')
    try {
      if (!id) setChapters(await api<AdminChapterSummary[]>('/admin/chapters', { signal }, true))
      else if (id === 'new') { setState(undefined); setContent(emptyChapter()) }
      else {
        const result = await api<ChapterState>('/admin/chapters/' + encodeURIComponent(id), { signal }, true)
        setState(result); setContent(result.draft.content)
      }
      return true
    } catch (e) {
      if (!signal?.aborted) setError(e instanceof Error ? e.message : 'Unable to load chapters.')
      return false
    }
    finally { if (!signal?.aborted) setLoading(false) }
  }, [id])
  useEffect(() => {
    const controller = new AbortController()
    setMessage('')
    void load(controller.signal)
    return () => controller.abort()
  }, [load])

  const dirty = Boolean(id) && (id === 'new'
    ? Boolean(content.title || content.practiceChapter || content.sections.some(section => section.title || section.body))
    : Boolean(state && JSON.stringify(content) !== JSON.stringify(state.draft.content)))
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault() }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  async function save(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('')
    try {
      if (id === 'new') {
        const result = await api<{ id: string }>('/admin/chapters', { method: 'POST', body: JSON.stringify(content) }, true)
        navigate('/admin/content/chapters/' + result.id, { replace: true })
      } else if (id && state) {
        await api('/admin/chapters/' + encodeURIComponent(id) + '/draft', { method: 'PUT', body: JSON.stringify({ expectedRevision: state.currentRevision, content }) }, true)
        if (await load()) setMessage('Draft saved.')
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to save the chapter.') }
    finally { setBusy(false) }
  }
  async function publish() {
    if (!id || !state || !window.confirm('Publish this saved chapter for students?')) return
    setBusy(true); setError(''); setMessage('')
    try {
      await api('/admin/chapters/' + encodeURIComponent(id) + '/publish', { method: 'POST', body: JSON.stringify({ expectedRevision: state.currentRevision }) }, true)
      if (await load()) setMessage('Chapter published.')
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to publish the chapter.') }
    finally { setBusy(false) }
  }
  async function restore(sourceRevision: number) {
    if (!id || !state || !window.confirm(`Restore publication ${sourceRevision} as a new revision? Unsaved edits and the current draft will be replaced.`)) return
    setBusy(true); setError(''); setMessage('')
    try {
      await api('/admin/chapters/' + encodeURIComponent(id) + '/restore', { method: 'POST', body: JSON.stringify({ expectedRevision: state.currentRevision, sourceRevision }) }, true)
      if (await load()) setMessage('Previous publication restored as a new revision.')
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to restore the chapter.') }
    finally { setBusy(false) }
  }

  return <ScreenLayout admin>
    <div className="hero-editor-heading"><div><p className="screen-kicker">CONTENT MANAGER</p><h1>{id ? 'Edit chapter' : 'Chapter notes'}</h1><p>Write plain-text sections and publish only approved content.</p></div>
      {!id && <Link className="screen-button" to="/admin/content/chapters/new">New chapter</Link>}
    </div>
    <ErrorMessage text={error}/>{message && <p role="status" className="screen-message">{message}</p>}
    {loading ? <p role="status">Loading chapters...</p> : !id ? <section className="screen-card">
      {chapters?.length ? <ul>{chapters.map(chapter => <li key={chapter.id}><Link to={'/admin/content/chapters/' + chapter.id}>{chapter.title}</Link> · {chapter.publishedRevision === null ? 'Draft only' : `Published revision ${chapter.publishedRevision}`} · Current revision {chapter.currentRevision}</li>)}</ul> : !error && <p>No chapter notes have been created yet.</p>}
    </section> : (id === 'new' || state) && <>
      <p><Link to="/admin/content/chapters" onClick={event => { if (dirty && !window.confirm('Discard unsaved changes?')) event.preventDefault() }}>← All chapter notes</Link></p>
      {state && <p>Current revision: {state.currentRevision} · Published: {state.publishedRevision ?? 'Not published'}</p>}
      <form className="screen-card" onSubmit={save}>
        <label>Chapter title<input required maxLength={160} value={content.title} onChange={event => setContent({ ...content, title: event.target.value })}/></label>
        <label>Practice chapter name (optional)<input maxLength={120} value={content.practiceChapter} onChange={event => setContent({ ...content, practiceChapter: event.target.value })}/><small>Use the exact question-bank chapter name to link practice.</small></label>
        {content.sections.map((section, index) => <fieldset key={section.id}>
          <legend>Section {index + 1}</legend>
          <label>Section title<input required maxLength={160} value={section.title} onChange={event => setContent({ ...content, sections: content.sections.map(item => item.id === section.id ? { ...item, title: event.target.value } : item) })}/></label>
          <label>Section text<textarea required maxLength={4000} value={section.body} onChange={event => setContent({ ...content, sections: content.sections.map(item => item.id === section.id ? { ...item, body: event.target.value } : item) })}/></label>
          <button className="outline-button" type="button" disabled={content.sections.length === 1 || busy} onClick={() => setContent({ ...content, sections: content.sections.filter(item => item.id !== section.id) })}>Remove section</button>
        </fieldset>)}
        <div className="hero-editor-actions">
          <button className="outline-button" type="button" disabled={busy || content.sections.length >= 25} onClick={() => setContent({ ...content, sections: [...content.sections, newSection()] })}>Add section</button>
          <button className="screen-button" disabled={busy}>Save draft</button>
          {state && <button className="outline-button" type="button" disabled={busy || dirty || state.draftRevision === null} onClick={publish}>Publish saved draft</button>}
          {state && <button className="outline-button" type="button" disabled={busy} onClick={() => { if (!dirty || window.confirm('Discard unsaved changes and reload?')) void load() }}>Reload</button>}
        </div>
        {dirty && <p>Save your changes before publishing.</p>}
      </form>
      {state && <section className="screen-card"><h2>Publication history</h2>
        {state.history.length ? <ul className="hero-history">{state.history.map(item => <li key={item.revision}>
          <div><strong>Revision {item.revision}: {item.content.title}</strong>
            <p>{item.publishedAt ? `Published ${new Date(item.publishedAt).toLocaleString()}` : 'Publication time unavailable'}{item.sourceRevision !== null ? ` · Restored from revision ${item.sourceRevision}` : ''}</p>
            <details><summary>Preview content</summary>
              {item.content.sections.map(section => <div key={section.id}><h3>{section.title}</h3><p style={{ whiteSpace: 'pre-wrap' }}>{section.body}</p></div>)}
            </details>
          </div>
          <button className="outline-button" type="button" disabled={busy} onClick={() => restore(item.revision)}>Restore</button>
        </li>)}</ul> : <p>No recorded publications yet.</p>}
      </section>}
    </>}
  </ScreenLayout>
}
