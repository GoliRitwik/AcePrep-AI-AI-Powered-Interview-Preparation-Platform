import React, { useEffect, useRef, useState } from 'react'
import './ScoreCompare.scss'

const scoreColorHex = (score) => {
    if (score >= 80) return '#22c55e'
    if (score >= 60) return '#f59e0b'
    return '#ef4444'
}

/**
 * ScoreCompare — HireRaft-style before/after ATS score widget.
 *
 * Props:
 *   before {number}        - Original resume ATS score (0-100)
 *   after  {number|null}   - Tailored resume ATS score (0-100); omit for single-score mode
 *   size   {"md"|"lg"}     - "md" for sidebar, "lg" for full tab
 */
export default function ScoreCompare({ before, after, size = 'md' }) {
    const hasAfter = after != null
    const afterColor = hasAfter ? scoreColorHex(after) : scoreColorHex(before)
    const diff = hasAfter ? after - before : 0

    // Animated bar widths
    const [baseWidth, setBaseWidth] = useState(0)
    const [gainWidth, setGainWidth] = useState(0)
    const mounted = useRef(false)

    useEffect(() => {
        if (mounted.current) return
        mounted.current = true
        // Delay slightly so CSS transition fires after mount
        const t = setTimeout(() => {
            if (hasAfter) {
                setBaseWidth(Math.min(before, after))
                setGainWidth(after)
            } else {
                setBaseWidth(before)
            }
        }, 60)
        return () => clearTimeout(t)
    }, [before, after, hasAfter])

    return (
        <div className={`score-compare score-compare--${size}`}>
            {/* Label */}
            <p className="score-compare__label">ATS MATCH</p>

            {/* Numbers */}
            <div className="score-compare__numbers">
                {hasAfter ? (
                    <>
                        <span className="score-compare__before">{before}%</span>
                        <span className="score-compare__arrow">→</span>
                        <span className="score-compare__after" style={{ color: afterColor }}>
                            {after}%
                        </span>
                    </>
                ) : (
                    <span className="score-compare__after" style={{ color: afterColor }}>
                        {before}%
                    </span>
                )}
            </div>

            {/* Delta chip — only when we have both scores */}
            {hasAfter && (
                <div
                    className="score-compare__chip"
                    style={{
                        background: diff > 0
                            ? 'rgba(34,197,94,0.1)'
                            : diff < 0
                                ? 'rgba(239,68,68,0.1)'
                                : 'rgba(255,255,255,0.06)',
                        color: diff > 0 ? '#22c55e' : diff < 0 ? '#ef4444' : 'rgba(255,255,255,0.5)',
                        borderColor: diff > 0
                            ? 'rgba(34,197,94,0.25)'
                            : diff < 0
                                ? 'rgba(239,68,68,0.25)'
                                : 'rgba(255,255,255,0.1)',
                    }}
                >
                    {diff > 0 ? `+${diff}` : diff} pts
                </div>
            )}

            {/* Animated bar */}
            <div className="score-compare__track">
                {hasAfter ? (
                    <>
                        {/* Base segment: 0 → min(before, after) in muted white */}
                        <div
                            className="score-compare__seg score-compare__seg--base"
                            style={{ width: `${baseWidth}%` }}
                        />
                        {/* Gain segment: 0 → after in score color (layered on top) */}
                        {after >= before ? (
                            <div
                                className="score-compare__seg score-compare__seg--gain"
                                style={{ width: `${gainWidth}%`, backgroundColor: afterColor }}
                            />
                        ) : (
                            /* Regression: show after in color + tick at before position */
                            <>
                                <div
                                    className="score-compare__seg score-compare__seg--gain"
                                    style={{ width: `${gainWidth}%`, backgroundColor: afterColor }}
                                />
                                <div
                                    className="score-compare__tick"
                                    style={{ left: `${before}%` }}
                                />
                            </>
                        )}
                    </>
                ) : (
                    /* Single score mode */
                    <div
                        className="score-compare__seg score-compare__seg--gain"
                        style={{ width: `${baseWidth}%`, backgroundColor: afterColor }}
                    />
                )}
            </div>

            {/* Caption */}
            <p className="score-compare__caption">
                {hasAfter
                    ? 'Both resumes are scored against this job description with the same rubric.'
                    : 'Score for original resume against this job description.'}
            </p>
        </div>
    )
}
