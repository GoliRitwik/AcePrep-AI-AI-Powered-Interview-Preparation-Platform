import React, { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { useAuth } from '../../features/auth/hooks/useAuth.js'
import { useInterview } from '../../features/interview/hooks/useInterview.js'
import toast from 'react-hot-toast'
import './Navbar.scss'

const Navbar = () => {
    const { user, handleLogout } = useAuth()
    const { report, reports } = useInterview()
    const location = useLocation()
    const navigate = useNavigate()
    const [mobileOpen, setMobileOpen] = useState(false)

    // Current active report ID (from active report or most recent history)
    const activeReportId = report?._id || (reports && reports.length > 0 ? reports[0]._id : null)

    // Which "zone" are we in?
    const isHome = location.pathname === '/'
    const isReport = location.pathname.startsWith('/interview/') || location.pathname.startsWith('/report/')
    const isMock = location.pathname.startsWith('/mock-interview')

    const handleReportNav = (e, section) => {
        e.preventDefault()
        setMobileOpen(false)
        if (!activeReportId) {
            toast('No active report. Optimize a resume first to view questions & roadmap.', {
                icon: 'ℹ️'
            })
            return
        }

        if (section === 'mock') {
            navigate(`/mock-interview/${activeReportId}`)
        } else {
            navigate(`/interview/${activeReportId}?section=${section}`)
        }
    }

    const isCurrent = (path, section) => {
        if (path === '/' && location.pathname === '/') return true
        if (path === '/history' && location.pathname === '/history') return true
        if (path.startsWith('/interview')) {
            const search = new URLSearchParams(location.search)
            const currentSection = search.get('section') || 'technical'
            return location.pathname.startsWith('/interview') && currentSection === section
        }
        if (path.startsWith('/mock') && location.pathname.startsWith('/mock-interview')) {
            return true
        }
        return false
    }

    // ── Conditional nav links based on current page ──
    const renderNavLinks = (linkClass) => {
        if (isReport || isMock) {
            // Report/mock interview page — show all report section links
            return (
                <>
                    <Link
                        to="/"
                        className={`${linkClass} ${isCurrent('/') ? `${linkClass}--active` : ''}`}
                        onClick={() => setMobileOpen(false)}
                    >
                        ResumeCraft
                    </Link>
                    <a
                        href="#technical"
                        onClick={(e) => handleReportNav(e, 'technical')}
                        className={`${linkClass} ${isCurrent('/interview', 'technical') ? `${linkClass}--active` : ''}`}
                    >
                        Technical Q
                    </a>
                    <a
                        href="#behavioral"
                        onClick={(e) => handleReportNav(e, 'behavioral')}
                        className={`${linkClass} ${isCurrent('/interview', 'behavioral') ? `${linkClass}--active` : ''}`}
                    >
                        Behavioral Q
                    </a>
                    <a
                        href="#skill-gap"
                        onClick={(e) => handleReportNav(e, 'skills')}
                        className={`${linkClass} ${isCurrent('/interview', 'skills') ? `${linkClass}--active` : ''}`}
                    >
                        Skill Gap
                    </a>
                    <a
                        href="#roadmap"
                        onClick={(e) => handleReportNav(e, 'roadmap')}
                        className={`${linkClass} ${isCurrent('/interview', 'roadmap') ? `${linkClass}--active` : ''}`}
                    >
                        Roadmap
                    </a>
                    <a
                        href="#mock-interview"
                        onClick={(e) => handleReportNav(e, 'mock')}
                        className={`${linkClass} ${isCurrent('/mock') ? `${linkClass}--active` : ''}`}
                    >
                        Mock Interview
                    </a>
                </>
            )
        }

        // Home page and all other pages — show ResumeCraft + History
        return (
            <>
                <Link
                    to="/"
                    className={`${linkClass} ${isCurrent('/') ? `${linkClass}--active` : ''}`}
                    onClick={() => setMobileOpen(false)}
                >
                    ResumeCraft
                </Link>
                <Link
                    to="/history"
                    className={`${linkClass} ${isCurrent('/history') ? `${linkClass}--active` : ''}`}
                    onClick={() => setMobileOpen(false)}
                >
                    History
                </Link>
            </>
        )
    }

    return (
        <header className="site-header">
            <div className="navbar-container">
                {/* ── Left: Logo ── */}
                <Link to="/" className="navbar-logo" onClick={() => setMobileOpen(false)}>
                    <svg className="logo-star" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                    <span>AcePrep AI</span>
                </Link>

                {/* ── Center: Navigation Links (only when logged in) ── */}
                {user && (
                    <nav className="navbar-center" aria-label="Main navigation">
                        {renderNavLinks('nav-link')}
                    </nav>
                )}

                {/* ── Right: User status & actions ── */}
                <div className="navbar-right">
                    {user ? (
                        <div className="navbar-user">
                            <span className="user-greeting">Hello, {user.username}</span>
                            <button
                                type="button"
                                className="logout-button"
                                onClick={() => { setMobileOpen(false); handleLogout(); }}
                            >
                                Logout
                            </button>
                        </div>
                    ) : (
                        <div className="navbar-auth-links">
                            <Link to="/login" className="nav-auth-btn nav-auth-btn--login">
                                Login
                            </Link>
                            <Link to="/register" className="nav-auth-btn nav-auth-btn--register">
                                Register
                            </Link>
                        </div>
                    )}

                    {/* Mobile Hamburger toggle */}
                    {user && (
                        <button
                            type="button"
                            className="hamburger-btn"
                            aria-label="Toggle navigation menu"
                            aria-expanded={mobileOpen}
                            onClick={() => setMobileOpen(!mobileOpen)}
                        >
                            {mobileOpen ? '✕' : '☰'}
                        </button>
                    )}
                </div>
            </div>

            {/* ── Mobile dropdown menu ── */}
            {user && mobileOpen && (
                <div className="navbar-mobile-menu">
                    {renderNavLinks('mobile-nav-link')}

                    <div className="mobile-user-row">
                        <span className="mobile-greeting">Hello, {user.username}</span>
                        <button
                            type="button"
                            className="logout-button"
                            onClick={() => { setMobileOpen(false); handleLogout(); }}
                        >
                            Logout
                        </button>
                    </div>
                </div>
            )}
        </header>
    )
}

export default Navbar
