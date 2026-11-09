import React, { useState } from 'react'
import { Link, useLocation } from 'react-router'
import { useAuth } from '../../features/auth/hooks/useAuth.js'
import './Navbar.scss'

const Navbar = () => {
    const { user, handleLogout } = useAuth()
    const location = useLocation()
    const [mobileOpen, setMobileOpen] = useState(false)

    const isActive = (path) => location.pathname === path

    const NavLinks = ({ linkClass }) => (
        <>
            <Link
                to="/"
                className={`${linkClass} ${isActive('/') ? `${linkClass}--active` : ''}`}
                onClick={() => setMobileOpen(false)}
            >
                ResumeCraft
            </Link>
            <Link
                to="/history"
                className={`${linkClass} ${isActive('/history') ? `${linkClass}--active` : ''}`}
                onClick={() => setMobileOpen(false)}
            >
                History
            </Link>
        </>
    )

    return (
        <header className="site-header">
            <div className="navbar-container">
                {/* Logo */}
                <Link to="/" className="navbar-logo" onClick={() => setMobileOpen(false)}>
                    <svg className="logo-star" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                    <span>AcePrep AI</span>
                </Link>

                {/* Center nav — only when logged in */}
                {user && (
                    <nav className="navbar-center" aria-label="Main navigation">
                        <NavLinks linkClass="nav-link" />
                    </nav>
                )}

                {/* Right side */}
                <div className="navbar-right">
                    {user ? (
                        <div className="navbar-user">
                            <span className="user-greeting">Hello, {user.username}</span>
                            <button
                                type="button"
                                className="logout-button"
                                onClick={() => { setMobileOpen(false); handleLogout() }}
                            >
                                Logout
                            </button>
                        </div>
                    ) : (
                        <div className="navbar-auth-links">
                            <Link to="/login" className="nav-auth-btn nav-auth-btn--login">Login</Link>
                            <Link to="/register" className="nav-auth-btn nav-auth-btn--register">Register</Link>
                        </div>
                    )}

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

            {/* Mobile dropdown */}
            {user && mobileOpen && (
                <div className="navbar-mobile-menu">
                    <NavLinks linkClass="mobile-nav-link" />
                    <div className="mobile-user-row">
                        <span className="mobile-greeting">Hello, {user.username}</span>
                        <button
                            type="button"
                            className="logout-button"
                            onClick={() => { setMobileOpen(false); handleLogout() }}
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
