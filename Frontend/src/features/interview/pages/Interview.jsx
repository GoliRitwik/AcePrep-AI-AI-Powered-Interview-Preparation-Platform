import React, { useState, useEffect, useRef, useCallback } from 'react'
import '../style/interview.scss'
import { useInterview } from '../hooks/useInterview.js'
import { useAuth } from '../../auth/hooks/useAuth.js'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import toast from 'react-hot-toast'
import ResumeBuilderModal from '../components/ResumeBuilderModal/ResumeBuilderModal.jsx'
import { downloadTailoredResumePdf } from '../services/interview.api.js'
import ScoreCompare from '../components/ScoreCompare/ScoreCompare.jsx'
import ResumePreview from '../components/ResumePreview/ResumePreview.jsx'
import ResumeEditor from '../components/ResumeEditor/ResumeEditor.jsx'

// ─────────────────────────────────────────────────────────────
// LOADING SCREEN
// ─────────────────────────────────────────────────────────────

const STEPS = [
    'Reading your resume',
    'Parsing the job description',
    'Finding your strongest stories',
    'Rewriting your experience section',
    'Aligning to ATS keywords',
    'Polishing the output',
    'Almost ready'
]

const TIPS = [
    '3 in 4 resumes are filtered by ATS before a human sees them.',
    'Tailoring your resume to each JD improves callbacks by up to 3x.',
    'Use exact keywords from the job description — ATS matches strings.',
    'Keep your resume to 1 page if you have under 3 years of experience.',
    'Quantify achievements wherever possible — numbers stand out.',
    'Avoid tables and columns — most ATS systems cannot parse them.',
    'Your summary section is the first thing recruiters read — make it count.',
    'Skills listed in the JD as required should appear in your resume.',
    'Action verbs like Engineered, Built, Designed score higher than worked on.',
    'Remove personal pronouns (I, me, my) from resume bullet points.'
]

const LoadingScreen = () => {
    const [currentStep, setCurrentStep] = useState(0)
    const [tipIndex, setTipIndex] = useState(0)
    const [tipVisible, setTipVisible] = useState(true)

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentStep(prev => prev < STEPS.length - 1 ? prev + 1 : prev)
        }, 4000)
        return () => clearInterval(interval)
    }, [])

    useEffect(() => {
        const interval = setInterval(() => {
            setTipVisible(false)
            setTimeout(() => {
                setTipIndex(prev => (prev + 1) % TIPS.length)
                setTipVisible(true)
            }, 400)
        }, 5000)
        return () => clearInterval(interval)
    }, [])

    return (
        <div className="report-loading-screen">
            <div className="loading-loader-wrap">
                <div className="pl">
                    {Array.from({ length: 12 }).map((_, i) => <div key={i} className="pl__dot" />)}
                    <div className="pl__text">AI</div>
                </div>
            </div>
            <div className="loading-steps">
                {STEPS.slice(0, currentStep + 1).map((label, i) => {
                    const isDone = i < currentStep
                    const isActive = i === currentStep
                    return (
                        <div key={i} className={`loading-step ${isDone ? 'loading-step--done' : isActive ? 'loading-step--active' : ''}`}>
                            {isDone ? <span className="loading-step__check">✓</span> : <span className="loading-step__dot" />}
                            <span className="loading-step__label">{label}</span>
                            {isActive && <span className="loading-step__running">running</span>}
                        </div>
                    )
                })}
            </div>
            <div className="loading-tip">
                <p style={{ opacity: tipVisible ? 1 : 0, transition: 'opacity 0.4s ease' }}>
                    💡 {TIPS[tipIndex]}
                </p>
            </div>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

const scoreColorHex = (score) => {
    if (score >= 80) return '#22c55e'
    if (score >= 60) return '#f59e0b'
    return '#ef4444'
}

// ─────────────────────────────────────────────────────────────
// SCORE RING
// ─────────────────────────────────────────────────────────────

const ScoreRing = ({ score, size = 96 }) => {
    const r = (size / 2) - 6
    const circ = 2 * Math.PI * r
    const dash = (score / 100) * circ
    const color = scoreColorHex(score)
    return (
        <div className="score-ring-wrap" style={{ width: size, height: size }}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="5" />
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="5"
                    strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
                    transform={`rotate(-90 ${size / 2} ${size / 2})`} />
            </svg>
            <div className="score-ring-wrap__label" style={{ color }}>
                <span className="score-ring-wrap__num">{score}</span>
                <span className="score-ring-wrap__pct">%</span>
            </div>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────
// QUESTION CARD
// ─────────────────────────────────────────────────────────────

const QuestionCard = ({ item, index }) => {
    const [open, setOpen] = useState(false)
    return (
        <div className="q-card">
            <div className="q-card__header" onClick={() => setOpen(o => !o)}>
                <div className="q-card__num">{index + 1}</div>
                <p className="q-card__question">{item.question}</p>
                <span className={`q-card__chevron ${open ? 'q-card__chevron--open' : ''}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
                </span>
            </div>
            {open && (
                <div className="q-card__body">
                    <div className="q-card__section">
                        <span className="q-card__tag q-card__tag--intention">Intention</span>
                        <p>{item.intention}</p>
                    </div>
                    <div className="q-card__section">
                        <span className="q-card__tag q-card__tag--answer">Model Answer</span>
                        <p>{item.answer}</p>
                    </div>
                </div>
            )}
        </div>
    )
}

// ─────────────────────────────────────────────────────────────
// EMPTY RESUME STATE
// ─────────────────────────────────────────────────────────────

const EmptyResumeState = ({ onBuild }) => (
    <div className="resume-empty-state">
        <div className="resume-empty-state__icon">📄</div>
        <p className="resume-empty-state__text">Your tailored resume will appear here</p>
        <button className="dl-btn dl-btn--primary" onClick={onBuild}>
            Build tailored resume
        </button>
    </div>
)

// ─────────────────────────────────────────────────────────────
// TAB: RESUME WORKSPACE
// ─────────────────────────────────────────────────────────────

const ResumeTab = ({ report, tailored, setTailored, onOpenBuilder, user, onTabChange }) => {
    const [isEditing, setIsEditing] = useState(false)
    const [pdfLoading, setPdfLoading] = useState(false)
    const [isUpdatingPreview, setIsUpdatingPreview] = useState(false)
    const [resumePages, setResumePages] = useState(1)
    const { setReport } = useInterview()

    const handleDownloadPdf = async () => {
        setPdfLoading(true)
        try {
            const blob = await downloadTailoredResumePdf(report._id)
            const nameCandidate = (user?.username || report.title || 'resume').replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase()
            const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }))
            const a = document.createElement('a')
            a.href = url
            a.download = `${nameCandidate}-resume.pdf`
            document.body.appendChild(a)
            a.click()
            a.remove()
            URL.revokeObjectURL(url)
        } catch (err) {
            toast.error('PDF download failed — please try again.')
        } finally {
            setPdfLoading(false)
        }
    }

    if (!tailored?.html) {
        return (
            <div className="tab-content tab-resume tab-resume--empty">
                <EmptyResumeState onBuild={onOpenBuilder} />
            </div>
        )
    }

    const scoring = tailored.scoring
    const hasTailoredScore = (scoring?.after?.score != null) || (tailored.atsAfter != null)
    const beforeScore = scoring?.before?.score ?? tailored.atsBefore ?? report.matchScore
    const afterScore = scoring?.after?.score ?? tailored.atsAfter ?? report.matchScore

    // Top 5 missing must-have keywords
    const missingList = scoring?.after?.missing || []
    const topMissingMust = missingList.filter(k => k.importance === 'must').slice(0, 5)
    const matchedCount = scoring?.after?.matched?.length ?? tailored.matchedAfter?.length ?? 0
    const totalKeywords = (scoring?.after?.matched?.length ?? 0) + (scoring?.after?.missing?.length ?? 0)

    return (
        <div className="tab-resume">
            <div className="tab-resume__grid">
                {/* LEFT: Preview Panel */}
                <div className="tab-resume__left">
                    <ResumePreview
                        html={tailored.html}
                        reportTitle={report.title}
                        onMeasured={({ pages }) => setResumePages(pages)}
                        isUpdating={isUpdatingPreview}
                        isEditing={isEditing}
                        hasContent={Boolean(tailored?.content)}
                        onToggleEdit={() => setIsEditing(e => !e)}
                        onDownloadPdf={handleDownloadPdf}
                        pdfLoading={pdfLoading}
                        onRebuild={onOpenBuilder}
                    />
                </div>

                {/* RIGHT: Editor OR ATS Sidebar */}
                <div className="tab-resume__right">
                    {isEditing && tailored?.content ? (
                        <ResumeEditor
                            reportId={report._id}
                            initialContent={tailored.content}
                            initialScoring={tailored.scoring}
                            pages={resumePages}
                            onPreviewUpdate={({ html, scoring, atsBefore, atsAfter, isUpdating }) => {
                                setIsUpdatingPreview(Boolean(isUpdating))
                                if (html) {
                                    setTailored(prev => ({
                                        ...prev,
                                        html,
                                        scoring: scoring || prev.scoring,
                                        atsBefore: atsBefore ?? prev.atsBefore,
                                        atsAfter: atsAfter ?? prev.atsAfter
                                    }))
                                }
                            }}
                            onSaveSuccess={(updated) => {
                                setTailored(prev => ({ ...prev, ...updated }))
                                if (setReport) {
                                    setReport(prev => prev ? {
                                        ...prev,
                                        tailoredResume: { ...prev.tailoredResume, ...updated }
                                    } : prev)
                                }
                            }}
                            onDiscard={() => setIsEditing(false)}
                            onHasUnsavedChangesChange={() => {}}
                        />
                    ) : (
                        <div className="ats-sidebar-card">
                            {hasTailoredScore ? (
                                <>
                                    <ScoreCompare
                                        size="md"
                                        before={beforeScore}
                                        after={afterScore}
                                    />

                                    {scoring?.explanation && (
                                        <p className="ats-sidebar-card__explanation">
                                            {scoring.explanation}
                                        </p>
                                    )}

                                    <div className="ats-sidebar-card__kw-summary">
                                        <p className="ats-sidebar-card__kw-count">
                                            {totalKeywords > 0
                                                ? `${matchedCount} of ${totalKeywords} keywords matched`
                                                : `${matchedCount} keywords matched`}
                                        </p>
                                        {topMissingMust.length > 0 && (
                                            <div className="ats-sidebar-card__missing-chips">
                                                <span className="ats-sidebar-card__missing-label">Top missing must-haves:</span>
                                                <div className="ats-sidebar-card__chips-row">
                                                    {topMissingMust.map(kw => (
                                                        <span key={kw.term} className="ats-mini-chip">
                                                            <span className="must-dot must-dot--amber" /> {kw.term}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        <button
                                            type="button"
                                            className="ats-sidebar-card__view-all-btn"
                                            onClick={() => onTabChange('ats')}
                                        >
                                            View all in ATS Score →
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <p className="ats-sidebar-card__label">ESTIMATED ATS MATCH</p>
                                    <div className="ats-sidebar-card__ring-wrap">
                                        <ScoreRing score={report.matchScore} size={96} />
                                    </div>
                                    <p className="ats-before-after__sub" style={{ textAlign: 'center', marginBottom: 8 }}>
                                        Original resume
                                    </p>
                                    <p className="ats-sidebar-card__hint">
                                        Build your tailored resume to see your improved score.
                                    </p>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────
// TAB: WHAT CHANGED
// ─────────────────────────────────────────────────────────────

const ChangesTab = ({ report, tailored, onOpenBuilder }) => {
    if (!tailored) {
        return (
            <div className="tab-content tab-changes">
                <h2 className="tab-section-heading">What Changed</h2>
                <EmptyResumeState onBuild={onOpenBuilder} />
            </div>
        )
    }

    const ch = tailored.changes || {}
    const atsBefore = tailored.scoring?.before?.score ?? tailored.atsBefore
    const atsAfter = tailored.scoring?.after?.score ?? tailored.atsAfter
    const hasDiff = atsBefore != null && atsAfter != null
    const keywordsGained = tailored.scoring?.keywordsGained || tailored.keywordsGained || []

    const cards = [
        ch.skillsAdded?.length > 0 && {
            title: 'Skills added',
            tags: ch.skillsAdded,
            green: true
        },
        ch.skillsDeprioritized?.length > 0 && {
            title: 'Deprioritized skills',
            tags: ch.skillsDeprioritized,
            green: false
        },
        (ch.summaryAngle || ch.summaryText) && {
            title: 'Summary',
            body: ch.summaryAngle ? `${ch.summaryAngle}: ${ch.summaryText || ''}` : ch.summaryText,
            green: true
        },
        keywordsGained.length > 0 && {
            title: 'Keywords now matched',
            tags: keywordsGained,
            green: true
        },
        hasDiff && {
            title: 'Score',
            body: `${atsBefore}% → ${atsAfter}% (${atsAfter - atsBefore >= 0 ? '+' : ''}${atsAfter - atsBefore})`,
            green: atsAfter >= atsBefore
        }
    ].filter(Boolean)

    return (
        <div className="tab-content tab-changes">
            <h2 className="tab-section-heading">What Changed</h2>
            <p className="tab-section-sub">Changes made when tailoring your resume for this role</p>
            {cards.length === 0 ? (
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>No change data saved.</p>
            ) : (
                <div className="changes-list">
                    {cards.map((c, i) => (
                        <div key={i} className="changes-card">
                            <div className={`changes-card__icon-wrap ${c.green ? 'changes-card__icon-wrap--green' : 'changes-card__icon-wrap--amber'}`}>
                                {c.green ? '✓' : '⚠'}
                            </div>
                            <div className="changes-card__body">
                                <p className="changes-card__title">{c.title}</p>
                                {c.tags && (
                                    <div className="changes-tags">
                                        {c.tags.map((t, j) => <span key={j} className="changes-tag">{t}</span>)}
                                    </div>
                                )}
                                {c.body && <p className="changes-card__desc">{c.body}</p>}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

// ─────────────────────────────────────────────────────────────
// ATS BREAKDOWN ROW
// ─────────────────────────────────────────────────────────────

const BreakdownRow = ({ title, item }) => {
    if (!item) return null
    const pct = Math.min(100, Math.max(0, (item.points / item.max) * 100))
    return (
        <div className="ats-breakdown-row">
            <div className="ats-breakdown-row__header">
                <span className="ats-breakdown-row__title">{title}</span>
                <span className="ats-breakdown-row__score">{item.points} / {item.max}</span>
            </div>
            <div className="ats-breakdown-row__bar-track">
                <div className="ats-breakdown-row__bar-fill" style={{ width: `${pct}%` }} />
            </div>
            <p className="ats-breakdown-row__detail">{item.detail}</p>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────
// TAB: ATS SCORE
// ─────────────────────────────────────────────────────────────

const AtsTab = ({ report, tailored, onOpenBuilder }) => {
    const hasTailored = tailored && tailored.atsAfter != null
    const scoring = tailored?.scoring
    const isV2 = scoring && scoring.version === 2

    const beforeScore = scoring?.before?.score ?? tailored?.atsBefore ?? report.matchScore
    const afterScore = scoring?.after?.score ?? tailored?.atsAfter ?? report.matchScore

    const matchedList = scoring?.after?.matched || []
    const missingList = scoring?.after?.missing || []

    const sortedMatched = [...matchedList].sort((a, b) => {
        if (a.importance === 'must' && b.importance !== 'must') return -1
        if (a.importance !== 'must' && b.importance === 'must') return 1
        return 0
    })

    const sortedMissing = [...missingList].sort((a, b) => {
        if (a.importance === 'must' && b.importance !== 'must') return -1
        if (a.importance !== 'must' && b.importance === 'must') return 1
        return 0
    })

    const keywordsGained = scoring?.keywordsGained || tailored?.keywordsGained || []
    const breakdown = scoring?.after?.breakdown

    return (
        <div className="tab-content tab-ats">
            <h2 className="tab-section-heading">ATS Score</h2>

            {hasTailored ? (
                <ScoreCompare
                    size="lg"
                    before={beforeScore}
                    after={afterScore}
                />
            ) : (
                <div className="ats-score-hero">
                    <ScoreRing score={report.matchScore} size={120} />
                    <p className="ats-score-hero__label">Original resume match</p>
                    {!tailored && (
                        <button className="dl-btn dl-btn--primary" style={{ marginTop: 16 }} onClick={onOpenBuilder}>
                            Build tailored resume
                        </button>
                    )}
                </div>
            )}

            {!isV2 && hasTailored && (
                <div className="ats-v1-hint">
                    <p>💡 This report was generated with an older scoring version. Click <strong>"Rebuild with different skills"</strong> in the Resume tab to refresh this score with detailed ATS breakdown.</p>
                </div>
            )}

            {/* Score Breakdown (5 rows) */}
            {breakdown && (
                <div className="ats-breakdown-section">
                    <p className="tab-overline">SCORE BREAKDOWN</p>
                    <div className="ats-breakdown-card">
                        <BreakdownRow title="Skills Match" item={breakdown.skills} />
                        <BreakdownRow title="Role Title Alignment" item={breakdown.title} />
                        <BreakdownRow title="Experience Level" item={breakdown.experience} />
                        <BreakdownRow title="Education" item={breakdown.education} />
                        <BreakdownRow title="Format & Readability" item={breakdown.format} />
                    </div>
                </div>
            )}

            {/* Why This Score (deterministic explanation — NO report.matchSummary) */}
            {scoring?.explanation && (
                <div className="ats-why-section">
                    <p className="tab-overline">WHY THIS SCORE</p>
                    <p className="ats-why-text">{scoring.explanation}</p>
                </div>
            )}

            {/* Keywords Grid: Matched & Missing with must-have indicator */}
            {isV2 ? (
                <div className="ats-keywords-grid">
                    <div className="ats-kw-col">
                        <p className="tab-overline" style={{ color: '#22c55e' }}>
                            ✓ MATCHED KEYWORDS ({matchedList.length})
                        </p>
                        <div className="kw-tags">
                            {sortedMatched.length === 0 ? (
                                <span className="kw-tag kw-tag--muted">None</span>
                            ) : (
                                sortedMatched.map(k => (
                                    <span key={k.term} className="kw-tag kw-tag--green">
                                        {k.importance === 'must' && <span className="must-dot must-dot--green" />}
                                        {k.term}
                                    </span>
                                ))
                            )}
                        </div>
                    </div>

                    <div className="ats-kw-col">
                        <p className="tab-overline" style={{ color: '#f59e0b' }}>
                            ⚠ STILL MISSING ({missingList.length})
                        </p>
                        <div className="kw-tags">
                            {sortedMissing.length === 0 ? (
                                <span className="kw-tag kw-tag--muted">None — great match!</span>
                            ) : (
                                sortedMissing.map(k => (
                                    <span key={k.term} className="kw-tag kw-tag--amber">
                                        {k.importance === 'must' && <span className="must-dot must-dot--amber" />}
                                        {k.term}
                                    </span>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            ) : hasTailored ? (
                <div className="ats-keywords-grid">
                    <div className="ats-kw-col">
                        <p className="tab-overline" style={{ color: '#22c55e' }}>✓ MATCHED KEYWORDS</p>
                        <div className="kw-tags">
                            {(tailored.matchedAfter || []).length === 0
                                ? <span className="kw-tag kw-tag--muted">None</span>
                                : (tailored.matchedAfter || []).map((k, i) => <span key={i} className="kw-tag kw-tag--green">{k}</span>)
                            }
                        </div>
                    </div>
                    <div className="ats-kw-col">
                        <p className="tab-overline" style={{ color: '#f59e0b' }}>⚠ STILL MISSING</p>
                        <div className="kw-tags">
                            {(tailored.missingAfter || []).length === 0
                                ? <span className="kw-tag kw-tag--muted">None</span>
                                : (tailored.missingAfter || []).map((k, i) => <span key={i} className="kw-tag kw-tag--amber">{k}</span>)
                            }
                        </div>
                    </div>
                </div>
            ) : null}

            {/* Added by tailoring */}
            {keywordsGained.length > 0 && (
                <div className="ats-gained-section">
                    <p className="tab-overline" style={{ color: '#ec4899' }}>✨ ADDED BY TAILORING</p>
                    <div className="kw-tags">
                        {keywordsGained.map((k, i) => (
                            <span key={i} className="kw-tag kw-tag--pink">{k}</span>
                        ))}
                    </div>
                </div>
            )}

            <p className="ats-footer-rubric-note">
                Estimate based on keyword, title, experience, education and format checks. Real ATS systems vary.
            </p>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────
// TAB: SKILL ROADMAP
// ─────────────────────────────────────────────────────────────

const RoadmapTab = ({ report }) => {
    const severityColor = (s) => {
        if (s === 'high') return '#ef4444'
        if (s === 'medium') return '#f59e0b'
        return '#22c55e'
    }
    return (
        <div className="tab-content tab-roadmap">
            <h2 className="tab-section-heading">Your Learning Roadmap</h2>
            <p className="tab-section-sub">A day-by-day plan based on your identified skill gaps</p>
            <p className="tab-overline">GAPS TO ADDRESS</p>
            {!report.skillGaps?.length ? (
                <div className="roadmap-no-gaps">✓ No major skill gaps — great match!</div>
            ) : (
                <div className="roadmap-gaps-list">
                    {report.skillGaps.map((gap, i) => (
                        <div key={i} className="roadmap-gap-card" style={{ borderLeftColor: severityColor(gap.severity) }}>
                            <div className="roadmap-gap-card__top">
                                <span className="roadmap-gap-card__skill">{gap.skill}</span>
                                <span className="roadmap-gap-card__badge" style={{ color: severityColor(gap.severity), borderColor: severityColor(gap.severity) }}>
                                    {(gap.severity || 'medium').toUpperCase()}
                                </span>
                            </div>
                            {gap.reason && <p className="roadmap-gap-card__reason">{gap.reason}</p>}
                            {gap.suggestion && <p className="roadmap-gap-card__suggestion">💡 {gap.suggestion}</p>}
                        </div>
                    ))}
                </div>
            )}
            <p className="tab-overline" style={{ marginTop: 28 }}>DAY-BY-DAY PLAN</p>
            <div className="roadmap-plan-list">
                {(report.preparationPlan || []).map((day) => (
                    <div key={day.day} className="roadmap-plan-day">
                        <div className="roadmap-plan-day__num">{day.day}</div>
                        <div className="roadmap-plan-day__content">
                            <p className="roadmap-plan-day__focus">{day.focus}</p>
                            <ul className="roadmap-plan-day__tasks">
                                {(day.tasks || []).map((task, i) => <li key={i}>→ {task}</li>)}
                            </ul>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────
// TAB: TECHNICAL Q
// ─────────────────────────────────────────────────────────────

const TechnicalTab = ({ report }) => (
    <div className="tab-content">
        <h2 className="tab-section-heading">
            Technical Questions
            <span className="questions-section__count">{report.technicalQuestions?.length || 0}</span>
        </h2>
        <div className="q-list">
            {(report.technicalQuestions || []).map((q, i) => <QuestionCard key={i} item={q} index={i} />)}
        </div>
    </div>
)

// ─────────────────────────────────────────────────────────────
// TAB: BEHAVIORAL Q
// ─────────────────────────────────────────────────────────────

const BehavioralTab = ({ report }) => (
    <div className="tab-content">
        <h2 className="tab-section-heading">
            Behavioral Questions
            <span className="questions-section__count">{report.behavioralQuestions?.length || 0}</span>
        </h2>
        <div className="q-list">
            {(report.behavioralQuestions || []).map((q, i) => <QuestionCard key={i} item={q} index={i} />)}
        </div>
    </div>
)

// ─────────────────────────────────────────────────────────────
// TABS CONFIG
// ─────────────────────────────────────────────────────────────

const TABS = [
    { id: 'resume',    label: 'Resume' },
    { id: 'changed',   label: 'What Changed' },
    { id: 'ats',       label: 'ATS Score' },
    { id: 'roadmap',   label: 'Skill Roadmap' },
    { id: 'technical', label: 'Technical Q' },
    { id: 'behavioral',label: 'Behavioral Q' }
]

// ─────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────

const Interview = () => {
    const [searchParams, setSearchParams] = useSearchParams()
    const activeTab = searchParams.get('tab') || 'resume'
    const setTab = (id) => setSearchParams({ tab: id }, { replace: true })

    const [showResumeBuilder, setShowResumeBuilder] = useState(false)
    const { report, loading, setReport } = useInterview()
    const { user } = useAuth()
    const { interviewId, id: routeId } = useParams()
    const effectiveId = interviewId || routeId
    const navigate = useNavigate()

    // local tailoredResume — starts from report, updated after builder or editor completes
    const [tailored, setTailored] = useState(null)
    useEffect(() => {
        if (report?.tailoredResume?.html) {
            setTailored(report.tailoredResume)
        }
    }, [report])

    // Update document.title: "{report.title} · AcePrep AI"
    useEffect(() => {
        if (report?.title) {
            document.title = `${report.title} · AcePrep AI`
        }
    }, [report?.title])

    if (loading) return <LoadingScreen />

    if (!report) {
        return (
            <div className="report-error-state">
                <p>Could not load report.</p>
            </div>
        )
    }

    const handleResumeReady = (tailoredResume) => {
        setTailored(tailoredResume)
        if (setReport) setReport(prev => prev ? { ...prev, tailoredResume } : prev)
        setShowResumeBuilder(false)
        setTab('resume')
        toast.success('Resume ready!')
    }

    return (
        <div className={`interview-page ${activeTab === 'resume' ? 'interview-page--resume-active' : ''}`}>
            {/* ── Tabs bar directly under navbar (no header block above it) ── */}
            <div className="report-tab-bar">
                <div className="report-tab-bar__tabs">
                    {TABS.map(tab => (
                        <button
                            key={tab.id}
                            className={`topbar-tab ${activeTab === tab.id ? 'topbar-tab--active' : ''}`}
                            onClick={() => setTab(tab.id)}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
                <div className="report-tab-bar__spacer" />
                <button
                    className="topbar-mock-btn"
                    onClick={() => navigate(`/mock-interview/${effectiveId}`)}
                >
                    Mock Interview →
                </button>
            </div>

            {/* ── Tab body ── */}
            <div className={`interview-body ${activeTab === 'resume' ? 'interview-body--resume-active' : ''}`}>
                {activeTab === 'resume' && (
                    <ResumeTab
                        report={report}
                        tailored={tailored}
                        setTailored={setTailored}
                        onOpenBuilder={() => setShowResumeBuilder(true)}
                        user={user}
                        onTabChange={setTab}
                    />
                )}
                {activeTab === 'changed' && (
                    <ChangesTab
                        report={report}
                        tailored={tailored}
                        onOpenBuilder={() => setShowResumeBuilder(true)}
                    />
                )}
                {activeTab === 'ats' && (
                    <AtsTab
                        report={report}
                        tailored={tailored}
                        onOpenBuilder={() => setShowResumeBuilder(true)}
                    />
                )}
                {activeTab === 'roadmap' && <RoadmapTab report={report} />}
                {activeTab === 'technical' && <TechnicalTab report={report} />}
                {activeTab === 'behavioral' && <BehavioralTab report={report} />}
            </div>

            {/* Resume Builder Modal */}
            {showResumeBuilder && report && (
                <ResumeBuilderModal
                    report={report}
                    onClose={() => setShowResumeBuilder(false)}
                    onResumeReady={handleResumeReady}
                />
            )}
        </div>
    )
}

export default Interview
