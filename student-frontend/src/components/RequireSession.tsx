import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { api, ApiError } from '../services/api'
import { ErrorMessage } from './ErrorMessage'
import { ScreenLayout } from './ScreenLayout'

export function RequireSession({ admin = false, children }: { admin?: boolean; children: ReactNode }) {
  const [status, setStatus] = useState<'loading' | 'allowed' | 'unauthorized' | 'error'>('loading')
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const location = useLocation()
  useEffect(() => {
    function expired(event: Event) {
      if (event instanceof CustomEvent && event.detail === (admin ? 'admin' : 'student')) setStatus('unauthorized')
    }
    window.addEventListener('royalprep-session-expired', expired)
    return () => window.removeEventListener('royalprep-session-expired', expired)
  }, [admin])
  useEffect(() => {
    let active = true
    const key = admin ? 'rp-admin' : 'rp-student'
    if (!sessionStorage.getItem(key)) {
      setStatus('unauthorized')
      return
    }
    setStatus('loading')
    api(admin ? '/admin/session' : '/auth/session', {}, admin, !admin)
      .then(() => { if (active) setStatus('allowed') })
      .catch((err: unknown) => {
        if (!active) return
        if (err instanceof ApiError && err.status === 401) setStatus('unauthorized')
        else { setError(err instanceof Error ? err.message : 'Session verification failed.'); setStatus('error') }
      })
    return () => { active = false }
  }, [admin, attempt])
  if (status === 'unauthorized') return <Navigate to={admin ? '/admin' : '/sign-in'} state={{ from: location.pathname + location.search }} replace />
  if (status === 'allowed') return children
  return <ScreenLayout admin={admin} navigation={false}><section className="screen-card">
    {status === 'loading' ? <p role="status">Checking your session...</p> : <>
      <h1>Unable to check your session</h1><ErrorMessage text={error}/>
      <button className="outline-button" type="button" onClick={() => setAttempt(value => value + 1)}>Try again</button>
    </>}
  </section></ScreenLayout>
}
