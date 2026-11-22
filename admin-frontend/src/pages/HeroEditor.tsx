import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ErrorMessage } from '../components/ErrorMessage'
import { HomeHero } from '../components/HomeHero'
import { ScreenLayout } from '../components/ScreenLayout'
import type { HeroContent, HeroState } from '../models/hero'
import { api } from '../services/api'
import './home.css'
import './hero-editor.css'

const emptyHero: HeroContent = { eyebrow: '', headline: '', highlight: '', description: '', primaryLabel: '', primaryPath: '', secondaryLabel: '', secondaryPath: '' }
const fields: { key: keyof HeroContent; label: string; required: boolean; maxLength: number }[] = [
  { key: 'eyebrow', label: 'Eyebrow', required: false, maxLength: 100 },
  { key: 'headline', label: 'Headline', required: true, maxLength: 160 },
  { key: 'highlight', label: 'Highlighted text', required: false, maxLength: 100 },
  { key: 'description', label: 'Description', required: true, maxLength: 600 },
  { key: 'primaryLabel', label: 'Primary action label', required: true, maxLength: 80 },
  { key: 'primaryPath', label: 'Primary action internal path', required: true, maxLength: 200 },
  { key: 'secondaryLabel', label: 'Secondary action label', required: true, maxLength: 80 },
  { key: 'secondaryPath', label: 'Secondary action internal path', required: true, maxLength: 200 },
]

export function HeroEditor() {
  const [state, setState] = useState<HeroState>()
  const [content, setContent] = useState<HeroContent>(emptyHero)
  const [width, setWidth] = useState<'phone' | 'tablet' | 'desktop'>('desktop')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [signedIn, setSignedIn] = useState(Boolean(sessionStorage.getItem('rp-admin')))
  const load = useCallback(async () => {
    const result = await api<HeroState>('/admin/site/hero', {}, true)
    setState(result); setContent(result.draft?.content ?? emptyHero)
  }, [])
  useEffect(() => {
    if (!signedIn) { setLoading(false); return }
    load().catch(e => { setError((e as Error).message); setSignedIn(Boolean(sessionStorage.getItem('rp-admin'))) }).finally(() => setLoading(false))
  }, [load, signedIn])

  const dirty = JSON.stringify(content) !== JSON.stringify(state?.draft?.content ?? emptyHero)
  async function mutate(path: string, method: 'PUT' | 'POST', body: object, success: string) {
    setBusy(true); setError(''); setMessage('')
    try {
      await api(path, { method, body: JSON.stringify(body) }, true)
      await load()
      setMessage(success)
    } catch (e) { setError((e as Error).message); setSignedIn(Boolean(sessionStorage.getItem('rp-admin'))) }
    finally { setBusy(false) }
  }
  function save(event: React.FormEvent) {
    event.preventDefault()
    if (state) void mutate('/admin/site/hero/draft', 'PUT', { expectedRevision: state.currentRevision, content }, 'Draft saved.')
  }
  function publish() {
    if (state && window.confirm('Publish this saved draft to the homepage?')) {
      void mutate('/admin/site/hero/publish', 'POST', { expectedRevision: state.currentRevision }, 'Hero published.')
    }
  }
  function restore(revision: number) {
    if (state && window.confirm(`Restore published revision ${revision} as a new publication? Unsaved edits will be discarded.`)) {
      void mutate('/admin/site/hero/restore', 'POST', { expectedRevision: state.currentRevision, sourceRevision: revision }, 'Previous publication restored as a new revision.')
    }
  }

  return <ScreenLayout admin>
    {!signedIn ? <section className="screen-card"><h1>Homepage hero</h1><p>Sign in to manage content.</p><Link className="screen-button" to="/admin">Admin sign-in</Link></section> : <>
      <div className="hero-editor-heading"><div><p className="screen-kicker">CONTENT MANAGER</p><h1>Homepage hero</h1><p>Draft, preview and publish the student homepage hero.</p></div><Link className="outline-button" to="/admin/questions">Question bank</Link></div>
      <ErrorMessage text={error}/>{message && <p role="status" className="screen-message">{message}</p>}
      {loading ? <p role="status">Loading hero content...</p> : state ? <>
        <p>Current revision: {state.currentRevision} · Published: {state.publishedRevision ?? 'Not published'}</p>
        <form className="screen-card" onSubmit={save}>
          {fields.map(field => <label key={field.key}>{field.label}
            {field.key === 'description' ? <textarea required maxLength={field.maxLength} value={content[field.key]} onChange={event => setContent({ ...content, [field.key]: event.target.value })}/> : <input required={field.required} maxLength={field.maxLength} value={content[field.key]} onChange={event => setContent({ ...content, [field.key]: event.target.value })}/>}
          </label>)}
          <p>Links must be internal paths beginning with /. Image uploads require the future asset service.</p>
          <div className="hero-editor-actions"><button className="screen-button" disabled={busy}>Save draft</button><button className="outline-button" type="button" disabled={busy || dirty || state.draftRevision === null} onClick={publish}>Publish saved draft</button><button className="outline-button" type="button" disabled={busy} onClick={() => { if (!dirty || window.confirm('Discard unsaved edits and reload?')) { setError(''); void load().catch(e => setError((e as Error).message)) } }}>Reload</button></div>
          {dirty && <p>Save your changes before publishing.</p>}
        </form>
        <section className="hero-editor-preview"><h2>Preview</h2><div className="hero-editor-actions" aria-label="Preview width">
          {(['phone', 'tablet', 'desktop'] as const).map(item => <button key={item} type="button" className="outline-button" aria-pressed={width === item} onClick={() => setWidth(item)}>{item}</button>)}
        </div><div className={`home hero-preview hero-preview-${width}`}><HomeHero content={content} preview><p>Published catalog counts appear here.</p></HomeHero></div></section>
        <section className="screen-card"><h2>Publication history</h2>{state.history.length ? <ul className="hero-history">{state.history.map(item => <li key={item.revision}><span>Revision {item.revision}: {item.content.headline} ({new Date(item.createdAt).toLocaleString()})</span><button className="outline-button" type="button" disabled={busy} onClick={() => restore(item.revision)}>Restore</button></li>)}</ul> : <p>No published revisions yet.</p>}</section>
      </> : !error && <p>Hero content is unavailable.</p>}
    </>}
  </ScreenLayout>
}
