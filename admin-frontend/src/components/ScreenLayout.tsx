import type { ReactNode } from 'react'
import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import brandMark from '../assets/royalprep-mark.svg'

export function ScreenLayout({ children, admin = false, navigation = true }: { children: ReactNode; admin?: boolean; navigation?: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const chapterNotesEnabled = import.meta.env.VITE_CHAPTER_NOTES_ENABLED === 'true'
  return <div className={'screen-layout' + (admin ? ' screen-admin' : '')}>
    <header className="screen-header">
      <Link to={admin ? '/admin' : '/'} className="screen-brand"><img className="brand-mark" src={brandMark} alt=""/><span>Royal<span>Prep</span></span></Link>
      <div className="screen-header-actions"><span className="header-badge">{admin ? 'ADMIN' : 'MRCS PART A'}</span>
        {navigation && <button className="screen-menu-toggle" type="button" aria-expanded={menuOpen} aria-controls="screen-navigation" onClick={() => setMenuOpen(value => !value)}>{menuOpen ? 'Close menu' : 'Menu'}</button>}
      </div>
    </header>
    <div className={'screen-body' + (navigation ? '' : ' screen-body-no-sidebar')}>
      {navigation && <nav id="screen-navigation" aria-label={admin ? 'Admin navigation' : 'Student navigation'} className={'screen-sidebar' + (menuOpen ? ' screen-sidebar-open' : '')} onClick={() => setMenuOpen(false)}>
        <p className="sidebar-label">{admin ? 'ADMIN' : 'PRACTICE'}</p>
        {admin ? <><NavLink to="/admin/dashboard">Dashboard</NavLink><NavLink to="/admin/questions">Question bank</NavLink><NavLink to="/admin/content/hero">Homepage hero</NavLink>{chapterNotesEnabled && <NavLink to="/admin/content/chapters">Chapter notes</NavLink>}<NavLink to="/admin/communications">Reports</NavLink></> : <><NavLink to="/app" end>Dashboard</NavLink><NavLink to="/course">Course chapters</NavLink><NavLink to="/study/library">Chapter library</NavLink><NavLink to="/practice">Practice</NavLink><NavLink to="/app/mocks">Mocks</NavLink><NavLink to="/app/results">Results</NavLink><NavLink to="/app/mistakes">My mistakes</NavLink><NavLink to="/app/flashcards">Flashcards</NavLink><NavLink to="/tools">Study tools</NavLink><NavLink to="/app/profile">Profile and privacy</NavLink><NavLink to="/sign-in">Student account</NavLink></>}
      </nav>}
      <main className="screen-content">{children}</main>
    </div>
  </div>
}
