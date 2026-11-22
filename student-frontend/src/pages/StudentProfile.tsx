import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ErrorMessage } from '../components/ErrorMessage'
import { ScreenLayout } from '../components/ScreenLayout'
import { api } from '../services/api'

export function StudentProfile() {
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [deleted, setDeleted] = useState(false)
  const [error, setError] = useState('')

  async function deactivate(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true); setError('')
    try {
      await api('/auth/delete', { method: 'POST', body: JSON.stringify({ confirmation }) }, false, true)
      sessionStorage.removeItem('rp-student')
      sessionStorage.removeItem('rp-student-email')
      setDeleted(true)
    } catch (e) { setError(e instanceof Error ? e.message : 'Account deactivation failed.') }
    finally { setBusy(false) }
  }

  return <ScreenLayout navigation={!deleted}>
    <p className="screen-kicker">STUDENT ACCOUNT</p>
    <h1>Profile and privacy</h1>
    {deleted ? <section className="screen-card">
      <h2>Account deactivated</h2>
      <p>Your account cannot sign in, and your records are retained. Automatic restoration is not available.</p>
      <Link className="outline-button" to="/">Return to home</Link>
    </section> : <section className="screen-card">
      <h2>Deactivate account</h2>
      <p>This immediately prevents sign-in and signs out your sessions. Your account and all records are retained; they are not erased. Automatic restoration is not available.</p>
      <form onSubmit={deactivate}>
        <label>Type DELETE to confirm<input value={confirmation} onChange={event => setConfirmation(event.target.value)} autoComplete="off" disabled={busy}/></label>
        <ErrorMessage text={error}/>
        <button className="outline-button" disabled={busy || confirmation !== 'DELETE'}>{busy ? 'Deactivating...' : 'Deactivate account'}</button>
      </form>
    </section>}
  </ScreenLayout>
}
