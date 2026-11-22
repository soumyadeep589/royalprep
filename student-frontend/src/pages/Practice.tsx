import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ScreenLayout } from '../components/ScreenLayout'
import { ErrorMessage } from '../components/ErrorMessage'
import type { PracticeFeedback, PracticeQuestion } from '../models/question'
import { api } from '../services/api'

type SavedAnswer = PracticeFeedback & { questionId: string; questionVersion: number; selected: number }

export function Practice() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const chapter = searchParams.get('chapter')
  const questionId = searchParams.get('question')
  const [questions, setQuestions] = useState<PracticeQuestion[]>([])
  const [savedAnswers, setSavedAnswers] = useState<Record<string, SavedAnswer>>({})
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState<number>()
  const [feedback, setFeedback] = useState<PracticeFeedback>()
  const [explain, setExplain] = useState(false)
  const [reporting, setReporting] = useState(false)
  const [report, setReport] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [authError, setAuthError] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [studentEmail, setStudentEmail] = useState<string | null>(null)
  const loadVersion = useRef(0)
  const load = useCallback(async () => {
    const request = ++loadVersion.current
    setLoading(true); setError('')
    try {
      const [all, answers] = await Promise.all([
        api<PracticeQuestion[]>('/practice/questions' + (chapter ? '?chapter=' + encodeURIComponent(chapter) : ''), {}, false, true),
        api<SavedAnswer[]>('/practice/answers', {}, false, true),
      ])
      if (request !== loadVersion.current) return
      const visible = questionId ? all.filter(item => item.id === questionId) : all
      const saved = Object.fromEntries(answers.map(answer => [answer.questionId, answer]))
      const first = visible[0]
      const answer = first && saved[first.id]?.questionVersion === first.version ? saved[first.id] : undefined
      setQuestions(visible); setSavedAnswers(saved); setIndex(0); setSelected(answer?.selected); setFeedback(answer)
      setExplain(false); setReporting(false); setReport(''); setMessage('')
    }
    catch (e) { if (request === loadVersion.current) { setQuestions([]); setError(e instanceof Error ? e.message : 'Unable to load practice.') } }
    finally { if (request === loadVersion.current) setLoading(false) }
  }, [chapter, questionId])
  useEffect(() => { void load(); return () => { loadVersion.current++ } }, [load])
  useEffect(() => {
    if (!sessionStorage.getItem('rp-student')) return
    api<{ user: { email: string } }>('/auth/session', {}, false, true)
      .then(result => { setStudentEmail(result.user.email); setAuthError('') })
      .catch(e => {
        if (sessionStorage.getItem('rp-student')) setAuthError((e as Error).message)
        else setStudentEmail(null)
      })
  }, [])
  const question = questions[index]
  async function submit() {
    if (!question || selected === undefined) return
    setBusy(true); setError('')
    try {
      const result = await api<PracticeFeedback>(`/practice/questions/${encodeURIComponent(question.id)}/answer`, { method: 'POST', body: JSON.stringify({ version: question.version, option: selected }) }, false, true)
      setFeedback(result)
      setSavedAnswers(current => ({ ...current, [question.id]: { ...result, questionId: question.id, questionVersion: question.version, selected } }))
    }
    catch (e) { setError((e as Error).message) }
    finally { setBusy(false) }
  }
  async function sendReport(event: React.FormEvent) {
    event.preventDefault()
    if (!question) return
    setBusy(true); setError(''); setMessage('')
    try {
      await api(`/practice/questions/${encodeURIComponent(question.id)}/reports`, { method: 'POST', body: JSON.stringify({ version: question.version, message: report }) }, false, true)
      setReport(''); setReporting(false); setMessage('Report sent. Thank you.')
    } catch (e) { setError((e as Error).message) }
    finally { setBusy(false) }
  }
  function next() {
    const nextIndex = (index + 1) % questions.length
    const nextQuestion = questions[nextIndex]
    const answer = nextQuestion && savedAnswers[nextQuestion.id]?.questionVersion === nextQuestion.version ? savedAnswers[nextQuestion.id] : undefined
    setIndex(nextIndex); setSelected(answer?.selected); setFeedback(answer)
    setExplain(false); setReporting(false); setReport(''); setMessage(''); setError('')
  }
  async function signOut() {
    setBusy(true); setAuthError('')
    try {
      await api('/auth/logout', { method: 'POST' }, false, true)
      sessionStorage.removeItem('rp-student')
      sessionStorage.removeItem('rp-student-email')
      setQuestions([])
      navigate('/sign-in', { replace: true })
    } catch (e) { setAuthError((e as Error).message) }
    finally { setBusy(false) }
  }
  return <ScreenLayout>
    <div className="practice-heading"><div><p className="screen-kicker">QUESTION PRACTICE</p><h1>Practice</h1></div>{question && <span className="counter">QUESTION {index + 1} OF {questions.length}</span>}</div>
    {chapter && <p>Chapter: {chapter} · <Link to="/study/library">All chapters</Link></p>}
    <div className="practice-account">{studentEmail ? <><span>Signed in as {studentEmail}</span><button className="outline-button" disabled={busy} onClick={signOut}>Sign out</button></> : <Link to="/sign-in">Student sign-in</Link>}</div>
    <ErrorMessage text={authError}/>
    <div className="progress-track"><div style={{ width: questions.length ? `${(index + 1) / questions.length * 100}%` : '0%' }} /></div>
    <ErrorMessage text={error}/>{error && <button className="outline-button" onClick={load} disabled={loading || busy}>Reload questions</button>}{message && <p role="status" className="screen-message">{message}</p>}
    {loading ? <p>Loading questions...</p> : !question ? !error && <div className="screen-card"><p>{questionId ? 'This question is not currently available.' : 'No published questions are available yet.'}</p><button className="screen-button" onClick={load}>Try again</button></div> : <>
      <section className="screen-card question-card">
        <div className="question-meta"><span className="topic-badge">{question.chapter}</span><span>Single best answer</span></div>
        <p className="question-stem">{question.stem}</p>
        <fieldset disabled={busy || Boolean(feedback)}><legend className="sr-only">Choose one answer</legend>
          {question.options.map((option, i) => <label className={'practice-option' + (selected === i ? ' chosen' : '') + (feedback?.correct === i ? ' correct' : '')} key={i}>
            <input type="radio" name="practice-answer" checked={selected === i} onChange={() => setSelected(i)} />
            <span className="option-letter">{String.fromCharCode(65 + i)}</span><span>{option}</span>
          </label>)}
        </fieldset>
        <button className="screen-button" disabled={selected === undefined || busy || Boolean(feedback)} onClick={submit}>Submit answer</button>
        {feedback && <p role="status" className={feedback.isCorrect ? 'answer-correct' : 'answer-incorrect'}>{feedback.isCorrect ? 'Correct!' : `Incorrect. The correct answer is ${String.fromCharCode(65 + feedback.correct)}.`}</p>}
        {feedback && explain && <div className="explanation"><strong>Explanation</strong><p>{feedback.explanation}</p></div>}
        {feedback && <button className="outline-button" type="button" disabled={busy} onClick={() => { setSelected(undefined); setFeedback(undefined); setExplain(false); setError('') }}>Try this question again</button>}
      </section>
      <div className="practice-actions">
        <button className="outline-button" disabled={!feedback} onClick={() => setExplain(value => !value)}>{explain ? 'Hide explanation' : 'Explain this'}</button>
        <button className="outline-button" onClick={() => { setReporting(value => !value); setMessage('') }}>Report an error</button>
        <button className="screen-button" onClick={next} disabled={busy || questions.length < 2}>Next question →</button>
      </div>
      {reporting && <form className="screen-card report-form" onSubmit={sendReport}><label>What should we review?<textarea value={report} onChange={e => setReport(e.target.value)} required maxLength={500} /></label><button className="screen-button" disabled={busy}>Send report</button></form>}
    </>}
  </ScreenLayout>
}
