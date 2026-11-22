import { useCallback, useEffect, useState } from 'react'
import { ErrorMessage } from '../components/ErrorMessage'
import { ScreenLayout } from '../components/ScreenLayout'
import { api } from '../services/api'
import './flashcards.css'

type Card = { id: string; version: number; chapter: string; front: string; back: string; dueAt: number; intervalDays: number }
type Rating = 'again' | 'hard' | 'good' | 'easy'
type PendingReview = { cardId: string; eventId: string; expectedVersion: number; rating: Rating }

export function Flashcards() {
  const [cards, setCards] = useState<Card[]>()
  const [offset, setOffset] = useState(0)
  const [clock, setClock] = useState(Date.now())
  const [chapter, setChapter] = useState('')
  const [showAll, setShowAll] = useState(false)
  const [flipped, setFlipped] = useState<string[]>([])
  const [front, setFront] = useState('')
  const [back, setBack] = useState('')
  const [newChapter, setNewChapter] = useState('')
  const [pending, setPending] = useState<PendingReview | null>(null)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const result = await api<{ cards: Card[]; serverTime: number }>('/student/flashcards', {}, false, true)
      setCards(result.cards); setOffset(result.serverTime - Date.now()); setClock(Date.now()); setPending(null)
    } catch (e) { setError((e as Error).message) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])
  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [])
  const now = clock + offset
  const due = cards?.filter(card => card.dueAt <= now).length ?? 0
  const chapters = [...new Set(cards?.map(card => card.chapter) ?? [])].sort()
  const visible = cards?.filter(card => (!chapter || card.chapter === chapter) && (showAll || card.dueAt <= now)) ?? []
  async function create(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('')
    try {
      const card = await api<Card>('/student/flashcards', { method: 'POST', body: JSON.stringify({ chapter: newChapter, front, back }) }, false, true)
      const receivedAt = Date.now()
      setCards(current => [...(current ?? []), card]); setNewChapter(''); setFront(''); setBack(''); setOffset(card.dueAt - receivedAt); setClock(receivedAt); setMessage('Card created.')
    } catch (e) { setError((e as Error).message) }
    finally { setBusy(false) }
  }
  async function review(review: PendingReview) {
    setPending(review); setBusy(true); setError(''); setMessage('')
    try {
      const card = await api<Card>(`/student/flashcards/${encodeURIComponent(review.cardId)}/review`, { method: 'POST', body: JSON.stringify({ eventId: review.eventId, expectedVersion: review.expectedVersion, rating: review.rating }) }, false, true)
      setCards(current => current?.map(item => item.id === card.id ? card : item))
      setFlipped(current => current.filter(id => id !== card.id)); setPending(null); setClock(Date.now()); setMessage(`Review saved. Next due ${new Date(card.dueAt).toLocaleString()}.`)
    } catch (e) { setError((e as Error).message) }
    finally { setBusy(false) }
  }
  async function remove(card: Card) {
    if (!window.confirm('Remove this personal flashcard?')) return
    setBusy(true); setError(''); setMessage('')
    try {
      await api(`/student/flashcards/${encodeURIComponent(card.id)}`, { method: 'DELETE', body: JSON.stringify({ expectedVersion: card.version }) }, false, true)
      setCards(current => current?.filter(item => item.id !== card.id)); setMessage('Card removed.')
    } catch (e) { setError((e as Error).message) }
    finally { setBusy(false) }
  }
  return <ScreenLayout><p className="screen-kicker">RETAIN AND REVIEW</p><h1>My flashcards</h1><p>Create personal cards and review them across sessions. Approved shared decks are not available yet.</p>
    <ErrorMessage text={error}/>{message && <p className="screen-message" role="status">{message}</p>}
    {error && <div className="flash-actions">{pending && <button className="outline-button" type="button" disabled={busy} onClick={() => review(pending)}>Retry review</button>}<button className="outline-button" type="button" disabled={busy} onClick={load}>Reload cards</button></div>}
    {loading ? <p role="status">Loading flashcards...</p> : cards && <>
      <form className="screen-card flash-create" onSubmit={create}><h2>Create a personal card</h2>
        <label>Chapter<input required maxLength={120} disabled={busy || Boolean(pending)} value={newChapter} onChange={event => setNewChapter(event.target.value)}/></label>
        <label>Front<textarea required maxLength={1000} disabled={busy || Boolean(pending)} value={front} onChange={event => setFront(event.target.value)}/></label>
        <label>Back<textarea required maxLength={3000} disabled={busy || Boolean(pending)} value={back} onChange={event => setBack(event.target.value)}/></label>
        <button className="screen-button" disabled={busy || Boolean(pending)}>Add card</button>
      </form>
      <div className="flash-heading"><div><h2>Review cards</h2><p>{due} due · {cards.length} total</p></div><label>Chapter<select value={chapter} onChange={event => setChapter(event.target.value)}><option value="">All chapters</option>{chapters.map(value => <option key={value} value={value}>{value}</option>)}</select></label><label className="check"><input type="checkbox" checked={showAll} onChange={event => setShowAll(event.target.checked)}/> Show all cards</label></div>
      {visible.length ? <ul className="flash-list">{visible.map(card => <li className="screen-card" key={card.id}><div className="flash-card-head"><strong>{card.chapter}</strong><small>{card.dueAt <= now ? 'Due now' : `Due ${new Date(card.dueAt).toLocaleString()}`}</small></div>
        <p className="flash-text">{flipped.includes(card.id) ? card.back : card.front}</p><div className="flash-actions"><button className="outline-button" type="button" onClick={() => setFlipped(current => current.includes(card.id) ? current.filter(id => id !== card.id) : [...current, card.id])}>{flipped.includes(card.id) ? 'Show front' : 'Show answer'}</button>
          <button className="outline-button" type="button" disabled={busy || Boolean(pending)} onClick={() => remove(card)}>Remove</button></div>
        {flipped.includes(card.id) && <div className="flash-actions" aria-label="Rate your recall">{(['again', 'hard', 'good', 'easy'] as const).map(rating => <button className="outline-button" type="button" key={rating} disabled={busy || Boolean(pending)} onClick={() => review({ cardId: card.id, eventId: crypto.randomUUID(), expectedVersion: card.version, rating })}>{rating[0].toUpperCase() + rating.slice(1)}</button>)}</div>}
      </li>)}</ul> : <section className="screen-card"><p>{cards.length ? 'No cards match this filter or are due now.' : 'No personal flashcards yet. Create one above.'}</p></section>}
    </>}
  </ScreenLayout>
}
