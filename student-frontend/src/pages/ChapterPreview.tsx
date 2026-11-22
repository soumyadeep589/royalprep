import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ErrorMessage } from '../components/ErrorMessage'
import { ScreenLayout } from '../components/ScreenLayout'
import { api } from '../services/api'

type Chapter = { name: string; questionCount: number }

export function ChapterPreview() {
  const { chapter } = useParams()
  const [chapters, setChapters] = useState<Chapter[]>()
  const [error, setError] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    api<Chapter[]>('/public/chapters', { signal: controller.signal }).then(setChapters)
      .catch(e => { if (!controller.signal.aborted) setError((e as Error).message) })
    return () => controller.abort()
  }, [])
  const item = chapters?.find(value => value.name === chapter)
  return <ScreenLayout><p className="screen-kicker">COURSE CATALOG</p>
    <Link to="/course">← All chapters</Link>
    <ErrorMessage text={error}/>
    {!chapters && !error ? <p role="status">Loading chapter...</p> : item ? <section className="screen-card">
      <h1>{item.name}</h1>
      <p>{item.questionCount} published practice {item.questionCount === 1 ? 'question' : 'questions'} available.</p>
      <p>Chapter notes and approved samples are not available yet.</p>
      <Link className="screen-button" to={'/practice?chapter=' + encodeURIComponent(item.name)}>Practice this chapter</Link>
    </section> : !error && <section className="screen-card"><h1>Chapter not found</h1><p>This chapter is not currently published.</p></section>}
  </ScreenLayout>
}
