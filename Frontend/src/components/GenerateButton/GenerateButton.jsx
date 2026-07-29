import React from 'react'
import './GenerateButton.scss'

// ── Document icon ──────────────────────────────────────────────────────────────
// The horizontal lines inside the doc are the elements that receive the
// gen-btn__scan-line animation — they sweep up/down while loading.
const DocIcon = ({ isLoading }) => (
    <span className="gen-btn__icon" aria-hidden="true">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round">
            {/* Document outline — static */}
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            {/* Horizontal lines — animate when loading */}
            <line
                className={isLoading ? 'gen-btn__scan-line' : undefined}
                x1="16" y1="13" x2="8" y2="13"
            />
            <line
                className={isLoading ? 'gen-btn__scan-line' : undefined}
                x1="16" y1="17" x2="8" y2="17"
            />
        </svg>
    </span>
)

// ── GenerateButton ─────────────────────────────────────────────────────────────
// Props:
//   onClick      — handler called when the button is clicked
//   isLoading    — true while the async operation is in progress
//   label        — text shown in the idle state
//   loadingLabel — text shown while isLoading is true (parent controls the text)
//   disabled     — optional extra disabled flag (button is also disabled when isLoading)
// ──────────────────────────────────────────────────────────────────────────────
const GenerateButton = ({
    onClick,
    isLoading = false,
    label = 'Generate',
    loadingLabel = 'Working…',
    disabled = false,
}) => {
    const isDisabled = disabled || isLoading

    return (
        <button
            type="button"
            className={`gen-btn${isLoading ? ' gen-btn--loading' : ''}`}
            onClick={onClick}
            disabled={isDisabled}
            aria-busy={isLoading}
        >
            {/* Shimmer sweep overlay — CSS controls when it animates */}
            <span className="gen-btn__sweep" aria-hidden="true" />

            <DocIcon isLoading={isLoading} />

            <span className="gen-btn__label">
                {isLoading ? loadingLabel : label}
            </span>
        </button>
    )
}

export default GenerateButton
