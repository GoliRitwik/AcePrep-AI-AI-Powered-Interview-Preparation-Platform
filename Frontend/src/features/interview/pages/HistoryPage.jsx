import React, { useState, useMemo } from 'react'
import { useNavigate, Link } from 'react-router'
import { useInterview } from '../hooks/useInterview.js'
import '../style/history.scss'

// ── Icons ────────────────────────────────────────────────────────────────────
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
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
)

// ── Circular Score Ring ───────────────────────────────────────────────────────
const RING_R = 14
const RING_C = 2 * Math.PI * RING_R

const scoreColor = (score) => {
    if (score >= 80) return '#22c55e'
    if (score >= 60) return '#f59e0b'
    return '#ef4444'
}

const ScoreRing = ({ score }) => {
    const color = scoreColor(score)
    const dash = (score / 100) * RING_C

    return (
        <div className="score-ring">
            <svg width="36" height="36" viewBox="0 0 36 36">
                <circle
                    cx="18" cy="18" r={RING_R}
                    fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3"
                />
                <circle
                    cx="18" cy="18" r={RING_R}
                    fill="none"
                    stroke={color}
                    strokeWidth="3"
                    strokeDasharray={`${dash} ${RING_C}`}
                    strokeLinecap="round"
                    transform="rotate(-90 18 18)"
                />
            </svg>
            <span className="score-ring__label" style={{ color }}>{score}%</span>
        </div>
    )
}

// ── Version Tag Helper ───────────────────────────────────────────────────────
const addVersionTags = (reportsList) => {
    const byTitle = {}
    const sortedAsc = [...reportsList].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))

    sortedAsc.forEach(r => {
        if (!byTitle[r.title]) byTitle[r.title] = []
        byTitle[r.title].push(r._id)
    })

    const versionMap = {}
    Object.values(byTitle).forEach(ids => {
        if (ids.length > 1) {
            ids.slice(1).forEach((id, i) => { versionMap[id] = `v${i + 2}` })
        }
    })

    return reportsList.map(r => ({ ...r, versionTag: versionMap[r._id] ?? null }))
}

// ── HistoryPage ──────────────────────────────────────────────────────────────
const HistoryPage = () => {
    const { reports, deletePlan } = useInterview()
    const [confirmId, setConfirmId] = useState(null)
    const [deletingId, setDeletingId] = useState(null)
    const navigate = useNavigate()

    const versionedReports = useMemo(() => {
        if (!reports || reports.length === 0) return []
        return addVersionTags(reports)
    }, [reports])

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

    return (
        <div className="history-page">
            <div className="history-page__header">
                <div>
                    <h1 className="history-page__title">Resume History</h1>
                    <p className="history-page__subtitle">All your optimized resumes and ATS reports</p>
                </div>
                <Link to="/" className="history-page__new-btn">
                    + New Resume
                </Link>
            </div>

            {(!versionedReports || versionedReports.length === 0) ? (
                <div className="history-empty">
                    <p>No resumes optimized yet.</p>
                    <Link to="/" className="history-empty__cta">Optimize your first resume →</Link>
                </div>
            ) : (
                <div className="history-grid">
                    {versionedReports.map((item) => {
                        const isConfirm = confirmId === item._id
                        const isDeleting = deletingId === item._id
                        const hasScore = item.matchScore != null && item.matchScore !== undefined

                        return (
                            <div
                                key={item._id}
                                className={`history-card${isConfirm ? ' history-card--confirm' : ''}`}
                                onClick={() => onCardClick(item._id)}
                            >
                                {isConfirm ? (
                                    <div className="history-card__confirm">
                                        <span className="confirm-text">Delete this resume?</span>
                                        <div className="confirm-buttons">
                                            <button
                                                className="confirm-btn-yes"
                                                onClick={(e) => onDeleteYes(e, item._id)}
                                                disabled={isDeleting}
                                                type="button"
                                            >
                                                {isDeleting ? 'Deleting...' : 'Delete'}
                                            </button>
                                            <button
                                                className="confirm-btn-cancel"
                                                onClick={onDeleteCancel}
                                                type="button"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className="history-card__header">
                                            <div className="card-title-group">
                                                <div className="card-icon-box">
                                                    <BriefcaseIcon />
                                                </div>
                                                <div>
                                                    <h3 className="card-title">
                                                        {item.title || 'Untitled Position'}
                                                        {item.versionTag && (
                                                            <span className="card-version-tag">{item.versionTag}</span>
                                                        )}
                                                    </h3>
                                                    <span className="card-date">
                                                        {new Date(item.createdAt).toLocaleDateString('en-US', {
                                                            year: 'numeric', month: 'short', day: 'numeric'
                                                        })}
                                                    </span>
                                                </div>
                                            </div>

                                            <button
                                                type="button"
                                                className="card-trash-btn"
                                                onClick={(e) => onTrashClick(e, item._id)}
                                                title="Delete"
                                            >
                                                <TrashIcon />
                                            </button>
                                        </div>

                                        <div className="history-card__bottom">
                                            {hasScore ? (
                                                <>
                                                    <ScoreRing score={item.matchScore} />
                                                    <span className="card-match-label">
                                                        {item.matchScore}% &middot; MATCH SCORE
                                                    </span>
                                                </>
                                            ) : (
                                                <span className="card-match-label card-match-label--pending">
                                                    Score pending
                                                </span>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

export default HistoryPage
