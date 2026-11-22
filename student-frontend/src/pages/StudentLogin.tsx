import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ErrorMessage } from '../components/ErrorMessage'
import { ScreenLayout } from '../components/ScreenLayout'
import { api } from '../services/api'

type OtpRequest = { message: string; expiresInSeconds: number }
type OtpVerification = { token: string; user: { email: string }; expiresAt: number }
type StudentSession = { user: { email: string } }

export function StudentLogin() {
  const [email, setEmail] = useState('')
  const [pendingEmail, setPendingEmail] = useState('')
  const [code, setCode] = useState('')
  const [codeMessage, setCodeMessage] = useState('')
  const [expiresInSeconds, setExpiresInSeconds] = useState(0)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null)
  const navigate = useNavigate()
  const location = useLocation()
  const from = typeof location.state?.from === 'string' && /^\/(?![\/\\])[^\\]*$/.test(location.state.from) ? location.state.from : '/practice'

  useEffect(() => {
    if (!sessionStorage.getItem('rp-student')) return
    api<StudentSession>('/auth/session', {}, false, true)
      .then(result => setSignedInEmail(result.user.email))
      .catch(e => setError((e as Error).message))
  }, [])

  async function requestCode(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true); setError('')
    try {
      const result = await api<OtpRequest>('/auth/otp/request', {
        method: 'POST',
        body: JSON.stringify({ email }),
      })
      setPendingEmail(email.trim().toLowerCase())
      setCodeMessage(result.message)
      setExpiresInSeconds(result.expiresInSeconds)
      setCode('')
    } catch (e) { setError((e as Error).message) }
    finally { setBusy(false) }
  }

  async function verifyCode(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true); setError('')
    try {
      const result = await api<OtpVerification>('/auth/otp/verify', {
        method: 'POST',
        body: JSON.stringify({ email: pendingEmail, code }),
      })
      sessionStorage.setItem('rp-student', result.token)
      sessionStorage.setItem('rp-student-email', result.user.email)
      navigate(from, { replace: true })
    } catch (e) { setError((e as Error).message) }
    finally { setBusy(false) }
  }

  async function signOut() {
    setBusy(true); setError('')
    try {
      await api('/auth/logout', { method: 'POST' }, false, true)
      sessionStorage.removeItem('rp-student')
      sessionStorage.removeItem('rp-student-email')
      setSignedInEmail(null)
    } catch (e) {
      setError((e as Error).message)
      if (!sessionStorage.getItem('rp-student')) setSignedInEmail(null)
    } finally { setBusy(false) }
  }

  return <ScreenLayout navigation={false}>
    <section className="screen-card narrow">
      {signedInEmail ? <>
        <p className="screen-kicker">STUDENT ACCOUNT</p>
        <h1>Signed in</h1>
        <p>You are signed in as <strong>{signedInEmail}</strong>.</p>
        <p><Link className="screen-button" to="/practice">Continue to practice</Link></p>
        <ErrorMessage text={error}/><button className="outline-button" type="button" disabled={busy} onClick={signOut}>Sign out</button>
      </> : <>
        <p className="screen-kicker">STUDENT ACCOUNT</p>
        <h1>{pendingEmail ? 'Enter your code' : 'Student sign-in or sign-up'}</h1>
        <p>Request a verification code to sign in or create your account.</p>
        {pendingEmail ? <form onSubmit={verifyCode}>
          <p>Code requested for <strong>{pendingEmail}</strong>.</p>
          <label>Six-digit code<input required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} /></label>
          {codeMessage && <p className="verification-notice" role="status">{codeMessage} The code expires in {Math.ceil(expiresInSeconds / 60)} minutes.</p>}
          <ErrorMessage text={error}/>
          <button className="screen-button" disabled={busy || code.length !== 6}>Verify code</button>
          <button className="outline-button" type="button" disabled={busy} onClick={() => { setPendingEmail(''); setCodeMessage(''); setError('') }}>Use a different email</button>
        </form> : <form onSubmit={requestCode}>
          <label>Email address<input required type="email" autoComplete="email" maxLength={254} value={email} onChange={event => setEmail(event.target.value)} /></label>
          <ErrorMessage text={error}/>
          <button className="screen-button" disabled={busy}>Request code</button>
        </form>}
      </>}
    </section>
  </ScreenLayout>
}
