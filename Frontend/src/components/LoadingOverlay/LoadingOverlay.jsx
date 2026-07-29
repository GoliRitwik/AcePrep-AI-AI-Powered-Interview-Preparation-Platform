import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import './LoadingOverlay.scss'

// ── Data ──────────────────────────────────────────────────────────────────────

const STEPS = [
    { label: "Extracting resume text" },
    { label: "Reading job description" },
    { label: "Generating questions" },
    { label: "Identifying skill gaps" },
    { label: "Building your prep plan" },
    { label: "Crafting your resume PDF" },
]

// Each step becomes "active" at this delay (ms) after the overlay opens
const STEP_DELAYS = [0, 1500, 3000, 5000, 7000, 9000]

const HEADLINES = [
    "Analyzing your profile...",
    "Reading between the lines...",
    "Tailoring your prep plan...",
    "Almost ready for you...",
]


// ── Component ─────────────────────────────────────────────────────────────────

/**
 * Full-screen loading overlay for the report generation flow.
 *
 * @param {boolean}  isVisible  true = show overlay, false = trigger exit + unmount
 * @param {function} onCancel   Called when the user confirms cancellation — should abort the API request
 */
const LoadingOverlay = ({ isVisible, onCancel }) => {

    const navigate = useNavigate()

    // Whether the overlay is in the DOM at all
    const [mounted, setMounted]   = useState(false)
    // CSS class: 'entering' | 'exiting'
    const [phase, setPhase]       = useState('entering')

    // Steps
    const [activeStep, setActiveStep]         = useState(0)
    const [completedSteps, setCompletedSteps] = useState([])

    // Headline rotation
    const [hlIndex, setHlIndex]     = useState(0)
    const [hlVisible, setHlVisible] = useState(true)

    // Progress bar
    const [progress, setProgress]         = useState(0)
    const [progressDone, setProgressDone] = useState(false)

    // Cancel UI state
    const [showConfirm, setShowConfirm] = useState(false)

    // Refs
    const wasVisible   = useRef(false)   // avoids firing exit on first render
    const timers       = useRef([])      // all setTimeout / setInterval IDs
    const startTimeRef = useRef(null)    // when the overlay opened (for 7s threshold)

    const clearAll = () => {
        timers.current.forEach(id => {
            clearTimeout(id)
            clearInterval(id)
        })
        timers.current = []
    }

    // ── Main effect ───────────────────────────────────────────────────────────
    useEffect(() => {

        // ── OPEN ──────────────────────────────────────────────────────────────
        if (isVisible && !wasVisible.current) {
            wasVisible.current  = true
            startTimeRef.current = Date.now()

            // Reset all UI state
            setActiveStep(0)
            setCompletedSteps([])
            setHlIndex(0)
            setHlVisible(true)
            setProgress(0)
            setProgressDone(false)
            setShowConfirm(false)
            setPhase('entering')
            setMounted(true)

            clearAll()

            // Small delay lets the browser paint width=0 before the 10s CSS transition
            const t0 = setTimeout(() => setProgress(95), 60)
            timers.current.push(t0)

            // Auto-advance steps
            STEP_DELAYS.forEach((delay, i) => {
                if (i === 0) return   // step 0 is already active from the start
                const t = setTimeout(() => {
                    setCompletedSteps(prev => [...prev, i - 1])
                    setActiveStep(i)
                }, delay)
                timers.current.push(t)
            })

            // Headline rotation every 3s with a 300ms crossfade
            const hlInterval = setInterval(() => {
                setHlVisible(false)
                const swap = setTimeout(() => {
                    setHlIndex(prev => (prev + 1) % HEADLINES.length)
                    setHlVisible(true)
                }, 300)
                timers.current.push(swap)
            }, 3000)
            timers.current.push(hlInterval)
        }

        // ── CLOSE (API responded OR user cancelled) ───────────────────────────
        if (!isVisible && wasVisible.current) {
            wasVisible.current = false
            clearAll()
            setShowConfirm(false)

            // Instantly complete all steps and snap progress to 100%
            setCompletedSteps([0, 1, 2, 3, 4, 5])
            setActiveStep(-1)
            setProgressDone(true)
            setProgress(100)

            // Brief "all done" pause, then fade out
            const exitStart = setTimeout(() => {
                setPhase('exiting')

                const unmount = setTimeout(() => {
                    setMounted(false)
                    setProgress(0)
                    setProgressDone(false)
                }, 400)
                timers.current.push(unmount)
            }, 500)
            timers.current.push(exitStart)
        }

    }, [isVisible])  // eslint-disable-line react-hooks/exhaustive-deps

    // Cleanup on unmount
    useEffect(() => () => clearAll(), [])

    // ── Cancel logic ──────────────────────────────────────────────────────────

    const handleCancelClick = () => {
        const elapsed = Date.now() - (startTimeRef.current || 0)
        if (elapsed >= 7000) {
            // Been waiting 7+ seconds — ask for confirmation first
            setShowConfirm(true)
        } else {
            // Early cancel — no need to confirm
            doCancel()
        }
    }

    const doCancel = () => {
        onCancel?.()      // abort the axios request in useInterview
        navigate('/')     // navigate back to home (no-op if already there, state resets)
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    const getStepState = (i) => {
        if (completedSteps.includes(i)) return 'done'
        if (i === activeStep)           return 'active'
        return 'pending'
    }

    // ── Render ────────────────────────────────────────────────────────────────

    if (!mounted) return null

    return (
        <div className={`loading-overlay loading-overlay--${phase}`}>
            <div className="lo-content">

                {/* Brand line */}
                <div className="lo-brand">
                    <span className="lo-brand__star">✦</span>
                    <span>AcePrep AI</span>
                </div>

                {/* Rotating headline */}
                <div className="lo-headline">
                    <h2 className={hlVisible ? 'lo-headline--visible' : 'lo-headline--hidden'}>
                        {HEADLINES[hlIndex]}
                    </h2>
                </div>

                {/* Progress bar */}
                <div className="lo-progress-track">
                    <div
                        className={`lo-progress-fill${progressDone ? ' lo-progress-fill--done' : ''}`}
                        style={{ width: `${progress}%` }}
                    />
                </div>

                {/* Step list */}
                <div className="lo-steps">
                    {STEPS.map((step, i) => {
                        const state = getStepState(i)
                        return (
                            <div key={i} className={`lo-step lo-step--${state}`}>

                                <span className="lo-step__icon">
                                    {state === 'done'    && '✓'}
                                    {state === 'active'  && <span className="lo-step__dot" />}
                                    {state === 'pending' && '◌'}
                                </span>

                                <span className="lo-step__label">{step.label}</span>

                                {state === 'active' && (
                                    <span className="lo-step__status">processing...</span>
                                )}
                                {state === 'done' && (
                                    <span className="lo-step__status lo-step__status--done">done</span>
                                )}

                            </div>
                        )
                    })}
                </div>

                {/* Hint */}
                <p className="lo-hint">This usually takes ~10 seconds</p>

                {/* ── Cancel section ── */}
                {!showConfirm ? (
                    // Default: single subtle cancel button
                    <button className="lo-cancel-btn" onClick={handleCancelClick}>
                        ✕ Cancel &amp; go back
                    </button>
                ) : (
                    // Confirmation state: shown after 7s or on click
                    <div className="lo-confirm-row">
                        <span className="lo-confirm-row__label">
                            Cancel and lose progress?
                        </span>
                        <div className="lo-confirm-row__actions">
                            <button
                                className="lo-confirm-row__yes"
                                onClick={doCancel}
                            >
                                Yes, cancel
                            </button>
                            <button
                                className="lo-confirm-row__keep"
                                onClick={() => setShowConfirm(false)}
                            >
                                Keep waiting
                            </button>
                        </div>
                    </div>
                )}

            </div>
        </div>
    )
}

export default LoadingOverlay
