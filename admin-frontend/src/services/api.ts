export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

export async function api<T>(path: string, init: RequestInit = {}, admin = false, student = false): Promise<T> {
  const response = await fetch((import.meta.env.VITE_API_URL ?? '') + '/api' + path, {
    ...init, headers: { 'Content-Type': 'application/json', ...(admin ? { Authorization: 'Bearer ' + sessionStorage.getItem('rp-admin') } : {}), ...(student ? { Authorization: 'Bearer ' + sessionStorage.getItem('rp-student') } : {}), ...init.headers },
  })
  const body = await response.json()
  if (!response.ok) {
    if (admin && response.status === 401) sessionStorage.removeItem('rp-admin')
    if (student && response.status === 401) {
      sessionStorage.removeItem('rp-student')
      sessionStorage.removeItem('rp-student-email')
    }
    if ((admin || student) && response.status === 401) window.dispatchEvent(new CustomEvent('royalprep-session-expired', { detail: admin ? 'admin' : 'student' }))
    throw new ApiError(body.error ?? 'Request failed.', response.status)
  }
  return body
}
