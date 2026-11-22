import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ScreenLayout } from '../components/ScreenLayout'
import { ErrorMessage } from '../components/ErrorMessage'
import { api } from '../services/api'

export function AdminLogin() {
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [challenge, setChallenge] = useState('')
  const [codeMessage, setCodeMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [checking, setChecking] = useState(Boolean(sessionStorage.getItem('rp-admin')))
  const navigate = useNavigate()
  const location = useLocation()
  const from = typeof location.state?.from === 'string' && /^\/admin\/(?![\/\\])[^\\]*$/.test(location.state.from) ? location.state.from : '/admin/dashboard'
  useEffect(() => {
    if (!sessionStorage.getItem('rp-admin')) return
    api('/admin/session', {}, true)
      .then(() => navigate(from, { replace: true }))
      .catch(e => { setError((e as Error).message); setChecking(false) })
  }, [from, navigate])
  async function requestCode(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError('')
    try {
      const response = await api<{ challenge: string; message: string }>('/admin/otp/request', { method: 'POST', body: JSON.stringify({ password }) })
      setChallenge(response.challenge)
      setCodeMessage(response.message)
      setPassword('')
    } catch (e) { setError((e as Error).message) }
    finally { setBusy(false) }
  }
  async function login(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError('')
    try {
      const response = await api<{ token: string }>('/admin/login', { method: 'POST', body: JSON.stringify({ challenge, code }) })
      sessionStorage.setItem('rp-admin', response.token)
      navigate(from, { replace: true })
    } catch (e) { setError((e as Error).message) }
    finally { setBusy(false) }
  }
  return <ScreenLayout admin navigation={false}><section className="screen-card narrow"><h1>Admin sign-in</h1><p>Enter your password and verification code to sign in.</p>{checking ? <p role="status">Checking your session...</p> : challenge ? <form onSubmit={login}><p role="status">{codeMessage}</p><label>Verification code<input required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}/></label><ErrorMessage text={error}/><button className="screen-button" disabled={busy || code.length !== 6}>Sign in</button><button className="outline-button" type="button" disabled={busy} onClick={() => { setChallenge(''); setCode(''); setCodeMessage(''); setError('') }}>Start again</button></form> : <form onSubmit={requestCode}><label>Admin password<input type="password" required value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password"/></label><ErrorMessage text={error}/><button className="screen-button" disabled={busy}>Request code</button></form>}</section></ScreenLayout>
}
