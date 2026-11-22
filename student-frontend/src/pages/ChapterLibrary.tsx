import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ErrorMessage } from '../components/ErrorMessage'
import { ScreenLayout } from '../components/ScreenLayout'
import { api } from '../services/api'
import type { ChapterSummary } from '../models/chapter'
import './library.css'

type Chapter = { name: string; questionCount: number }

export function ChapterLibrary({ publicCatalog = false }: { publicCatalog?: boolean }) {
  const chapterNotesEnabled = import.meta.env.VITE_CHAPTER_NOTES_ENABLED === 'true'
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notes, setNotes] = useState<ChapterSummary[]>()
  const [notesError, setNotesError] = useState('')
  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { setChapters(await api<Chapter[]>('/public/chapters')) }
    catch (e) { setError((e as Error).message) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])
  const loadNotes = useCallback(async () => {
    setNotes(undefined); setNotesError('')
    try { setNotes(await api<ChapterSummary[]>('/student/chapters', {}, false, true)) }
    catch (e) { setNotesError(e instanceof Error ? e.message : 'Unable to load chapter notes.') }
  }, [])
  useEffect(() => { if (chapterNotesEnabled) void loadNotes() }, [chapterNotesEnabled, loadNotes])
  const filtered = useMemo(() => chapters.filter(chapter => chapter.name.toLowerCase().includes(query.trim().toLowerCase())), [chapters, query])
  const filteredNotes = notes?.filter(chapter => chapter.title.toLowerCase().includes(query.trim().toLowerCase()))

  return <ScreenLayout>
    <div className="library-heading"><p className="screen-kicker">{publicCatalog ? 'COURSE CATALOG' : 'STUDY WORKSPACE'}</p><h1>{publicCatalog ? 'Course chapters' : 'Chapter library'}</h1><p>{chapterNotesEnabled ? 'Browse published chapter notes and practice questions.' : 'Browse chapters with published practice questions. Chapter notes are coming soon.'}</p></div>
    <label className="library-search">Search chapters<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search by chapter" /></label>
    {chapterNotesEnabled && <section><h2>Chapter notes</h2><ErrorMessage text={notesError}/>{notesError && <button className="outline-button" type="button" onClick={loadNotes}>Try again</button>}
      {!notes && !notesError ? <p role="status">Loading chapter notes...</p> : filteredNotes && (filteredNotes.length ? <ul className="library-list">{filteredNotes.map(chapter => <li key={chapter.id}><Link to={'/app/chapters/' + chapter.id}><strong>{chapter.title}</strong><span>Read notes</span><span aria-hidden="true">→</span></Link></li>)}</ul> : <p>{notes?.length ? 'No chapter notes match your search.' : 'No chapter notes are published yet.'}</p>)}
    </section>}
    {chapterNotesEnabled && <h2>Practice chapters</h2>}
    <ErrorMessage text={error}/>
    {error && <button className="outline-button" type="button" onClick={load} disabled={loading}>Try again</button>}
    {loading ? <p role="status">Loading chapters...</p> : !error && (filtered.length ? <ul className="library-list">
      {filtered.map(chapter => <li key={chapter.name}><Link to={publicCatalog ? '/course/' + encodeURIComponent(chapter.name) : '/practice?chapter=' + encodeURIComponent(chapter.name)}>
        <span><strong>{chapter.name}</strong><small>Single-best-answer practice</small></span><span>{chapter.questionCount} {chapter.questionCount === 1 ? 'question' : 'questions'}</span><span aria-hidden="true">→</span>
      </Link></li>)}
    </ul> : <p>{chapters.length ? 'No chapters match your search.' : 'No published chapters are available yet.'}</p>)}
  </ScreenLayout>
}
