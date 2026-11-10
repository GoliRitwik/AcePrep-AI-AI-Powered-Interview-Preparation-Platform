import React, { useState, useEffect, useRef, useCallback } from 'react'
import toast from 'react-hot-toast'
import './ResumePreview.scss'

const A4_WIDTH = 794
const A4_HEIGHT = 1123

export default function ResumePreview({
    html,
    reportTitle = 'Interview Report',
    onMeasured,
    isUpdating = false,
    isEditing = false,
    hasContent = true,
    onToggleEdit,
    onDownloadPdf,
    pdfLoading = false,
    onRebuild
}) {
    const containerRef = useRef(null)
    const iframeRef = useRef(null)
    const [rawHeight, setRawHeight] = useState(A4_HEIGHT)
    const [scale, setScale] = useState(1)
    const [zoomMode, setZoomMode] = useState('fit') // 'fit' | 'manual'
    const [zoomPercent, setZoomPercent] = useState(100)
    const [pages, setPages] = useState(1)
    const [currentPage, setCurrentPage] = useState(1)
    const [loaded, setLoaded] = useState(false)
    const [menuOpen, setMenuOpen] = useState(false)
    const savedScrollTopRef = useRef(0)

    // ─────────────────────────────────────────────────────────────
    // MEASURE IFRAME HEIGHT
    // ─────────────────────────────────────────────────────────────
    const measureIframe = useCallback(() => {
        const iframe = iframeRef.current
        if (!iframe || !iframe.contentDocument) return

        try {
            const doc = iframe.contentDocument
            const docEl = doc.documentElement
            const body = doc.body
            const measured = Math.max(
                docEl ? docEl.scrollHeight : 0,
                body ? body.scrollHeight : 0,
                A4_HEIGHT
            )

            if (measured > 0) {
                setRawHeight(measured)
                const computedPages = Math.max(1, Math.ceil(measured / A4_HEIGHT))
                setPages(computedPages)
                onMeasured?.({ height: measured, pages: computedPages })
                setLoaded(true)
            }
        } catch (e) {
            // sandbox without allow-same-origin would throw; our sandbox has allow-same-origin
            console.warn('Could not measure iframe:', e)
        }
    }, [onMeasured])

    // Re-measure on html change & listen to font loading
    useEffect(() => {
        setLoaded(false)
        const iframe = iframeRef.current
        if (!iframe) return

        const handleLoad = () => {
            measureIframe()
            // Re-measure after web fonts finish loading inside iframe
            try {
                if (iframe.contentDocument?.fonts?.ready) {
                    iframe.contentDocument.fonts.ready.then(() => {
                        measureIframe()
                    })
                }
            } catch (_) {}
        }

        iframe.addEventListener('load', handleLoad)
        return () => iframe.removeEventListener('load', handleLoad)
    }, [html, measureIframe])

    // Preserve scrollTop across html updates
    useEffect(() => {
        if (containerRef.current && savedScrollTopRef.current > 0) {
            containerRef.current.scrollTop = savedScrollTopRef.current
        }
    }, [html, rawHeight])

    // ─────────────────────────────────────────────────────────────
    // FIT SCALE CALCULATION
    // ─────────────────────────────────────────────────────────────
    const calculateFitScale = useCallback(() => {
        if (!containerRef.current) return 1
        const availableWidth = containerRef.current.clientWidth - 48 // 24px padding each side
        if (availableWidth <= 0) return 1
        const fit = availableWidth / A4_WIDTH
        return Math.max(0.4, Math.min(1.4, fit))
    }, [])

    const updateScale = useCallback(() => {
        const fit = calculateFitScale()
        if (zoomMode === 'fit') {
            setScale(fit)
            setZoomPercent(Math.round(fit * 100))
        }
    }, [calculateFitScale, zoomMode])

    useEffect(() => {
        updateScale()
        const ro = new ResizeObserver(updateScale)
        if (containerRef.current) ro.observe(containerRef.current)
        return () => ro.disconnect()
    }, [updateScale])

    // ─────────────────────────────────────────────────────────────
    // ZOOM CONTROLS (50% to 150% of fit scale in 10% steps)
    // ─────────────────────────────────────────────────────────────
    const handleZoomIn = () => {
        const fit = calculateFitScale()
        setZoomMode('manual')
        setScale(prev => {
            const next = Math.min(fit * 1.5, prev + 0.1)
            setZoomPercent(Math.round(next * 100))
            return next
        })
    }

    const handleZoomOut = () => {
        const fit = calculateFitScale()
        setZoomMode('manual')
        setScale(prev => {
            const next = Math.max(fit * 0.5, prev - 0.1)
            setZoomPercent(Math.round(next * 100))
            return next
        })
    }

    const handleZoomFit = () => {
        const fit = calculateFitScale()
        setZoomMode('fit')
        setScale(fit)
        setZoomPercent(Math.round(fit * 100))
    }

    const handleZoom100 = () => {
        setZoomMode('manual')
        setScale(1)
        setZoomPercent(100)
    }

    // ─────────────────────────────────────────────────────────────
    // KEYBOARD SHORTCUTS (Ctrl/Cmd + "+" / "-" / "0")
    // ─────────────────────────────────────────────────────────────
    const handleKeyDown = (e) => {
        if (!e.ctrlKey && !e.metaKey) return
        if (e.key === '=' || e.key === '+') {
            e.preventDefault()
            handleZoomIn()
        } else if (e.key === '-' || e.key === '_') {
            e.preventDefault()
            handleZoomOut()
        } else if (e.key === '0') {
            e.preventDefault()
            handleZoomFit()
        }
    }

    // ─────────────────────────────────────────────────────────────
    // SCROLL LISTENER (CURRENT PAGE TRACKER)
    // ─────────────────────────────────────────────────────────────
    const handleScroll = () => {
        if (!containerRef.current) return
        const st = containerRef.current.scrollTop
        savedScrollTopRef.current = st
        const pageHeight = A4_HEIGHT * scale
        const current = Math.min(pages, Math.max(1, Math.floor((st + 40) / pageHeight) + 1))
        setCurrentPage(current)
    }

    // Close menu when clicking outside
    useEffect(() => {
        if (!menuOpen) return
        const close = () => setMenuOpen(false)
        window.addEventListener('click', close)
        return () => window.removeEventListener('click', close)
    }, [menuOpen])

    const wrapperWidth = A4_WIDTH * scale
    const wrapperHeight = rawHeight * scale

    return (
        <div className="resume-preview-workspace" onKeyDown={handleKeyDown} tabIndex={0}>
            {/* ── TOOLBAR ── */}
            <div className="preview-toolbar">
                <div className="preview-toolbar__left">
                    <span className="preview-toolbar__job-title" title={`Tailored for: ${reportTitle}`}>
                        Tailored for: {reportTitle}
                    </span>
                    <span className="preview-toolbar__pages">
                        Page {currentPage} of {pages}
                    </span>
                    {pages > 1 && (
                        <span className="preview-toolbar__spill-chip" title="Resume exceeds 1 page">
                            ⚠ Spills onto page {pages}
                        </span>
                    )}
                </div>

                <div className="preview-toolbar__center">
                    <button
                        className="preview-toolbar__zoom-btn"
                        onClick={handleZoomOut}
                        title="Zoom out (Ctrl + -)"
                        aria-label="Zoom out"
                    >
                        −
                    </button>
                    <button
                        className={`preview-toolbar__zoom-btn ${zoomMode === 'fit' ? 'preview-toolbar__zoom-btn--active' : ''}`}
                        onClick={handleZoomFit}
                        title="Fit to width (Ctrl + 0)"
                    >
                        Fit
                    </button>
                    <button
                        className={`preview-toolbar__zoom-btn ${scale === 1 && zoomMode === 'manual' ? 'preview-toolbar__zoom-btn--active' : ''}`}
                        onClick={handleZoom100}
                        title="Actual size 100%"
                    >
                        100%
                    </button>
                    <button
                        className="preview-toolbar__zoom-btn"
                        onClick={handleZoomIn}
                        title="Zoom in (Ctrl + +)"
                        aria-label="Zoom in"
                    >
                        +
                    </button>
                    <span className="preview-toolbar__zoom-readout">{zoomPercent}%</span>
                </div>

                <div className="preview-toolbar__right">
                    <button
                        className={`preview-toolbar__btn preview-toolbar__btn--edit ${isEditing ? 'is-active' : ''}`}
                        onClick={onToggleEdit}
                        disabled={!hasContent}
                        title={!hasContent ? 'Rebuild once to enable editing' : (isEditing ? 'Done editing' : 'Edit resume')}
                    >
                        {isEditing ? '✓ Done' : '✎ Edit'}
                    </button>

                    <button
                        className="preview-toolbar__btn preview-toolbar__btn--primary"
                        onClick={onDownloadPdf}
                        disabled={pdfLoading || !html}
                    >
                        {pdfLoading ? 'Generating…' : '↓ Download PDF'}
                    </button>

                    <button
                        className="preview-toolbar__btn preview-toolbar__btn--secondary"
                        onClick={() => toast('Word download coming soon', { icon: '📄' })}
                    >
                        ↓ Word
                    </button>

                    <div className="preview-toolbar__overflow-wrap" onClick={e => e.stopPropagation()}>
                        <button
                            className="preview-toolbar__overflow-btn"
                            onClick={() => setMenuOpen(o => !o)}
                            aria-label="More options"
                            title="More options"
                        >
                            •••
                        </button>
                        {menuOpen && (
                            <div className="preview-toolbar__dropdown">
                                <button
                                    onClick={() => {
                                        setMenuOpen(false)
                                        onRebuild?.()
                                    }}
                                >
                                    ↺ Rebuild with different skills
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── THIN PROGRESS LINE (DURING LIVE PREVIEW REFRESH) ── */}
            {isUpdating && (
                <div className="preview-progress-bar">
                    <div className="preview-progress-bar__indicator" />
                </div>
            )}

            {/* ── SCROLL CONTAINER ── */}
            <div
                className="preview-scroll-container"
                ref={containerRef}
                onScroll={handleScroll}
            >
                {!html || !loaded ? (
                    <div
                        className="preview-paper-skeleton"
                        style={{
                            width: wrapperWidth || A4_WIDTH,
                            minHeight: wrapperHeight || A4_HEIGHT
                        }}
                    >
                        <div className="preview-paper-skeleton__line preview-paper-skeleton__line--title" />
                        <div className="preview-paper-skeleton__line preview-paper-skeleton__line--sub" />
                        <div className="preview-paper-skeleton__line preview-paper-skeleton__line--sec" />
                        <div className="preview-paper-skeleton__line preview-paper-skeleton__line--w100" />
                        <div className="preview-paper-skeleton__line preview-paper-skeleton__line--w90" />
                        <div className="preview-paper-skeleton__line preview-paper-skeleton__line--w80" />
                        <div className="preview-paper-skeleton__line preview-paper-skeleton__line--sec" />
                        <div className="preview-paper-skeleton__line preview-paper-skeleton__line--w100" />
                        <div className="preview-paper-skeleton__line preview-paper-skeleton__line--w90" />
                        <div className="preview-paper-skeleton__line preview-paper-skeleton__line--w70" />
                    </div>
                ) : null}

                {/* ── PAPER WRAPPER ── */}
                <div
                    className="preview-paper-wrapper"
                    style={{
                        width: wrapperWidth,
                        height: wrapperHeight,
                        display: html ? 'block' : 'none'
                    }}
                >
                    <iframe
                        ref={iframeRef}
                        srcDoc={html}
                        scrolling="no"
                        sandbox="allow-same-origin"
                        title="Resume preview"
                        className="preview-iframe"
                        style={{
                            width: A4_WIDTH,
                            height: rawHeight,
                            transform: `scale(${scale})`,
                            transformOrigin: 'top left'
                        }}
                    />

                    {/* Page split indicators if pages > 1 */}
                    {pages > 1 && Array.from({ length: pages - 1 }).map((_, i) => {
                        const pageNum = i + 2
                        const topPosition = (pageNum - 1) * A4_HEIGHT * scale
                        return (
                            <div
                                key={pageNum}
                                className="page-break-line"
                                style={{ top: `${topPosition}px` }}
                            >
                                <span className="page-break-line__badge">
                                    Page {pageNum} starts here
                                </span>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}
