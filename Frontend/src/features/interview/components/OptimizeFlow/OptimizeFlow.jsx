import React, {
    useState, useEffect, useRef, useContext, useCallback
} from 'react'
import { useNavigate } from 'react-router'
import toast from 'react-hot-toast'
import axios from 'axios'

import { InterviewContext } from '../../interview.context.jsx'
import {
    generateInterviewReport,
    getResumeOptions,
    generateTailoredResume
} from '../../services/interview.api.js'
import './OptimizeFlow.scss'

// ─────────────────────────────────────────────────────────────
// CONSTANTS (reused from Interview.jsx)
// ─────────────────────────────────────────────────────────────

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

const ANALYZE_STATUSES = [
    'Reading your resume',
    'Parsing the job description',
    'Finding your strongest stories',
    'Rewriting your experience section',
    'Aligning to ATS keywords',
    'Polishing the output',
    'Almost ready'
]

const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 }

function buildSuggestions(skillGaps = []) {
    return [...skillGaps]
        .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
        .slice(0, 8)
        .map(gap => ({
            skill: gap.skill,
            severity: gap.severity,
            reason: gap.reason || '',
            selected: gap.severity === 'high'
        }))
}

// ─────────────────────────────────────────────────────────────
// SMALL COMPONENTS
// ─────────────────────────────────────────────────────────────

function StepIndicator({ step }) {
    const labels = ['Skills', 'Summary', 'Build']
    return (
        <div className="of-step-indicator">
            {labels.map((label, i) => {
                const idx = i + 1
                const cls =
                    idx < step ? 'of-step-indicator__step--done' :
                    idx === step ? 'of-step-indicator__step--active' : ''
                return (
                    <React.Fragment key={label}>
                        <span className={`of-step-indicator__step ${cls}`}>
                            {idx < step && '✓ '}{label}
                        </span>
                        {i < labels.length - 1 && (
                            <span className="of-step-indicator__divider" />
                        )}
                    </React.Fragment>
                )
            })}
        </div>
    )
}

function SkillCard({ item, onToggle, disabled }) {
    return (
        <div
            className={`of-skill-card ${item.selected ? 'of-skill-card--selected' : ''} ${disabled ? 'of-skill-card--disabled' : ''}`}
            onClick={() => !disabled && onToggle(item.skill)}
        >
            <input
                type="checkbox"
                className="of-skill-card__checkbox"
                checked={item.selected}
                readOnly
                onClick={e => e.stopPropagation()}
            />
            <div className="of-skill-card__content">
                <div className="of-skill-card__header">
                    <span className="of-skill-card__name">{item.skill}</span>
                    <span className={`of-skill-card__badge of-skill-card__badge--${item.severity}`}>
                        {item.severity}
                    </span>
                </div>
                {item.reason && <p className="of-skill-card__reason">{item.reason}</p>}
            </div>
        </div>
    )
}

function SkeletonCard() {
    return (
        <div className="of-skeleton-card">
            <div className="of-skeleton-card__checkbox" />
            <div className="of-skeleton-card__lines">
                <div className="of-skeleton-card__line of-skeleton-card__line--wide" />
                <div className="of-skeleton-card__line of-skeleton-card__line--narrow" />
            </div>
        </div>
    )
}

function AnalyzeStatus({ statuses, currentIdx }) {
    return (
        <div className="of-analyze-status">
            {statuses.slice(0, currentIdx + 1).map((label, i) => {
                const isDone = i < currentIdx
                const isActive = i === currentIdx
                return (
                    <div
                        key={i}
                        className={`of-analyze-status__row ${isDone ? 'of-analyze-status__row--done' : isActive ? 'of-analyze-status__row--active' : ''}`}
                    >
                        {isDone
                            ? <span className="of-analyze-status__check">✓</span>
                            : <span className="of-analyze-status__dot" />}
                        <span className="of-analyze-status__label">{label}</span>
                        {isActive && <span className="of-analyze-status__running">running</span>}
                    </div>
                )
            })}
        </div>
    )
}

function RotatingTip({ tipIndex, tipVisible }) {
    return (
        <div className="of-tip">
            <p style={{ opacity: tipVisible ? 1 : 0, transition: 'opacity 0.4s ease' }}>
                Tip: {TIPS[tipIndex]}
            </p>
        </div>
    )
}

const GEN_STEPS = [
    'Processing your selections',
    'Tailoring skill descriptions',
    'Crafting your resume',
    'Scoring ATS match',
]

function BuildingView() {
    const [activeIdx, setActiveIdx] = useState(0)
    useEffect(() => {
        const timings = [800, 2500, 5000]
        const timers = timings.map((delay, i) =>
            setTimeout(() => setActiveIdx(i + 1), delay)
        )
        return () => timers.forEach(clearTimeout)
    }, [])

    return (
        <div className="of-building">
            <div className="of-building__loader-wrap">
                <div className="pl" style={{ fontSize: 10 }}>
                    {Array.from({ length: 12 }).map((_, i) => <div key={i} className="pl__dot" />)}
                    <div className="pl__text">AI</div>
                </div>
            </div>
            <div className="of-building__steps">
                {GEN_STEPS.map((label, i) => {
                    const isDone = i < activeIdx
                    const isActive = i === activeIdx
                    return (
                        <div
                            key={label}
                            className={`of-building__step ${isDone ? 'of-building__step--done' : isActive ? 'of-building__step--active' : ''}`}
                        >
                            <div className="of-building__step-icon">
                                {isDone && <span className="of-building__check">✓</span>}
                                {isActive && <div className="of-building__spinner" />}
                                {!isDone && !isActive && <div className="of-building__empty" />}
                            </div>
                            {label}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────
// CONFIRM DIALOG
// ─────────────────────────────────────────────────────────────

function ConfirmDialog({ reportExists, onLeave, onStay, reportId }) {
    const navigate = useNavigate()
    const handleLeave = () => {
        if (reportExists && reportId) {
            navigate(`/interview/${reportId}?tab=resume`)
        } else {
            onLeave()
        }
    }

    return (
        <div className="of-confirm">
            <p>
                {reportExists
                    ? 'Leave without tailored resume? Your report is saved.'
                    : 'Cancel the optimization? Your form data will be restored.'}
            </p>
            <div className="of-confirm__actions">
                <button className="of-btn of-btn--ghost" onClick={handleLeave}>
                    {reportExists ? 'Leave' : 'Yes, cancel'}
                </button>
                <button className="of-btn of-btn--primary" onClick={onStay}>
                    Keep going
                </button>
            </div>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────

/**
 * OptimizeFlow — full-screen wizard that runs the optimize + tailoring flow.
 *
 * Props:
 *   formData  { jobDescription, selfDescription, resumeFile }
 *   onCancel  () => void   — restore home form state if flow is cancelled before report
 */
export default function OptimizeFlow({ formData, onCancel }) {
    const navigate = useNavigate()
    const { setReport } = useContext(InterviewContext)

    // ── Report generation state ──────────────────────────────
    const [reportState, setReportState] = useState('pending') // pending | success | error
    const [report, setLocalReport] = useState(null)
    const abortRef = useRef(null)

    // ── UI state ─────────────────────────────────────────────
    const [step, setStep] = useState(1)
    const [showConfirm, setShowConfirm] = useState(false)

    // ── Analyze animation ────────────────────────────────────
    const [analyzeIdx, setAnalyzeIdx] = useState(0)
    const [tipIndex, setTipIndex] = useState(0)
    const [tipVisible, setTipVisible] = useState(true)

    // ── Step 1 state ─────────────────────────────────────────
    const [suggestions, setSuggestions] = useState([])
    const [customSkillInput, setCustomSkillInput] = useState('')
    const [customSkills, setCustomSkills] = useState([])
    const [step1Loading, setStep1Loading] = useState(false)
    const [step1Error, setStep1Error] = useState(false)

    // ── Step 2 state ─────────────────────────────────────────
    const [options, setOptions] = useState(null)
    const [chosenSummary, setChosenSummary] = useState(null)
    const [noEvidenceOverride, setNoEvidenceOverride] = useState({})
    const [step2Error, setStep2Error] = useState(false)

    // ─────────────────────────────────────────────────────────
    // 1. Start report generation on mount
    // ─────────────────────────────────────────────────────────
    useEffect(() => {
        abortRef.current = new AbortController()
        const run = async () => {
            try {
                const data = await generateInterviewReport({
                    jobDescription: formData.jobDescription,
                    selfDescription: formData.selfDescription,
                    resumeFile: formData.resumeFile,
                    signal: abortRef.current.signal
                })
                const r = data?.interviewReport
                if (!r) throw new Error('No report returned')
                setLocalReport(r)
                setReport(r)
                setSuggestions(buildSuggestions(r.skillGaps))
                setReportState('success')
            } catch (err) {
                if (axios.isCancel(err) || err.name === 'CanceledError') return
                setReportState('error')
                toast.error(err.response?.data?.message || 'Failed to generate report. Please try again.')
                onCancel()
            }
        }
        run()
        return () => abortRef.current?.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // ─────────────────────────────────────────────────────────
    // 2. Analyze animation while loading
    // ─────────────────────────────────────────────────────────
    useEffect(() => {
        if (reportState !== 'pending') return
        const interval = setInterval(() => {
            setAnalyzeIdx(prev =>
                prev < ANALYZE_STATUSES.length - 1 ? prev + 1 : prev
            )
        }, 4000)
        return () => clearInterval(interval)
    }, [reportState])

    // Rotating tips
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

    // ─────────────────────────────────────────────────────────
    // DERIVED
    // ─────────────────────────────────────────────────────────
    const allSuggestions = [...suggestions, ...customSkills]
    const selectedSkills = allSuggestions.filter(s => s.selected).map(s => s.skill)
    const canGoNext = selectedSkills.length > 0

    const chosenSummaryText = chosenSummary === 'A'
        ? options?.summaryA?.text
        : chosenSummary === 'B'
            ? options?.summaryB?.text
            : null

    const finalSkillsWithEvidence = (options?.skillsWithEvidence || []).filter(s => {
        if (s.hasEvidence) return true
        return noEvidenceOverride[s.skill] !== false
    })

    // ─────────────────────────────────────────────────────────
    // HANDLERS
    // ─────────────────────────────────────────────────────────
    const toggleSuggestion = (skill) => {
        setSuggestions(prev => prev.map(s => s.skill === skill ? { ...s, selected: !s.selected } : s))
    }

    const toggleCustomSkill = (skill) => {
        setCustomSkills(prev => prev.map(s => s.skill === skill ? { ...s, selected: !s.selected } : s))
    }

    const addCustomSkill = () => {
        const trimmed = customSkillInput.trim()
        if (!trimmed) return
        if (customSkills.length >= 3) {
            toast('Maximum 3 custom skills allowed.', { icon: 'ℹ️' })
            return
        }
        if (allSuggestions.some(s => s.skill.toLowerCase() === trimmed.toLowerCase())) {
            toast('That skill is already in the list.')
            return
        }
        setCustomSkills(prev => [...prev, { skill: trimmed, severity: 'low', reason: '', selected: true }])
        setCustomSkillInput('')
    }

    const handleCustomKeyDown = (e) => {
        if (e.key === 'Enter') { e.preventDefault(); addCustomSkill() }
    }

    const handleNext = useCallback(async (skipSkills = false) => {
        const skills = skipSkills ? [] : selectedSkills
        setStep1Loading(true)
        setStep1Error(false)
        try {
            const data = await getResumeOptions(report._id, skills)
            setOptions(data.options)
            setChosenSummary(null)
            setNoEvidenceOverride({})
            setStep(2)
        } catch (err) {
            toast.error('Failed to generate summaries — please try again.')
            setStep1Error(true)
        } finally {
            setStep1Loading(false)
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [report, selectedSkills])

    const handleGenerate = useCallback(async () => {
        if (!chosenSummaryText) return
        setStep(3)
        try {
            const summaryLabel = chosenSummary === 'A'
                ? (options?.summaryA?.label || 'Technical depth focus')
                : (options?.summaryB?.label || 'Role fit focus')

            const data = await generateTailoredResume({
                reportId: report._id,
                confirmedSkills: selectedSkills,
                chosenSummary: chosenSummaryText,
                skillsWithEvidence: finalSkillsWithEvidence,
                irrelevantSkillsToDeprioritize: [],
                summaryLabel
            })

            // Update context so report page has the data immediately
            setReport(prev => prev ? { ...prev, tailoredResume: data.tailoredResume } : prev)
            navigate(`/interview/${report._id}?tab=resume`, { replace: true })
        } catch (err) {
            toast.error('Resume generation failed — please try again.')
            setStep(2)
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [report, chosenSummary, chosenSummaryText, options, selectedSkills, finalSkillsWithEvidence])

    const handleCloseAttempt = () => setShowConfirm(true)

    const handleLeave = () => {
        abortRef.current?.abort()
        onCancel()
    }

    // ─────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────
    const isPending = reportState === 'pending'

    return (
        <div className="of-overlay">
            {/* Header */}
            <div className="of-header">
                <span className="of-header__title">Tailor your resume</span>
                <StepIndicator step={step} />
                {step !== 3 && (
                    <button className="of-header__close" onClick={handleCloseAttempt} aria-label="Close">
                        ✕
                    </button>
                )}
            </div>

            {/* Confirm dialog */}
            {showConfirm && (
                <ConfirmDialog
                    reportExists={report !== null}
                    reportId={report?._id}
                    onLeave={handleLeave}
                    onStay={() => setShowConfirm(false)}
                />
            )}

            {/* Body */}
            <div className="of-body">

                {/* ══════════════════════ STEP 1 ══════════════════════ */}
                {step === 1 && (
                    <div className="of-step1">
                        <div className="of-step1__header">
                            <h2>Tailor Your Skills</h2>
                            <p>Select skills from the job description that you genuinely know. These will be added to your resume's skills section.</p>
                        </div>

                        {/* While analyzing: status + skeletons */}
                        {isPending && (
                            <div className="of-step1__loading-block">
                                <AnalyzeStatus statuses={ANALYZE_STATUSES} currentIdx={analyzeIdx} />
                                <div className="of-step1__skeletons">
                                    {[0, 1].map(i => <SkeletonCard key={i} />)}
                                </div>
                            </div>
                        )}

                        {/* After report arrives: real cards */}
                        {!isPending && (
                            <div className="of-step1__cards">
                                {suggestions.length === 0 ? (
                                    <div className="of-empty-state">
                                        No skill gaps identified — your skills are a strong match. You can still add custom skills below.
                                    </div>
                                ) : (
                                    suggestions.map(item => (
                                        <SkillCard
                                            key={item.skill}
                                            item={item}
                                            onToggle={toggleSuggestion}
                                        />
                                    ))
                                )}

                                {customSkills.map(item => (
                                    <SkillCard
                                        key={item.skill}
                                        item={item}
                                        onToggle={toggleCustomSkill}
                                    />
                                ))}
                            </div>
                        )}

                        {/* Custom skill input — active even while pending */}
                        <div className="of-custom-skill">
                            <input
                                type="text"
                                className="of-custom-skill__input"
                                placeholder="Add a skill not listed above…"
                                value={customSkillInput}
                                onChange={e => setCustomSkillInput(e.target.value)}
                                onKeyDown={handleCustomKeyDown}
                                maxLength={40}
                                disabled={customSkills.length >= 3}
                            />
                            <button
                                className="of-custom-skill__add"
                                onClick={addCustomSkill}
                                disabled={!customSkillInput.trim() || customSkills.length >= 3}
                            >
                                Add
                            </button>
                        </div>

                        {/* Tips */}
                        <RotatingTip tipIndex={tipIndex} tipVisible={tipVisible} />

                        {/* Footer */}
                        <div className="of-footer">
                            <button
                                className="of-skip-link"
                                onClick={() => handleNext(true)}
                                disabled={isPending || step1Loading}
                            >
                                Skip for now
                            </button>
                            <button
                                className={`of-btn of-btn--primary ${step1Loading ? 'of-btn--loading' : ''}`}
                                onClick={() => handleNext(false)}
                                disabled={isPending || !canGoNext || step1Loading}
                            >
                                {step1Loading
                                    ? <><span className="of-spinner" /> Generating summaries…</>
                                    : 'Next: Choose Summary →'}
                            </button>
                        </div>
                    </div>
                )}

                {/* ══════════════════════ STEP 2 ══════════════════════ */}
                {step === 2 && (
                    <div className="of-step2">
                        <div className="of-step2__header">
                            <h2>Choose Your Summary</h2>
                            <p>Pick the opening that best fits how you want to present yourself for this role.</p>
                        </div>

                        {step2Error && !options ? (
                            <div className="of-step-error">
                                <p>Something went wrong generating your summaries.</p>
                                <button
                                    className="of-btn of-btn--primary"
                                    onClick={() => { setStep2Error(false); handleNext(selectedSkills.length === 0) }}
                                >
                                    Try again
                                </button>
                            </div>
                        ) : options && (
                            <>
                                {/* Summary cards */}
                                <div className="of-summaries">
                                    {[
                                        { key: 'A', data: options.summaryA },
                                        { key: 'B', data: options.summaryB }
                                    ].map(({ key, data }) => (
                                        <div
                                            key={key}
                                            className={`of-summary-card ${chosenSummary === key ? 'of-summary-card--selected' : ''}`}
                                            onClick={() => setChosenSummary(key)}
                                        >
                                            <span className="of-summary-card__label">{data.label}</span>
                                            <p className="of-summary-card__text">{data.text}</p>
                                            <button
                                                className="of-summary-card__select-btn"
                                                onClick={e => { e.stopPropagation(); setChosenSummary(key) }}
                                            >
                                                {chosenSummary === key ? '✓ Selected' : 'Use this summary'}
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                {/* Skill evidence */}
                                {(options.skillsWithEvidence || []).length > 0 && (
                                    <div className="of-skill-evidence">
                                        {options.skillsWithEvidence.some(s => s.hasEvidence) && (
                                            <>
                                                <p className="of-skill-evidence__title">Skills with project evidence</p>
                                                {options.skillsWithEvidence.filter(s => s.hasEvidence).map(s => (
                                                    <div key={s.skill} className="of-skill-evidence__item of-skill-evidence__item--confirmed">
                                                        <span className="of-skill-evidence__icon">✓</span>
                                                        <span>{s.skill}{s.evidenceNote ? ` — ${s.evidenceNote}` : ''}</span>
                                                    </div>
                                                ))}
                                            </>
                                        )}
                                        {options.skillsWithEvidence.some(s => !s.hasEvidence) && (
                                            <>
                                                <p className="of-skill-evidence__title" style={{ marginTop: 14 }}>Skills without project evidence</p>
                                                {options.skillsWithEvidence.filter(s => !s.hasEvidence).map(s => (
                                                    <div key={s.skill} className="of-skill-evidence__item of-skill-evidence__item--warning">
                                                        <div className="of-evidence-row">
                                                            <span className="of-skill-evidence__icon">⚠</span>
                                                            <span>{s.skill} — No project evidence found</span>
                                                        </div>
                                                        <p className="of-skill-evidence__warning-note">
                                                            This skill will appear in your skills section but is not evidenced in any project bullet.
                                                        </p>
                                                        <label className="of-skill-evidence__include-row">
                                                            <input
                                                                type="checkbox"
                                                                checked={noEvidenceOverride[s.skill] !== false}
                                                                onChange={e => setNoEvidenceOverride(prev => ({ ...prev, [s.skill]: e.target.checked }))}
                                                            />
                                                            Include anyway
                                                        </label>
                                                    </div>
                                                ))}
                                            </>
                                        )}
                                    </div>
                                )}
                            </>
                        )}

                        {/* Footer */}
                        <div className="of-footer">
                            <div className="of-footer__left">
                                <button
                                    className="of-btn of-btn--ghost"
                                    onClick={() => { setStep(1); setOptions(null); setStep2Error(false) }}
                                >
                                    ← Back
                                </button>
                                <button className="of-skip-link" onClick={handleCloseAttempt}>
                                    Skip for now
                                </button>
                            </div>
                            <button
                                className="of-btn of-btn--primary"
                                onClick={handleGenerate}
                                disabled={!chosenSummary}
                            >
                                Generate Tailored Resume →
                            </button>
                        </div>
                    </div>
                )}

                {/* ══════════════════════ STEP 3 ══════════════════════ */}
                {step === 3 && (
                    <div className="of-step3">
                        <h2>Building your resume…</h2>
                        <p>This usually takes 15–30 seconds. Please don't close the window.</p>
                        <BuildingView />
                    </div>
                )}

            </div>
        </div>
    )
}

