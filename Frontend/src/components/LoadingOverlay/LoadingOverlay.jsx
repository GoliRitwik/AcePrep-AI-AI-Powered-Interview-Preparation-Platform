import React, { useState, useEffect, useRef } from 'react'
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
 * @param {boolean} isVisible  true = show overlay, false = trigger exit + unmount
 */
const LoadingOverlay = ({ isVisible }) => {

    // Whether the overlay is in the DOM at all
    const [mounted, setMounted] = useState(false)
    // CSS class switch: 'entering' | 'exiting'
    const [phase, setPhase] = useState('entering')

    // Steps
    const [activeStep, setActiveStep]       = useState(0)
    const [completedSteps, setCompletedSteps] = useState([])

    // Headline rotation
    const [hlIndex, setHlIndex]   = useState(0)
    const [hlVisible, setHlVisible] = useState(true)

    // Progress bar 0–95 (linear) then snaps to 100 on done
    const [progress, setProgress]           = useState(0)
    const [progressDone, setProgressDone]   = useState(false)

    // Tracks whether we were previously visible (avoids firing exit on first render)
    const wasVisible = useRef(false)
    // Holds all timer IDs so we can cancel everything at once
    const timers = useRef([])

    const clearAll = () => {
        timers.current.forEach(id => {
            clearTimeout(id)
            clearInterval(id)
        })
        timers.current = []
    }

    // ── Main effect: responds to isVisible changes ────────────────────────────
    useEffect(() => {

        // ── OPEN ──────────────────────────────────────────────────────────────
        if (isVisible && !wasVisible.current) {
            wasVisible.current = true

            // Reset everything to initial state
            setActiveStep(0)
            setCompletedSteps([])
            setHlIndex(0)
            setHlVisible(true)
            setProgress(0)
            setProgressDone(false)
            setPhase('entering')
            setMounted(true)

            clearAll()

            // Small delay lets the browser paint progress=0 before we start the
            // 10-second CSS transition to 95%
            const t0 = setTimeout(() => setProgress(95), 60)
            timers.current.push(t0)

            // Auto-advance steps on a timer
            STEP_DELAYS.forEach((delay, i) => {
                if (i === 0) return  // step 0 is already active from the start
                const t = setTimeout(() => {
                    setCompletedSteps(prev => [...prev, i - 1])  // previous step → done
                    setActiveStep(i)                              // this step → active
                }, delay)
                timers.current.push(t)
            })

            // Rotate headline every 3 s with a fade
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

        // ── CLOSE (API responded) ─────────────────────────────────────────────
        if (!isVisible && wasVisible.current) {
            wasVisible.current = false
            clearAll()

            // Instantly complete all steps and snap progress to 100%
            setCompletedSteps([0, 1, 2, 3, 4, 5])
            setActiveStep(-1)
            setProgressDone(true)
            setProgress(100)

            // Brief pause so the user sees "all done", then fade out
            const exitStart = setTimeout(() => {
                setPhase('exiting')

                // Unmount after the CSS fade-out animation finishes (400ms)
                const unmount = setTimeout(() => {
                    setMounted(false)
                    setProgress(0)
                    setProgressDone(false)
                }, 400)
                timers.current.push(unmount)
            }, 500)
            timers.current.push(exitStart)
        }

    }, [isVisible])    // eslint-disable-line react-hooks/exhaustive-deps

    // Cleanup on component unmount
    useEffect(() => () => clearAll(), [])

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

                                {/* Icon */}
                                <span className="lo-step__icon">
                                    {state === 'done'   && '✓'}
                                    {state === 'active' && <span className="lo-step__dot" />}
                                    {state === 'pending' && '◌'}
                                </span>

                                {/* Label */}
                                <span className="lo-step__label">{step.label}</span>

                                {/* Trailing status */}
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

            </div>
        </div>
    )
}

export default LoadingOverlay
