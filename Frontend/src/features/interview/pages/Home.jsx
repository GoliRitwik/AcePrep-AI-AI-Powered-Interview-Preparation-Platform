import React, { useState, useRef, useEffect, useMemo } from 'react'
import '../style/home.scss'
import { useInterview } from '../hooks/useInterview.js'
import { useNavigate, Link, useLocation } from 'react-router'
import LoadingOverlay from '../../../components/LoadingOverlay/LoadingOverlay.jsx'
import toast from 'react-hot-toast'

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
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
)

// ── Circular Score Ring (SVG) ─────────────────────────────────────────────────
const RING_R = 12
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
            <svg width="32" height="32" viewBox="0 0 32 32">
                <circle
                    cx="16" cy="16" r={RING_R}
                    fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3"
                />
                <circle
                    cx="16" cy="16" r={RING_R}
                    fill="none"
                    stroke={color}
                    strokeWidth="3"
                    strokeDasharray={`${dash} ${RING_C}`}
                    strokeLinecap="round"
                    transform="rotate(-90 16 16)"
                />
            </svg>
            <span className="score-ring__label" style={{ color }}>{score}%</span>
        </div>
    )
}

// ── Version Tag Helper ────────────────────────────────────────────────────────
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

const Home = () => {
    const { loading, generateReport, cancelGeneration, reports, deletePlan } = useInterview()
    const [jobDescription, setJobDescription] = useState("")
    const [selfDescription, setSelfDescription] = useState("")
    const resumeInputRef = useRef(null)
    const [selectedFile, setSelectedFile] = useState(null)
    const [isDragging, setIsDragging] = useState(false)
    const [isGenerating, setIsGenerating] = useState(false)

    // History card delete confirmation
    const [confirmId, setConfirmId] = useState(null)
    const [deletingId, setDeletingId] = useState(null)

    const navigate = useNavigate()
    const location = useLocation()

    // Smooth scroll if URL has #history
    useEffect(() => {
        if (location.hash === '#history') {
            const el = document.getElementById('history')
            if (el) {
                setTimeout(() => el.scrollIntoView({ behavior: 'smooth' }), 50)
            }
        }
    }, [location])

    const formatFileSize = (bytes) => {
        if (bytes < 1024) return `${bytes} B`
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    }

    const handleFileSelect = (file) => {
        if (!file) return
        if (file.size > 5 * 1024 * 1024) {
            toast.error("File size must be under 5MB")
            return
        }
        setSelectedFile(file)
    }

    const handleRemoveFile = (e) => {
        e.stopPropagation()
        setSelectedFile(null)
        if (resumeInputRef.current) resumeInputRef.current.value = ''
    }

    const handleGenerateReport = async () => {
        if (!jobDescription.trim()) {
            toast.error("Please provide a job description.")
            return
        }
        if (!selectedFile && !selfDescription.trim()) {
            toast.error("Please upload a resume or provide a quick self-description.")
            return
        }

        const resumeFile = selectedFile || undefined
        setIsGenerating(true)
        try {
            const data = await generateReport({ jobDescription, selfDescription, resumeFile })
            if (data?._id) {
                navigate(`/interview/${data._id}`)
            }
        } finally {
            setIsGenerating(false)
        }
    }

    // Version-tagged reports
    const versionedReports = useMemo(() => {
        if (!reports || reports.length === 0) return []
        return addVersionTags(reports)
    }, [reports])

    // Recent reports up to 6 for the home page section
    const displayedReports = versionedReports.slice(0, 6)

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
        <div className="home-container">
            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* TOP SECTION — Resume Generator                                */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            <section className="generator-section">
                <div className="section-header-left">
                    <h1 className="generator-title">Optimize your resume</h1>
                    <p className="generator-subtitle">
                        Paste a job description and upload your resume. We'll tailor it and score it against ATS in under 30 seconds.
                    </p>
                </div>

                <div className="generator-form-grid">
                    {/* ── Left Column (60%): Job Description ── */}
                    <div className="form-col form-col--left">
                        <div className="field-header">
                            <label className="field-label" htmlFor="jobDescription">
                                JOB DESCRIPTION <span className="required-asterisk">*</span>
                            </label>
                        </div>
                        <textarea
                            id="jobDescription"
                            name="jobDescription"
                            className="jd-textarea"
                            placeholder="Paste the full job description here..."
                            value={jobDescription}
                            maxLength={5000}
                            onChange={(e) => setJobDescription(e.target.value)}
                        />
                        <div className="char-count">
                            {jobDescription.length} / 5000
                        </div>
                    </div>

                    {/* ── Right Column (40%): Resume & Self-Description ── */}
                    <div className="form-col form-col--right">
                        <div className="field-header">
                            <label className="field-label">
                                YOUR RESUME
                            </label>
                        </div>

                        {/* Hidden native input */}
                        <input
                            ref={resumeInputRef}
                            type="file"
                            id="resume"
                            name="resume"
                            accept=".pdf,.docx"
                            style={{ display: 'none' }}
                            onChange={(e) => handleFileSelect(e.target.files[0])}
                        />

                        {selectedFile ? (
                            <div className="file-preview-box">
                                <div className="file-info-col">
                                    <span className="file-name" title={selectedFile.name}>{selectedFile.name}</span>
                                    <span className="file-size">{formatFileSize(selectedFile.size)}</span>
                                </div>
                                <button
                                    type="button"
                                    className="file-remove-btn"
                                    onClick={handleRemoveFile}
                                    title="Remove file"
                                >
                                    ✕
                                </button>
                            </div>
                        ) : (
                            <div
                                className={`upload-dropzone${isDragging ? ' upload-dropzone--dragging' : ''}`}
                                onClick={() => resumeInputRef.current?.click()}
                                onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
                                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
                                onDragLeave={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (!e.currentTarget.contains(e.relatedTarget)) setIsDragging(false);
                                }}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setIsDragging(false);
                                    handleFileSelect(e.dataTransfer.files[0]);
                                }}
                            >
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="dropzone-icon">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                    <polyline points="17 8 12 3 7 8" />
                                    <line x1="12" y1="3" x2="12" y2="15" />
                                </svg>
                                <p className="dropzone-text">
                                    {isDragging ? "Drop your resume here" : "Click to upload or drag & drop"}
                                </p>
                                <span className="dropzone-hint">PDF or DOCX (Max 5MB)</span>
                            </div>
                        )}

                        <div className="or-divider">
                            <span>OR</span>
                        </div>

                        <textarea
                            id="selfDescription"
                            name="selfDescription"
                            className="self-textarea"
                            placeholder="Briefly describe your experience if you don't have a resume ready..."
                            value={selfDescription}
                            onChange={(e) => setSelfDescription(e.target.value)}
                        />
                    </div>
                </div>

                {/* ── Form Footer Action ── */}
                <div className="generator-action-row">
                    <button
                        type="button"
                        className="optimize-btn"
                        onClick={handleGenerateReport}
                        disabled={isGenerating}
                    >
                        {isGenerating ? "Optimizing resume..." : "Optimize Resume →"}
                    </button>
                    <span className="action-subtext">Takes ~20–30 seconds · ATS scored</span>
                </div>
            </section>

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* HISTORY SECTION                                                */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            <section id="history" className="history-section">
                <div className="history-header">
                    <h2 className="history-title">Recent Resumes</h2>
                    {reports && reports.length > 6 && (
                        <Link to="/plans" className="history-view-all">
                            View all →
                        </Link>
                    )}
                </div>

                {(!reports || reports.length === 0) ? (
                    <div className="history-empty">
                        <p>No resumes optimized yet. Paste a job description above to get started.</p>
                    </div>
                ) : (
                    <div className="history-grid">
                        {displayedReports.map((item) => {
                            const isConfirm = confirmId === item._id
                            const isDeleting = deletingId === item._id

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
                                                    {isDeleting ? "Deleting..." : "Delete"}
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
                                                            {item.title || "Untitled Position"}
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
                                                <ScoreRing score={item.matchScore ?? 0} />
                                                <span className="card-match-label">match score</span>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}
            </section>

            {/* Loading Overlay when generating */}
            <LoadingOverlay isVisible={isGenerating} onCancel={cancelGeneration} />
        </div>
    )
}

export default Home
