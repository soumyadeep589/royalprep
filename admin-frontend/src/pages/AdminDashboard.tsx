import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ErrorMessage } from '../components/ErrorMessage'
import { ScreenLayout } from '../components/ScreenLayout'
import type { Question, QuestionReport } from '../models/question'
import { api } from '../services/api'
import './study-planner.css'

export function AdminDashboard() {
  const [stats, setStats] = useState<{ published: number; drafts: number; reports: number }>()
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    setError(''); setStats(undefined)
    try {
      const [questions, reports] = await Promise.all([api<Question[]>('/admin/questions', {}, true), api<QuestionReport[]>('/admin/question-reports', {}, true)])
      setStats({ published: questions.filter(question => question.published).length, drafts: questions.filter(question => !question.published).length, reports: reports.length })
    } catch (e) { setError((e as Error).message) }
  }, [])
  useEffect(() => { void load() }, [load])
  return <ScreenLayout admin><p className="screen-kicker">ADMIN OVERVIEW</p><h1>Dashboard</h1><p>Current question-bank and report activity.</p>
    <ErrorMessage text={error}/>{error && <button className="outline-button" type="button" onClick={load}>Try again</button>}
    {!stats && !error ? <p role="status">Loading dashboard...</p> : stats && <div className="dashboard-grid">
      <section className="screen-card"><h2>Published questions</h2><p>{stats.published}</p><Link className="outline-button" to="/admin/questions">Question bank</Link></section>
      <section className="screen-card"><h2>Draft questions</h2><p>{stats.drafts}</p><Link className="outline-button" to="/admin/questions">Manage drafts</Link></section>
      <section className="screen-card"><h2>Question reports</h2><p>{stats.reports}</p><Link className="outline-button" to="/admin/communications">View reports</Link></section>
    </div>}
    <p>User analytics, sales and date-filtered metrics are not available yet.</p>
  </ScreenLayout>
}
