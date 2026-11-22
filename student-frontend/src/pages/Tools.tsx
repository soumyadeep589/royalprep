import { Link } from 'react-router-dom'
import { ScreenLayout } from '../components/ScreenLayout'
import './study-planner.css'

export function Tools() {
  return <ScreenLayout><p className="screen-kicker">FREE RESOURCES</p><h1>Study tools</h1><p>Explore the tools available for your preparation.</p>
    <div className="tools-grid">
      <section className="screen-card"><h2>Study planner</h2><p>Build and edit a schedule around your target date.</p><Link className="screen-button" to="/tools/planner">Open planner</Link></section>
      <section className="screen-card"><h2>Chapter catalog</h2><p>Search chapters with published practice questions.</p><Link className="outline-button" to="/course">Browse chapters</Link></section>
      <section className="screen-card"><h2>Personal flashcards</h2><p>Create cards and schedule your reviews after signing in.</p><Link className="outline-button" to="/tools/flashcards">Open flashcards</Link></section>
      <section className="screen-card"><h2>More tools</h2><p>Eligibility, exam dates and the daily quiz are not available yet.</p></section>
    </div>
  </ScreenLayout>
}
