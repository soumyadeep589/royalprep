import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ErrorMessage } from '../components/ErrorMessage'
import { ScreenLayout } from '../components/ScreenLayout'
import type { Question, QuestionReport } from '../models/question'
import { api } from '../services/api'

const csvHeader = 'chapter,published,stem,option_a,option_b,option_c,option_d,correct,explanation,source'
const emptyQuestion = (): Question => ({ id: '', version: 0, chapter: '', published: false, stem: '', options: ['', '', '', ''], correct: 0, explanation: '' })

export function QuestionBank() {
  const [questions, setQuestions] = useState<Question[]>([])
  const [reports, setReports] = useState<QuestionReport[]>([])
  const [selection, setSelection] = useState<Question>()
  const [query, setQuery] = useState('')
  const [chapter, setChapter] = useState('')
  const [status, setStatus] = useState('')
  const [source, setSource] = useState('')
  const [file, setFile] = useState<File>()
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [signedIn, setSignedIn] = useState(Boolean(sessionStorage.getItem('rp-admin')))
  const load = useCallback(async () => {
    const [nextQuestions, nextReports] = await Promise.all([api<Question[]>('/admin/questions', {}, true), api<QuestionReport[]>('/admin/question-reports', {}, true)])
    setQuestions(nextQuestions); setReports(nextReports)
  }, [])
  useEffect(() => {
    if (!signedIn) { setLoading(false); return }
    load().catch(e => { setError((e as Error).message); setSignedIn(Boolean(sessionStorage.getItem('rp-admin'))) }).finally(() => setLoading(false))
  }, [signedIn, load])
  const rows = useMemo(() => questions.map(question => ({
    question, reports: reports.filter(report => report.questionId === question.id),
  })), [questions, reports])
  const chapters = [...new Set(questions.map(q => q.chapter))].sort()
  const sources = [...new Set(questions.map(q => q.source || 'Unspecified'))].sort()
  const filtered = rows.filter(({ question: q }) => {
    const text = `${q.stem} ${q.chapter} ${q.id}`.toLowerCase()
    return text.includes(query.toLowerCase()) && (!chapter || q.chapter === chapter) &&
      (!status || (status === 'published') === q.published) && (!source || (q.source || 'Unspecified') === source)
  })
  async function save(event: React.FormEvent) {
    event.preventDefault()
    if (!selection) return
    setBusy(true); setError(''); setMessage('')
    try {
      const body = { ...selection, source: selection.source?.trim() || undefined }
      const updated = await api<Question>(selection.id ? '/admin/questions/' + encodeURIComponent(selection.id) : '/admin/questions', { method: selection.id ? 'PUT' : 'POST', body: JSON.stringify(body) }, true)
      setSelection(updated); await load(); setMessage('Question saved.')
    } catch (e) { setError((e as Error).message); setSignedIn(Boolean(sessionStorage.getItem('rp-admin'))) }
    finally { setBusy(false) }
  }
  async function importCsv(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!file) return
    const form = event.currentTarget
    setBusy(true); setError(''); setMessage('')
    try {
      if (file.size > 100_000) throw Error('CSV must be 100 KB or smaller.')
      const result = await api<{ count: number }>('/admin/questions/import', { method: 'POST', body: JSON.stringify({ csv: await file.text() }) }, true)
      setFile(undefined); setSelection(undefined); await load(); setMessage(`Imported ${result.count} questions.`)
      form.reset()
    } catch (e) { setError((e as Error).message); setSignedIn(Boolean(sessionStorage.getItem('rp-admin'))) }
    finally { setBusy(false) }
  }
  async function signOut() {
    setBusy(true); setError('')
    try {
      await api('/admin/logout', { method: 'POST' }, true)
      sessionStorage.removeItem('rp-admin')
      setSignedIn(false); setSelection(undefined); setQuestions([]); setReports([])
    } catch (e) { setError((e as Error).message) }
    finally { setBusy(false) }
  }
  const selectedReports = selection ? reports.filter(r => r.questionId === selection.id) : []
  return <ScreenLayout admin>
    {!signedIn ? <section className="screen-card"><h1>Question bank</h1><p>Sign in to manage questions.</p><Link className="screen-button" to="/admin">Admin sign-in</Link></section> : <>
      <div className="bank-heading"><div><p className="screen-kicker">ADMIN</p><h1>Question bank</h1><p>Every MCQ, its status, source and student reports.</p></div><div className="bank-actions"><button className="screen-button" onClick={() => { setSelection(emptyQuestion()); setError(''); setMessage('') }}>Add question</button><a className="outline-button" href={'data:text/csv;charset=utf-8,' + encodeURIComponent(csvHeader + '\n')} download="questions-template.csv">Download CSV template</a><button className="outline-button" disabled={busy} onClick={signOut}>Sign out</button></div></div>
      <form className="import-bar" onSubmit={importCsv}><label>Import questions CSV<input type="file" accept=".csv,text/csv" onChange={e => setFile(e.target.files?.[0])} /></label><button className="screen-button" disabled={!file || busy}>Import MCQ CSV</button></form>
      <p className="import-hint">One question per row. Use true/false for published and A, B, C or D for correct. Source is optional.</p>
      <ErrorMessage text={error}/>{message && <p role="status" className="screen-message">{message}</p>}
      <div className="bank-filters">
        <label><span className="sr-only">Search stem, chapter or ID</span><input placeholder="Search stem, chapter or ID" value={query} onChange={e => setQuery(e.target.value)}/></label>
        <label><span className="sr-only">Chapter</span><select value={chapter} onChange={e => setChapter(e.target.value)}><option value="">All chapters</option>{chapters.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
        <label><span className="sr-only">Status</span><select value={status} onChange={e => setStatus(e.target.value)}><option value="">Any status</option><option value="published">Published</option><option value="draft">Draft</option></select></label>
        <label><span className="sr-only">Source</span><select value={source} onChange={e => setSource(e.target.value)}><option value="">Any source</option>{sources.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
      </div>
      <div className="bank-grid">
        <div className="bank-list">
          <div className="bank-list-header"><span>ID / SOURCE</span><span>QUESTION</span><span>STATUS</span><span>REPORTS</span></div>
          {loading ? <p>Loading questions...</p> : filtered.length === 0 ? <p>No questions match these filters.</p> : filtered.map(row => <button type="button" className={'bank-row' + (selection?.id === row.question.id ? ' active' : '')} key={row.question.id} onClick={() => { setSelection(structuredClone(row.question)); setError(''); setMessage('') }}>
            <span className="bank-id-cell"><strong className="question-id">{row.question.id.slice(0, 8)}{row.question.id.includes('-') ? '-' + (Number(row.question.id.split('-').at(-1)) + 1) : ''}</strong><small>{row.question.source || 'Unspecified'}</small></span><span className="row-stem">{row.question.stem}</span><span className="bank-status-cell"><span className={'status-badge ' + (row.question.published ? 'published' : 'draft')}>{row.question.published ? 'PUBLISHED' : 'DRAFT'}</span></span><span className="bank-report-cell">{row.reports.length || '–'}</span>
          </button>)}
        </div>
        <aside className="bank-detail screen-card">
          {!selection ? <p>Click a question to edit it, or add a new question.</p> : <form onSubmit={save}>
            <h2>{selection.id ? 'Edit question' : 'New question'}</h2>
            <label>Chapter<input required maxLength={120} value={selection.chapter} onChange={e => setSelection({ ...selection, chapter: e.target.value })}/></label>
            <label className="check"><input type="checkbox" checked={selection.published} onChange={e => setSelection({ ...selection, published: e.target.checked })}/> Published and available to students</label>
            <label>Question text<textarea required minLength={5} maxLength={3000} value={selection.stem} onChange={e => setSelection({ ...selection, stem: e.target.value })}/></label>
            {selection.options.map((option, i) => <label key={i}>Option {String.fromCharCode(65 + i)}<input required maxLength={1000} value={option} onChange={e => setSelection({ ...selection, options: selection.options.map((text, j) => j === i ? e.target.value : text) })}/></label>)}
            <label>Correct answer<select value={selection.correct} onChange={e => setSelection({ ...selection, correct: Number(e.target.value) })}>{selection.options.map((_, i) => <option value={i} key={i}>Option {String.fromCharCode(65 + i)}</option>)}</select></label>
            <label>Explanation<textarea required maxLength={5000} value={selection.explanation} onChange={e => setSelection({ ...selection, explanation: e.target.value })}/></label>
            <label>Source (optional)<input maxLength={100} value={selection.source || ''} onChange={e => setSelection({ ...selection, source: e.target.value })}/></label>
            <button className="screen-button" disabled={busy}>Save question</button>
            {selection.id && <><h2>Student reports</h2>{selectedReports.map(r => <div className="report-entry" key={r.id}><p>{r.message}</p><small>Question version {r.questionVersion} · {new Date(r.createdAt).toLocaleString()}</small><small>Reported question: {r.questionStem}</small></div>)}{selectedReports.length === 0 && <p>No reports for this question.</p>}</>}
          </form>}
        </aside>
      </div>
    </>}
  </ScreenLayout>
}
