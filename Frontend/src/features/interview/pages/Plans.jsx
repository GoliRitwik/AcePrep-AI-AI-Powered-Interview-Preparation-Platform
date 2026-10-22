import React, { useState, useMemo } from 'react'
import { useNavigate, Link, useLocation } from 'react-router'
import '../style/plans.scss'
import { useInterview } from '../hooks/useInterview.js'
import { useAuth } from '../../auth/hooks/useAuth.js'

// ── Icons ─────────────────────────────────────────────────────────────────────
const TrashIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
        <path d="M10 11v6M14 11v6" />
        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
)

const BriefcaseIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
)

// ── Circular Score Ring (SVG) ─────────────────────────────────────────────────
const RING_R   = 12                          // radius
const RING_C   = 2 * Math.PI * RING_R        // circumference ≈ 75.4

const scoreColor = (score) => {
    if (score >= 80) return '#22c55e'
    if (score >= 60) return '#f59e0b'
    return '#f87171'
}

const ScoreRing = ({ score }) => {
    const color = scoreColor(score)
    const dash  = (score / 100) * RING_C

    return (
        <div className="score-ring">
            <svg width="32" height="32" viewBox="0 0 32 32">
                {/* Track */}
                <circle cx="16" cy="16" r={RING_R}
                    fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
                {/* Progress arc — starts from 12 o'clock */}
                <circle cx="16" cy="16" r={RING_R}
                    fill="none"
                    stroke={color}
                    strokeWidth="3"
                    strokeDasharray={`${dash} ${RING_C}`}
                    strokeLinecap="round"
                    transform="rotate(-90 16 16)" />
            </svg>
            <span className="score-ring__label" style={{ color }}>{score}%</span>
        </div>
    )
}

// ── Version tag helper ─────────────────────────────────────────────────────────
// Oldest plan with a given title gets no tag; second oldest → v2, third → v3...
const addVersionTags = (reports) => {
    const byTitle  = {}
    const sortedAsc = [...reports].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))

    sortedAsc.forEach(r => {
        if (!byTitle[r.title]) byTitle[r.title] = []
        byTitle[r.title].push(r._id)
    })

    const versionMap = {}
    Object.values(byTitle).forEach(ids => {
        if (ids.length > 1) {
            // ids[0] is the oldest → no tag; ids[1] → v2, ids[2] → v3 …
            ids.slice(1).forEach((id, i) => { versionMap[id] = `v${i + 2}` })
        }
    })

    return reports.map(r => ({ ...r, versionTag: versionMap[r._id] ?? null }))
}

// ── Main Component ────────────────────────────────────────────────────────────
const Plans = () => {
    const navigate  = useNavigate()
    const location  = useLocation()
    const { user, handleLogout } = useAuth()
    const { reports, loading, deletePlan } = useInterview()

    const [confirmId,  setConfirmId]  = useState(null)
    const [deletingId, setDeletingId] = useState(null)
    const [query,      setQuery]      = useState('')

    // Apply version tags, then filter by search query
    const versionedReports = useMemo(() => addVersionTags(reports), [reports])
    const filteredReports  = useMemo(() => {
        const q = query.trim().toLowerCase()
        if (!q) return versionedReports
        return versionedReports.filter(r => r.title?.toLowerCase().includes(q))
    }, [versionedReports, query])

    // ── Delete handlers ───────────────────────────────────────────────────────
    const onTrashClick = (e, id) => {
        e.stopPropagation()
        setConfirmId(id)
    }
    const onDeleteYes = async (e, id) => {
        e.stopPropagation()
        setDeletingId(id)
        const ok = await deletePlan(id)
        setDeletingId(null)
        if (ok) setConfirmId(null)
    }
    const onDeleteCancel = (e) => {
        e.stopPropagation()
        setConfirmId(null)
    }
    const onCardClick = (id) => {
        if (confirmId === id) return
        navigate(`/interview/${id}`)
    }

    // ── Loading state ─────────────────────────────────────────────────────────
    if (loading) return (
        <div className="plans-page">
            <p className="plans-loading">Loading your plans…</p>
        </div>
    )

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="plans-page">

            

            <div className="plans-main">

                {/* ── Header row: title + count + search ── */}
                <div className="plans-header-row">
                    <div className="plans-header-left">
                        <h1 className="plans-title">My Interview Plans</h1>
                        {reports.length > 0 && (
                            <span className="plans-count">
                                {reports.length} plan{reports.length !== 1 ? 's' : ''}
                            </span>
                        )}
                    </div>

                    {reports.length > 0 && (
                        <div className="plans-search">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
                                fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                            </svg>
                            <input
                                type="text"
                                placeholder="Search plans…"
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                className="plans-search__input"
                            />
                        </div>
                    )}
                </div>

                {/* ── Content area ── */}
                {reports.length === 0 ? (
                    /* Empty state */
                    <div className="plans-empty">
                        <span className="plans-empty__icon">📋</span>
                        <p className="plans-empty__title">You haven't generated any plans yet.</p>
                        <p className="plans-empty__sub">Generate one to get personalised interview prep.</p>
                        <button className="plans-empty__btn" onClick={() => navigate('/')}>
                            Create your first plan →
                        </button>
                    </div>
                ) : (
                    <div className="plans-grid">

                        {/* ── New plan card (always first) ── */}
                        <div className="plan-card plan-card--new" onClick={() => navigate('/')}>
                            <span className="plan-card-new__plus">+</span>
                            <p className="plan-card-new__label">New plan</p>
                        </div>

                        {/* ── No search results ── */}
                        {query && filteredReports.length === 0 && (
                            <p className="plans-no-results">No plans match your search.</p>
                        )}

                        {/* ── Plan cards ── */}
                        {filteredReports.map(report => {
                            const isConfirm  = confirmId  === report._id
                            const isDeleting = deletingId === report._id

                            return (
                                <div
                                    key={report._id}
                                    className={`plan-card${isConfirm ? ' plan-card--confirm' : ''}`}
                                    onClick={() => onCardClick(report._id)}
                                >
                                    {isConfirm ? (
                                        /* Confirm delete */
                                        <div className="plan-card__confirm">
                                            <span className="plan-card__confirm-label">Delete this plan?</span>
                                            <div className="plan-card__confirm-actions">
                                                <button
                                                    className="plan-card__confirm-yes"
                                                    onClick={e => onDeleteYes(e, report._id)}
                                                    disabled={isDeleting}
                                                >
                                                    {isDeleting ? 'Deleting…' : 'Yes, delete'}
                                                </button>
                                                <button className="plan-card__confirm-cancel" onClick={onDeleteCancel}>
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        /* Normal card */
                                        <>
                                            {/* Top row */}
                                            <div className="plan-card__top">
                                                <div className="plan-card__icon-box">
                                                    <BriefcaseIcon />
                                                </div>
                                                <div className="plan-card__meta-group">
                                                    <h3 className="plan-card__title">
                                                        {report.title || 'Untitled Position'}
                                                        {report.versionTag && (
                                                            <span className="plan-card__vtag">{report.versionTag}</span>
                                                        )}
                                                    </h3>
                                                    <p className="plan-card__date">
                                                        {new Date(report.createdAt).toLocaleDateString('en-US', {
                                                            year: 'numeric', month: 'short', day: 'numeric'
                                                        })}
                                                    </p>
                                                </div>
                                                <button
                                                    className="plan-card__delete-btn"
                                                    onClick={e => onTrashClick(e, report._id)}
                                                    title="Delete plan"
                                                    type="button"
                                                >
                                                    <TrashIcon />
                                                </button>
                                            </div>

                                            {/* Bottom row: score ring */}
                                            <div className="plan-card__bottom">
                                                <ScoreRing score={report.matchScore ?? 0} />
                                                <span className="plan-card__match-label">match</span>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}

export default Plans
