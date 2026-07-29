import React, { useState, useCallback, useEffect, useRef } from 'react'
import toast from 'react-hot-toast'
import { getResumeOptions, generateResumePdf } from '../../services/interview.api.js'
import './ResumeBuilderModal.scss'

// ── Helpers ───────────────────────────────────────────────────────────────────

const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 }

/** Sort high → medium → low, cap at 8 */
function buildSuggestions(skillGaps = []) {
    return [...skillGaps]
        .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
        .slice(0, 8)
        .map(gap => ({
            skill:    gap.skill,
            severity: gap.severity,
            reason:   gap.reason || '',
            selected: gap.severity === 'high'
        }))
}

/** Skills from the report that don't appear in the JD (case-insensitive substring) */
function buildIrrelevantSkills(report) {
    // Try to pull skills from the raw resume text heuristically — split on commas/pipes/newlines
    // The report model stores the resume but not a parsed skills array, so we fall back to
    // extracting from skillGaps-adjacent logic. If nothing is available return empty.
    const jdLower = (report.jobDescription || '').toLowerCase()

    // Build a flat skills list from technicalQuestions topic areas as a proxy
    // (the actual parsed skill list isn't in the report object sent to the frontend,
    //  so we extract candidate-facing skills by checking all gap skills against JD)
    const allGapSkills = (report.skillGaps || []).map(g => g.skill)

    // Return gap skills that are NOT in the JD — these shouldn't be de-emphasised
    // (they're already gaps). The "irrelevant" bucket is really skills the candidate
    // already has that the JD doesn't mention. Since we don't have a parsed skills list
    // in the report, we expose this as an empty list that the user can still fill via
    // the custom input. This is accurate behaviour — no hallucinated data.
    return []
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StepIndicator({ step }) {
    const steps = ['Skills', 'Summary', 'Generating']
    return (
        <div className="resume-builder-modal__steps">
            {steps.map((label, i) => {
                const idx = i + 1
                const cls =
                    idx < step ? 'resume-builder-modal__step--done' :
                    idx === step ? 'resume-builder-modal__step--active' : ''
                return (
                    <React.Fragment key={label}>
                        <span className={`resume-builder-modal__step ${cls}`}>
                            {idx < step && '✓ '}{label}
                        </span>
                        {i < steps.length - 1 && <span className="resume-builder-modal__step-divider" />}
                    </React.Fragment>
                )
            })}
        </div>
    )
}

function SkillCard({ item, onToggle }) {
    return (
        <div
            className={`skill-suggestion ${item.selected ? 'skill-suggestion--selected' : ''}`}
            onClick={() => onToggle(item.skill)}
        >
            <input
                type="checkbox"
                className="skill-suggestion__checkbox"
                checked={item.selected}
                onChange={() => onToggle(item.skill)}
                onClick={e => e.stopPropagation()}
            />
            <div className="skill-suggestion__content">
                <div className="skill-suggestion__header">
                    <span className="skill-suggestion__name">{item.skill}</span>
                    <span className={`skill-suggestion__badge skill-suggestion__badge--${item.severity}`}>
                        {item.severity}
                    </span>
                </div>
                {item.reason && <p className="skill-suggestion__reason">{item.reason}</p>}
            </div>
        </div>
    )
}

// ── Generating step progress ──────────────────────────────────────────────────

const GEN_STEPS = [
    'Processing your selections',
    'Tailoring skill descriptions',
    'Crafting your resume…',
    'Finalizing PDF',
]

function GeneratingView({ done }) {
    const [activeIdx, setActiveIdx] = useState(0)

    useEffect(() => {
        if (done) return
        const timings = [600, 1800, 3500] // ms to advance each step
        const timers = timings.map((delay, i) =>
            setTimeout(() => setActiveIdx(i + 1), delay)
        )
        return () => timers.forEach(clearTimeout)
    }, [done])

    if (done) {
        return (
            <div className="rb-generating__success">
                <div className="rb-success-icon">✅</div>
                <h3>Resume downloaded!</h3>
                <p>Your tailored resume has been saved to your downloads folder.</p>
            </div>
        )
    }

    return (
        <div className="rb-generating">
            {GEN_STEPS.map((label, i) => {
                const isDone   = i < activeIdx
                const isActive = i === activeIdx
                const isEmpty  = i > activeIdx
                return (
                    <div
                        key={label}
                        className={`rb-generating__step ${isDone ? 'rb-generating__step--done' : isActive ? 'rb-generating__step--active' : ''}`}
                    >
                        <div className="rb-generating__icon">
                            {isDone   && <span className="rb-gen-check">✓</span>}
                            {isActive && <div className="rb-gen-spinner" />}
                            {isEmpty  && <div className="rb-gen-empty" />}
                        </div>
                        {label}
                    </div>
                )
            })}
        </div>
    )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ResumeBuilderModal({ report, onClose, onDownloadComplete }) {
    const [step, setStep] = useState(1)

    // ── Step 1 state ──────────────────────────────────────────────────────────
    const [suggestions, setSuggestions]           = useState(() => buildSuggestions(report.skillGaps))
    const [irrelevantSkills]                       = useState(() => buildIrrelevantSkills(report))
    const [irrelevantChecked, setIrrelevantChecked] = useState({})
    const [irrelevantOpen, setIrrelevantOpen]       = useState(false)
    const [customSkillInput, setCustomSkillInput]   = useState('')
    const [customSkills, setCustomSkills]           = useState([])  // { skill, selected }
    const [step1Loading, setStep1Loading]           = useState(false)

    // ── Step 2 state ──────────────────────────────────────────────────────────
    const [options, setOptions]                 = useState(null)   // { summaryA, summaryB, skillsWithEvidence }
    const [chosenSummary, setChosenSummary]     = useState(null)   // 'A' | 'B'
    const [noEvidenceOverride, setNoEvidenceOverride] = useState({}) // skill → bool (include anyway)
    const [step2Error, setStep2Error]           = useState(false)
    const [pdfLoading, setPdfLoading]           = useState(false)

    // ── Step 3 state ──────────────────────────────────────────────────────────
    const [genDone, setGenDone] = useState(false)

    // ── Close confirm ─────────────────────────────────────────────────────────
    const [showConfirm, setShowConfirm] = useState(false)

    const handleCloseAttempt = () => {
        if (step > 1 && !genDone) {
            setShowConfirm(true)
        } else {
            onClose()
        }
    }

    const handleOverlayClick = (e) => {
        if (e.target === e.currentTarget) handleCloseAttempt()
    }

    // ── Derived values ────────────────────────────────────────────────────────
    const allSuggestions = [
        ...suggestions,
        ...customSkills
    ]

    const selectedSkills = allSuggestions.filter(s => s.selected).map(s => s.skill)
    const canGoNext = selectedSkills.length > 0

    // Compute irrelevantSkillsToDeprioritize: skills in irrelevantSkills where user un-checked them
    const deprioritize = irrelevantSkills.filter(skill => {
        const key = skill
        return irrelevantChecked[key] === false  // explicitly un-checked
    })

    // ── Step 1 handlers ───────────────────────────────────────────────────────
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
        setCustomSkills(prev => [...prev, { skill: trimmed, selected: true }])
        setCustomSkillInput('')
    }

    const handleCustomKeyDown = (e) => {
        if (e.key === 'Enter') { e.preventDefault(); addCustomSkill() }
    }

    const handleIrrelevantToggle = (skill) => {
        setIrrelevantChecked(prev => ({
            ...prev,
            [skill]: prev[skill] === undefined ? false : !prev[skill]
        }))
    }

    const handleNext = async (skipSkills = false) => {
        const skills = skipSkills ? [] : selectedSkills
        setStep1Loading(true)
        setStep2Error(false)
        try {
            const data = await getResumeOptions(report._id, skills)
            setOptions(data.options)
            setChosenSummary(null)
            setNoEvidenceOverride({})
            setStep(2)
        } catch (err) {
            console.error('getResumeOptions error:', err)
            toast.error('Failed to generate summaries — please try again.')
            setStep2Error(true)
        } finally {
            setStep1Loading(false)
        }
    }

    // ── Step 2 handlers ───────────────────────────────────────────────────────
    const chosenSummaryText = chosenSummary === 'A'
        ? options?.summaryA?.text
        : chosenSummary === 'B'
            ? options?.summaryB?.text
            : null

    // Skills with evidence that will be included (respects "include anyway" toggle)
    const finalSkillsWithEvidence = (options?.skillsWithEvidence || []).filter(s => {
        if (s.hasEvidence) return true
        // No evidence — only include if user left "include anyway" checked (default: true)
        return noEvidenceOverride[s.skill] !== false
    })

    const handleGeneratePdf = async () => {
        if (!chosenSummaryText) return
        setStep(3)
        setPdfLoading(true)
        try {
            const blob = await generateResumePdf({
                interviewReportId:            report._id,
                confirmedSkills:              selectedSkills,
                chosenSummary:                chosenSummaryText,
                skillsWithEvidence:           finalSkillsWithEvidence,
                irrelevantSkillsToDeprioritize: deprioritize
            })
            // Trigger browser download
            const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }))
            const a   = document.createElement('a')
            a.href     = url
            a.download = `resume_${report._id}.pdf`
            document.body.appendChild(a)
            a.click()
            a.remove()
            URL.revokeObjectURL(url)
            setGenDone(true)
            setTimeout(() => {
                onDownloadComplete?.()
            }, 1800)
        } catch (err) {
            console.error('PDF generation error:', err)
            toast.error('PDF generation failed — please try again.')
            setPdfLoading(false)
            setStep(2)   // back to step 2 with selections preserved
        }
    }

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="resume-builder-modal">
            <div className="resume-builder-modal__overlay" onClick={handleOverlayClick} />

            <div className="resume-builder-modal__card">

                {/* Close button — hidden during generation */}
                {step !== 3 && (
                    <button className="resume-builder-modal__close" onClick={handleCloseAttempt}>
                        ✕
                    </button>
                )}

                {/* Step indicator */}
                <StepIndicator step={step} />

                {/* ── Confirm discard dialog ── */}
                {showConfirm && (
                    <div className="resume-builder-modal__confirm">
                        <p>Discard your selections and close?</p>
                        <div className="rb-confirm-actions">
                            <button
                                className="resume-builder-modal__btn resume-builder-modal__btn--ghost"
                                style={{ fontSize: 13, padding: '6px 14px' }}
                                onClick={() => { setShowConfirm(false); onClose() }}
                            >
                                Yes, close
                            </button>
                            <button
                                className="resume-builder-modal__btn resume-builder-modal__btn--primary"
                                style={{ fontSize: 13, padding: '6px 14px' }}
                                onClick={() => setShowConfirm(false)}
                            >
                                Keep editing
                            </button>
                        </div>
                    </div>
                )}

                {/* ════════════════════════════════════════ STEP 1 ════════════════════════════════════════ */}
                {step === 1 && (
                    <>
                        <div className="resume-builder-modal__header">
                            <h2>Tailor Your Skills</h2>
                            <p>
                                Select skills from the job description that you genuinely know.
                                These will be added to your resume's skills section.
                            </p>
                        </div>

                        {/* Suggested skills */}
                        <div className="resume-builder-modal__section-title">Suggested from job description</div>

                        {suggestions.length === 0 ? (
                            <div className="rb-empty-state">
                                <p>
                                    No skill gaps identified for this role — your skills are a strong match.
                                    You can still add custom skills below.
                                </p>
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

                        {/* Custom skills */}
                        {customSkills.map(item => (
                            <SkillCard
                                key={item.skill}
                                item={item}
                                onToggle={toggleCustomSkill}
                            />
                        ))}

                        {/* Add custom skill input */}
                        <div className="rb-custom-skill">
                            <input
                                type="text"
                                className="rb-custom-skill__input"
                                placeholder="Add a skill not listed above…"
                                value={customSkillInput}
                                onChange={e => setCustomSkillInput(e.target.value)}
                                onKeyDown={handleCustomKeyDown}
                                maxLength={40}
                                disabled={customSkills.length >= 3}
                            />
                            <button
                                className="rb-custom-skill__add-btn"
                                onClick={addCustomSkill}
                                disabled={!customSkillInput.trim() || customSkills.length >= 3}
                            >
                                Add
                            </button>
                        </div>
                        {customSkills.length >= 3 && (
                            <p className="rb-custom-skill__hint">Maximum 3 custom skills added.</p>
                        )}

                        {/* Irrelevant skills — only show if we have any */}
                        {irrelevantSkills.length > 0 && (
                            <div className="rb-irrelevant">
                                <button
                                    className={`rb-irrelevant__toggle ${irrelevantOpen ? 'rb-irrelevant__toggle--open' : ''}`}
                                    onClick={() => setIrrelevantOpen(o => !o)}
                                >
                                    <span>Skills that may not be relevant to this role ({irrelevantSkills.length})</span>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <polyline points="6 9 12 15 18 9" />
                                    </svg>
                                </button>
                                {irrelevantOpen && (
                                    <div className="rb-irrelevant__body">
                                        <p className="rb-irrelevant__note">
                                            These skills appear in your resume but are not mentioned in the JD.
                                            Uncheck to deprioritize (move to end of their category row).
                                        </p>
                                        {irrelevantSkills.map(skill => {
                                            const checked = irrelevantChecked[skill] !== false
                                            return (
                                                <SkillCard
                                                    key={skill}
                                                    item={{ skill, severity: 'low', reason: 'Not mentioned in the job description.', selected: checked }}
                                                    onToggle={() => handleIrrelevantToggle(skill)}
                                                />
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Footer */}
                        <div className="resume-builder-modal__footer">
                            <button
                                className="resume-builder-modal__skip-link"
                                onClick={() => handleNext(true)}
                                disabled={step1Loading}
                            >
                                Skip skill selection
                            </button>
                            <button
                                className={`resume-builder-modal__btn resume-builder-modal__btn--primary ${step1Loading ? 'resume-builder-modal__btn--loading' : ''}`}
                                onClick={() => handleNext(false)}
                                disabled={!canGoNext || step1Loading}
                            >
                                {step1Loading
                                    ? <><span className="rb-spinner" /> Generating summaries…</>
                                    : 'Next: Choose Summary →'
                                }
                            </button>
                        </div>
                    </>
                )}

                {/* ════════════════════════════════════════ STEP 2 ════════════════════════════════════════ */}
                {step === 2 && (
                    <>
                        <div className="resume-builder-modal__header">
                            <h2>Choose Your Summary</h2>
                            <p>
                                Pick the opening that best fits how you want to present yourself for this role.
                            </p>
                        </div>

                        {step2Error && !options ? (
                            <div className="rb-step-error">
                                <p>Something went wrong generating your summaries.</p>
                                <button
                                    className="resume-builder-modal__btn resume-builder-modal__btn--primary"
                                    onClick={() => { setStep2Error(false); handleNext(selectedSkills.length === 0) }}
                                >
                                    Try again
                                </button>
                            </div>
                        ) : options && (
                            <>
                                {/* Summary cards */}
                                <div className="rb-summaries">
                                    {[
                                        { key: 'A', data: options.summaryA },
                                        { key: 'B', data: options.summaryB }
                                    ].map(({ key, data }) => (
                                        <div
                                            key={key}
                                            className={`summary-card ${chosenSummary === key ? 'summary-card--selected' : ''}`}
                                            onClick={() => setChosenSummary(key)}
                                        >
                                            <span className="summary-card__label">{data.label}</span>
                                            <p className="summary-card__text">{data.text}</p>
                                            <button
                                                className="summary-card__select-btn"
                                                onClick={e => { e.stopPropagation(); setChosenSummary(key) }}
                                            >
                                                {chosenSummary === key ? '✓ Selected' : 'Use this summary'}
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                {/* Skill evidence */}
                                {(options.skillsWithEvidence || []).length > 0 && (
                                    <div className="skill-evidence">
                                        {/* Confirmed */}
                                        {options.skillsWithEvidence.some(s => s.hasEvidence) && (
                                            <>
                                                <p className="skill-evidence__title">Skills with project evidence</p>
                                                {options.skillsWithEvidence.filter(s => s.hasEvidence).map(s => (
                                                    <div key={s.skill} className="skill-evidence__item skill-evidence__item--confirmed">
                                                        <span className="skill-evidence__icon">✓</span>
                                                        <span>{s.skill}{s.evidenceNote ? ` — ${s.evidenceNote}` : ''}</span>
                                                    </div>
                                                ))}
                                            </>
                                        )}

                                        {/* No evidence */}
                                        {options.skillsWithEvidence.some(s => !s.hasEvidence) && (
                                            <>
                                                <p className="skill-evidence__title" style={{ marginTop: 14 }}>Skills without project evidence</p>
                                                {options.skillsWithEvidence.filter(s => !s.hasEvidence).map(s => (
                                                    <div key={s.skill} className="skill-evidence__item skill-evidence__item--warning">
                                                        <div className="rb-evidence-row">
                                                            <span className="skill-evidence__icon">⚠</span>
                                                            <span>{s.skill} — No project evidence found</span>
                                                        </div>
                                                        <p className="skill-evidence__warning-note">
                                                            This skill will appear in your skills section but is not evidenced in any project bullet.
                                                            Recruiters may ask about this — only include it if you are genuinely familiar.
                                                        </p>
                                                        <label className="skill-evidence__include-row">
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
                        <div className="resume-builder-modal__footer">
                            <button
                                className="resume-builder-modal__btn resume-builder-modal__btn--ghost"
                                onClick={() => { setStep(1); setOptions(null); setStep2Error(false) }}
                                disabled={pdfLoading}
                            >
                                ← Back to Skills
                            </button>
                            <button
                                className={`resume-builder-modal__btn resume-builder-modal__btn--primary ${pdfLoading ? 'resume-builder-modal__btn--loading' : ''}`}
                                onClick={handleGeneratePdf}
                                disabled={!chosenSummary || pdfLoading}
                            >
                                {pdfLoading
                                    ? <><span className="rb-spinner" /> Building your resume…</>
                                    : 'Generate Resume PDF →'
                                }
                            </button>
                        </div>
                    </>
                )}

                {/* ════════════════════════════════════════ STEP 3 ════════════════════════════════════════ */}
                {step === 3 && (
                    <>
                        <div className="resume-builder-modal__header">
                            <h2>{genDone ? 'All done!' : 'Building your resume…'}</h2>
                            {!genDone && <p>This usually takes 15–30 seconds. Please don't close the window.</p>}
                        </div>

                        <GeneratingView done={genDone} />
                    </>
                )}
            </div>
        </div>
    )
}
