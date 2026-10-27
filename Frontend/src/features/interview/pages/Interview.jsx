import React, { useState, useEffect } from 'react'
import '../style/interview.scss'
import { useInterview } from '../hooks/useInterview.js'
import { useNavigate, useParams } from 'react-router'
import toast from 'react-hot-toast'
import ResumeBuilderModal from '../components/ResumeBuilderModal/ResumeBuilderModal.jsx'

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
            {/* Spinning dot loader */}
            <div className="loading-loader-wrap">
                <div className="pl">
                    <div className="pl__dot"></div>
                    <div className="pl__dot"></div>
                    <div className="pl__dot"></div>
                    <div className="pl__dot"></div>
                    <div className="pl__dot"></div>
                    <div className="pl__dot"></div>
                    <div className="pl__dot"></div>
                    <div className="pl__dot"></div>
                    <div className="pl__dot"></div>
                    <div className="pl__dot"></div>
                    <div className="pl__dot"></div>
                    <div className="pl__dot"></div>
                    <div className="pl__text">AI</div>
                </div>
            </div>

            {/* Step list */}
            <div className="loading-steps">
                {STEPS.slice(0, currentStep + 1).map((label, i) => {
                    const isDone = i < currentStep
                    const isActive = i === currentStep
                    return (
                        <div
                            key={i}
                            className={`loading-step ${isDone ? 'loading-step--done' : isActive ? 'loading-step--active' : ''}`}
                        >
                            {isDone ? (
                                <span className="loading-step__check">✓</span>
                            ) : (
                                <span className="loading-step__dot" />
                            )}
                            <span className="loading-step__label">{label}</span>
                            {isActive && <span className="loading-step__running">running</span>}
                        </div>
                    )
                })}
            </div>

            {/* Rotating tip */}
            <div className="loading-tip">
                <p style={{ opacity: tipVisible ? 1 : 0, transition: 'opacity 0.4s ease' }}>
                    💡 {TIPS[tipIndex]}
                </p>
            </div>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────
// SCORE RING
// ─────────────────────────────────────────────────────────────

const scoreColorHex = (score) => {
    if (score >= 80) return '#22c55e'
    if (score >= 60) return '#f59e0b'
    return '#ef4444'
}

const ScoreRing = ({ score, size = 96 }) => {
    const r = (size / 2) - 6
    const circ = 2 * Math.PI * r
    const dash = (score / 100) * circ
    const color = scoreColorHex(score)

    return (
        <div className="score-ring-wrap" style={{ width: size, height: size }}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                <circle
                    cx={size / 2} cy={size / 2} r={r}
                    fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="5"
                />
                <circle
                    cx={size / 2} cy={size / 2} r={r}
                    fill="none"
                    stroke={color}
                    strokeWidth="5"
                    strokeDasharray={`${dash} ${circ}`}
                    strokeLinecap="round"
                    transform={`rotate(-90 ${size / 2} ${size / 2})`}
                />
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
// TABS
// ─────────────────────────────────────────────────────────────

const TAB_RESUME = 'resume'
const TAB_CHANGES = 'changes'
const TAB_ATS = 'ats'
const TAB_ROADMAP = 'roadmap'

const TABS = [
    { id: TAB_RESUME, label: 'Resume' },
    { id: TAB_CHANGES, label: 'What Changed' },
    { id: TAB_ATS, label: 'ATS Score' },
    { id: TAB_ROADMAP, label: 'Skill Roadmap' }
]

// ─────────────────────────────────────────────────────────────
// TAB 1 — Resume
// ─────────────────────────────────────────────────────────────

const ResumeTab = ({ report, onOpenBuilder }) => {
    const scoreColor = scoreColorHex(report.matchScore)

    const scoreLabel = () => {
        const s = report.matchScore
        if (s >= 85) return { text: 'Strong Match', color: '#22c55e' }
        if (s >= 70) return { text: 'Good Match', color: '#86efac' }
        if (s >= 55) return { text: 'Moderate Match', color: '#f59e0b' }
        return { text: 'Needs Work', color: '#ef4444' }
    }
    const label = scoreLabel()

    const totalQs = (report.technicalQuestions?.length || 0) + (report.behavioralQuestions?.length || 0)
    const gapCount = report.skillGaps?.length || 0
    const gapColor = gapCount >= 3 ? '#ef4444' : gapCount >= 1 ? '#f59e0b' : '#22c55e'
    const planDays = report.preparationPlan?.length || 0

    return (
        <div className="tab-content tab-resume">
            <div className="tab-resume__grid">
                {/* ── Left 65% ── */}
                <div className="tab-resume__left">
                    <div className="tab-resume__header-row">
                        <h2 className="tab-resume__heading">Your Tailored Resume</h2>
                        <div className="tab-resume__dl-row">
                            <button
                                className="dl-btn dl-btn--primary"
                                onClick={onOpenBuilder}
                            >
                                ↓ Download PDF
                            </button>
                            <button
                                className="dl-btn dl-btn--ghost"
                                onClick={() => toast('Word download coming soon', { icon: '📄' })}
                            >
                                ↓ Download Word
                            </button>
                        </div>
                    </div>

                    <div className="resume-summary-card">
                        <h3 className="resume-summary-card__name">{report.title || 'Your Resume'}</h3>
                        <p className="resume-summary-card__for">Tailored for: {report.title}</p>

                        <div className="resume-summary-card__divider" />

                        <div className="resume-summary-card__chips">
                            <span className="chip">📄 1 Page</span>
                            <span className="chip">✓ ATS Safe</span>
                            <span className="chip">✓ Keywords Matched</span>
                        </div>

                        <div className="resume-summary-card__divider" />

                        {report.matchSummary && (
                            <p className="resume-summary-card__summary">{report.matchSummary}</p>
                        )}

                        <div className="resume-summary-card__cta">
                            <button className="dl-btn dl-btn--primary dl-btn--sm" onClick={onOpenBuilder}>
                                ↓ Download PDF
                            </button>
                            <button
                                className="dl-btn dl-btn--ghost dl-btn--sm"
                                onClick={() => toast('Word download coming soon', { icon: '📄' })}
                            >
                                ↓ Download Word
                            </button>
                        </div>
                    </div>
                </div>

                {/* ── Right 35%: ATS Sidebar ── */}
                <aside className="tab-resume__right">
                    <div className="ats-sidebar-card">
                        <p className="ats-sidebar-card__label">ATS MATCH SCORE</p>
                        <div className="ats-sidebar-card__ring-wrap">
                            <ScoreRing score={report.matchScore} size={96} />
                        </div>
                        {report.matchSummary && (
                            <p className="ats-sidebar-card__summary">{report.matchSummary}</p>
                        )}
                        <div className="ats-sidebar-card__divider" />
                        <p className="ats-sidebar-card__label-score" style={{ color: label.color }}>
                            {label.text}
                        </p>
                        <div className="ats-sidebar-card__divider" />
                        <div className="ats-quick-stats">
                            <div className="ats-quick-stat">
                                <span className="ats-quick-stat__icon">📋</span>
                                <span className="ats-quick-stat__label">Questions Generated</span>
                                <span className="ats-quick-stat__val">{totalQs}</span>
                            </div>
                            <div className="ats-quick-stat">
                                <span className="ats-quick-stat__icon">⚠</span>
                                <span className="ats-quick-stat__label">Skill Gaps Found</span>
                                <span className="ats-quick-stat__val" style={{ color: gapColor }}>{gapCount}</span>
                            </div>
                            <div className="ats-quick-stat">
                                <span className="ats-quick-stat__icon">📅</span>
                                <span className="ats-quick-stat__label">Prep Plan</span>
                                <span className="ats-quick-stat__val">{planDays} days</span>
                            </div>
                        </div>
                    </div>
                </aside>
            </div>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────
// TAB 2 — What Changed
// ─────────────────────────────────────────────────────────────

const ChangesTab = ({ report }) => {
    const gapSkillNames = (report.skillGaps || []).slice(0, 5).map(g => g.skill)
    const summaryPreview = (report.matchSummary || '').slice(0, 120)
    const scoreGood = report.matchScore >= 70

    const cards = [
        {
            icon: '✓', green: true,
            title: 'Skills aligned to job description',
            desc: 'Your skills section was reordered to match the most critical requirements of this role.'
        },
        {
            icon: '✓', green: true,
            title: 'Professional summary tailored',
            desc: summaryPreview + (report.matchSummary?.length > 120 ? '...' : '')
        },
        {
            icon: '✓', green: true,
            title: 'ATS keywords incorporated',
            desc: gapSkillNames.length > 0
                ? `Added: ${gapSkillNames.join(', ')}`
                : 'Resume keywords were optimized to match this role.'
        },
        {
            icon: scoreGood ? '✓' : '⚠', green: scoreGood,
            title: `ATS match score: ${report.matchScore}%`,
            desc: report.matchSummary || 'Match analysis complete.'
        }
    ]

    return (
        <div className="tab-content tab-changes">
            <h2 className="tab-section-heading">Resume Improvements</h2>
            <p className="tab-section-sub">Key changes made to tailor your resume for this role</p>
            <div className="changes-list">
                {cards.map((c, i) => (
                    <div key={i} className="changes-card">
                        <div className={`changes-card__icon-wrap ${c.green ? 'changes-card__icon-wrap--green' : 'changes-card__icon-wrap--amber'}`}>
                            {c.icon}
                        </div>
                        <div className="changes-card__body">
                            <p className="changes-card__title">{c.title}</p>
                            <p className="changes-card__desc">{c.desc}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────
// TAB 3 — ATS Score
// ─────────────────────────────────────────────────────────────

const AtsTab = ({ report }) => {
    const score = report.matchScore
    const color = scoreColorHex(score)
    const gapsHigh = (report.skillGaps || []).filter(g => g.severity === 'high' || g.severity === 'medium')
    const gapsLow = (report.skillGaps || []).filter(g => g.severity === 'low')

    const barLabel = score >= 85 ? 'Strong' : score >= 70 ? 'Good' : score >= 55 ? 'Moderate' : 'Needs Work'

    return (
        <div className="tab-content tab-ats">
            <h2 className="tab-section-heading">ATS Score Breakdown</h2>

            <div className="ats-score-hero">
                <ScoreRing score={score} size={120} />
                <p className="ats-score-hero__label">Match Score</p>
            </div>

            <div className="ats-breakdown-grid">
                {/* Strengths */}
                <div className="ats-col ats-col--green">
                    <p className="ats-col__title ats-col__title--green">✓ Strengths</p>
                    <ul className="ats-col__list">
                        {gapsLow.map((g, i) => (
                            <li key={i} className="ats-col__item">
                                <span className="ats-dot ats-dot--green" />
                                {g.skill}
                            </li>
                        ))}
                        <li className="ats-col__item">
                            <span className="ats-dot ats-dot--green" />
                            Strong experience aligned to role
                        </li>
                        <li className="ats-col__item">
                            <span className="ats-dot ats-dot--green" />
                            Resume tailored to job requirements
                        </li>
                    </ul>
                </div>

                {/* Gaps */}
                <div className="ats-col ats-col--amber">
                    <p className="ats-col__title ats-col__title--amber">⚠ Gaps</p>
                    <ul className="ats-col__list">
                        {gapsHigh.length === 0 ? (
                            <li className="ats-col__item ats-col__item--muted">No major gaps identified.</li>
                        ) : gapsHigh.map((g, i) => (
                            <li key={i} className="ats-col__item ats-col__item--gap">
                                <span className="ats-gap__skill">{g.skill}</span>
                                {g.reason && <span className="ats-gap__reason">{g.reason}</span>}
                            </li>
                        ))}
                    </ul>
                </div>
            </div>

            {/* Score bar */}
            <div className="ats-score-bar-wrap">
                <div className="ats-score-bar">
                    <div
                        className="ats-score-bar__fill"
                        style={{ width: `${score}%`, backgroundColor: color }}
                    />
                    <div
                        className="ats-score-bar__marker"
                        style={{ left: `${score}%` }}
                    >
                        <span className="ats-score-bar__marker-label">{score}%</span>
                    </div>
                </div>
                <div className="ats-score-bar__labels">
                    <span>0</span>
                    <span>25</span>
                    <span>50</span>
                    <span>75</span>
                    <span>100</span>
                </div>
                <div className="ats-score-bar__ranges">
                    <span>Needs Work</span>
                    <span>Moderate</span>
                    <span>Good</span>
                    <span>Strong</span>
                </div>
            </div>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────
// TAB 4 — Skill Roadmap
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

            {/* Skill Gaps */}
            <p className="tab-overline">GAPS TO ADDRESS</p>
            {report.skillGaps?.length === 0 ? (
                <div className="roadmap-no-gaps">
                    <span>✓</span> No major skill gaps identified — great match!
                </div>
            ) : (
                <div className="roadmap-gaps-list">
                    {(report.skillGaps || []).map((gap, i) => (
                        <div
                            key={i}
                            className="roadmap-gap-card"
                            style={{ borderLeftColor: severityColor(gap.severity) }}
                        >
                            <div className="roadmap-gap-card__top">
                                <span className="roadmap-gap-card__skill">{gap.skill}</span>
                                <span
                                    className="roadmap-gap-card__badge"
                                    style={{ color: severityColor(gap.severity), borderColor: severityColor(gap.severity) }}
                                >
                                    {(gap.severity || 'medium').toUpperCase()}
                                </span>
                            </div>
                            {gap.reason && <p className="roadmap-gap-card__reason">{gap.reason}</p>}
                            {gap.suggestion && (
                                <p className="roadmap-gap-card__suggestion">💡 {gap.suggestion}</p>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Prep Plan */}
            <p className="tab-overline" style={{ marginTop: 28 }}>DAY-BY-DAY PLAN</p>
            <div className="roadmap-plan-list">
                {(report.preparationPlan || []).map((day) => (
                    <div key={day.day} className="roadmap-plan-day">
                        <div className="roadmap-plan-day__num">{day.day}</div>
                        <div className="roadmap-plan-day__content">
                            <p className="roadmap-plan-day__focus">{day.focus}</p>
                            <ul className="roadmap-plan-day__tasks">
                                {(day.tasks || []).map((task, i) => (
                                    <li key={i}>→ {task}</li>
                                ))}
                            </ul>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────
// MAIN INTERVIEW / REPORT PAGE
// ─────────────────────────────────────────────────────────────

const Interview = () => {
    const [activeTab, setActiveTab] = useState(TAB_RESUME)
    const [showResumeBuilder, setShowResumeBuilder] = useState(false)
    const { report, loading } = useInterview()
    const { interviewId, id: routeId } = useParams()
    const effectiveId = interviewId || routeId
    const navigate = useNavigate()

    if (loading) return <LoadingScreen />

    if (!report) {
        return (
            <div className="report-error-state">
                <p>Could not load report.</p>
            </div>
        )
    }

    const handleMockInterview = () => navigate(`/mock-interview/${effectiveId}`)

    return (
        <div className="interview-page">
            {/* ── Sticky Top Bar ── */}
            <div className="report-topbar">
                <div className="report-topbar__left">
                    <span className="report-topbar__title">{report.title || 'Interview Report'}</span>
                    <span className="report-topbar__date">
                        {new Date(report.createdAt || Date.now()).toLocaleDateString('en-US', {
                            year: 'numeric', month: 'short', day: 'numeric'
                        })}
                    </span>
                </div>
                <div className="report-topbar__right">
                    {TABS.map(tab => (
                        <button
                            key={tab.id}
                            className={`topbar-tab ${activeTab === tab.id ? 'topbar-tab--active' : ''}`}
                            onClick={() => setActiveTab(tab.id)}
                        >
                            {tab.label}
                        </button>
                    ))}
                    <button
                        className="topbar-mock-btn"
                        onClick={handleMockInterview}
                    >
                        Mock Interview →
                    </button>
                </div>
            </div>

            {/* ── Tab Content Area ── */}
            <div className="interview-body">
                {activeTab === TAB_RESUME && (
                    <ResumeTab report={report} onOpenBuilder={() => setShowResumeBuilder(true)} />
                )}
                {activeTab === TAB_CHANGES && <ChangesTab report={report} />}
                {activeTab === TAB_ATS && <AtsTab report={report} />}
                {activeTab === TAB_ROADMAP && <RoadmapTab report={report} />}

                {/* ── Technical Questions (always visible below tabs) ── */}
                <div className="report-questions-divider" />

                <section id="technical-questions" className="questions-section">
                    <h2 className="questions-section__heading">
                        Technical Questions
                        <span className="questions-section__count">
                            {report.technicalQuestions?.length || 0}
                        </span>
                    </h2>
                    <div className="q-list">
                        {(report.technicalQuestions || []).map((q, i) => (
                            <QuestionCard key={i} item={q} index={i} />
                        ))}
                    </div>
                </section>

                {/* ── Behavioral Questions ── */}
                <section id="behavioral-questions" className="questions-section">
                    <h2 className="questions-section__heading">
                        Behavioral Questions
                        <span className="questions-section__count">
                            {report.behavioralQuestions?.length || 0}
                        </span>
                    </h2>
                    <div className="q-list">
                        {(report.behavioralQuestions || []).map((q, i) => (
                            <QuestionCard key={i} item={q} index={i} />
                        ))}
                    </div>
                </section>
            </div>

            {/* ── Resume Builder Modal ── */}
            {showResumeBuilder && report && (
                <ResumeBuilderModal
                    report={report}
                    onClose={() => setShowResumeBuilder(false)}
                    onDownloadComplete={() => {
                        setShowResumeBuilder(false)
                        toast.success('Resume downloaded!')
                    }}
                />
            )}
        </div>
    )
}

export default Interview
