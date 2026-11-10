import React, { useState, useEffect, useRef, useCallback } from 'react'
import toast from 'react-hot-toast'
import { updateTailoredResume } from '../../services/interview.api.js'
import './ResumeEditor.scss'

const scoreColorHex = (score) => {
    if (score >= 80) return '#22c55e'
    if (score >= 60) return '#f59e0b'
    return '#ef4444'
}

export default function ResumeEditor({
    reportId,
    initialContent,
    initialScoring,
    pages = 1,
    onPreviewUpdate,
    onSaveSuccess,
    onDiscard,
    onHasUnsavedChangesChange
}) {
    // ─────────────────────────────────────────────────────────────
    // INITIALIZE FORM STATE FROM STRUCTURED CONTENT
    // ─────────────────────────────────────────────────────────────
    const normalizeSkillsRows = (rows) => {
        if (!Array.isArray(rows)) return []
        return rows.slice(0, 5).map(r => {
            if (r.items && Array.isArray(r.items) && r.items[0]) {
                return { label: r.items[0].label || '', value: r.items[0].value || '' }
            }
            return { label: r.label || '', value: r.value || '' }
        })
    }

    const [summary, setSummary] = useState(initialContent?.summary || '')
    const [skillsRows, setSkillsRows] = useState(() => normalizeSkillsRows(initialContent?.skillsRows))
    const [internships, setInternships] = useState(initialContent?.internships || [])
    const [projects, setProjects] = useState(initialContent?.projects || [])
    const [certifications, setCertifications] = useState(initialContent?.certifications || '')
    const [codingProfiles, setCodingProfiles] = useState(initialContent?.codingProfiles || '')

    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
    const [saveStatusText, setSaveStatusText] = useState('All changes saved')
    const [isSaving, setIsSaving] = useState(false)
    const [lastFocusedSkillRow, setLastFocusedSkillRow] = useState(0)

    // Current live scoring for the top strip
    const [currentScoring, setCurrentScoring] = useState(initialScoring)

    // Monotonic request ID & abort controller for debounced previews
    const reqIdRef = useRef(0)
    const abortControllerRef = useRef(null)
    const isFirstMount = useRef(true)

    // Notify parent about unsaved changes state
    useEffect(() => {
        onHasUnsavedChangesChange?.(hasUnsavedChanges)
    }, [hasUnsavedChanges, onHasUnsavedChangesChange])

    // Browser navigation / reload guard
    useEffect(() => {
        const handleBeforeUnload = (e) => {
            if (hasUnsavedChanges) {
                e.preventDefault()
                e.returnValue = ''
            }
        }
        window.addEventListener('beforeunload', handleBeforeUnload)
        return () => window.removeEventListener('beforeunload', handleBeforeUnload)
    }, [hasUnsavedChanges])

    // ─────────────────────────────────────────────────────────────
    // BUILD SANITIZED CONTENT PAYLOAD
    // ─────────────────────────────────────────────────────────────
    const getPayloadContent = useCallback(() => {
        return {
            summary,
            skillsRows: skillsRows.map(r => ({
                items: [{ label: r.label, value: r.value }]
            })),
            internships: internships.map(org => ({
                organisation: org.organisation,
                bullets: org.bullets || []
            })),
            projects: projects.map(p => ({
                name: p.name,
                stack: p.stack,
                bullets: p.bullets || []
            })),
            certifications,
            codingProfiles
        }
    }, [summary, skillsRows, internships, projects, certifications, codingProfiles])

    // ─────────────────────────────────────────────────────────────
    // LIVE PREVIEW DEBOUNCE (700ms)
    // ─────────────────────────────────────────────────────────────
    const triggerDebouncedPreview = useCallback(() => {
        if (isFirstMount.current) {
            isFirstMount.current = false
            return
        }

        setHasUnsavedChanges(true)
        setSaveStatusText('Unsaved changes')

        if (abortControllerRef.current) {
            abortControllerRef.current.abort()
        }

        const controller = new AbortController()
        abortControllerRef.current = controller
        const currentReqId = ++reqIdRef.current

        onPreviewUpdate?.({ isUpdating: true })

        const timer = setTimeout(async () => {
            try {
                const payload = getPayloadContent()
                const data = await updateTailoredResume(reportId, payload, false, controller.signal)

                // Ignore if a newer request was dispatched
                if (currentReqId !== reqIdRef.current) return

                if (data?.html) {
                    setCurrentScoring(data.scoring)
                    onPreviewUpdate?.({
                        html: data.html,
                        scoring: data.scoring,
                        atsBefore: data.atsBefore,
                        atsAfter: data.atsAfter,
                        isUpdating: false
                    })
                }
            } catch (err) {
                if (err.name === 'CanceledError' || err.name === 'AbortError') return
                console.error('Live preview error:', err)
                onPreviewUpdate?.({ isUpdating: false })
            }
        }, 700)

        return () => clearTimeout(timer)
    }, [getPayloadContent, onPreviewUpdate, reportId])

    // Trigger on any form state change
    useEffect(() => {
        const cleanup = triggerDebouncedPreview()
        return () => cleanup?.()
    }, [triggerDebouncedPreview])

    // ─────────────────────────────────────────────────────────────
    // SAVE ACTION (PERSIST TO DB)
    // ─────────────────────────────────────────────────────────────
    const handleSave = async () => {
        if (isSaving) return
        setIsSaving(true)
        setSaveStatusText('Saving…')

        try {
            const payload = getPayloadContent()
            const data = await updateTailoredResume(reportId, payload, true)

            if (data?.html) {
                setHasUnsavedChanges(false)
                setSaveStatusText('Saved just now')
                setCurrentScoring(data.scoring)
                toast.success('Resume saved successfully!')
                onSaveSuccess?.({
                    content: payload,
                    html: data.html,
                    scoring: data.scoring,
                    atsBefore: data.atsBefore,
                    atsAfter: data.atsAfter
                })
            }
        } catch (err) {
            console.error('Save error:', err)
            const msg = err.response?.data?.message || 'Failed to save resume changes.'
            toast.error(msg)
            setSaveStatusText('Unsaved changes')
        } finally {
            setIsSaving(false)
        }
    }

    // Ctrl/Cmd + S shortcut
    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
                e.preventDefault()
                handleSave()
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    })

    // ─────────────────────────────────────────────────────────────
    // FORM FIELD HANDLERS
    // ─────────────────────────────────────────────────────────────
    const handleSkillLabelChange = (index, newLabel) => {
        setSkillsRows(prev => {
            const next = [...prev]
            next[index] = { ...next[index], label: newLabel }
            return next
        })
    }

    const handleSkillValueChange = (index, newVal) => {
        setSkillsRows(prev => {
            const next = [...prev]
            next[index] = { ...next[index], value: newVal }
            return next
        })
    }

    const handleAddSkillRow = () => {
        if (skillsRows.length >= 5) return
        setSkillsRows(prev => [...prev, { label: 'New Category', value: '' }])
        setLastFocusedSkillRow(skillsRows.length)
    }

    const handleRemoveSkillRow = (index) => {
        setSkillsRows(prev => prev.filter((_, i) => i !== index))
        if (lastFocusedSkillRow >= index && lastFocusedSkillRow > 0) {
            setLastFocusedSkillRow(prev => prev - 1)
        }
    }

    // Click keyword chip -> appends to last focused skill row
    const handleAddKeywordToSkills = (keyword) => {
        const targetIndex = Math.min(lastFocusedSkillRow, Math.max(0, skillsRows.length - 1))
        if (skillsRows.length === 0) {
            setSkillsRows([{ label: 'Skills', value: keyword }])
            return
        }

        setSkillsRows(prev => {
            const next = [...prev]
            const currentVal = next[targetIndex]?.value || ''
            const separator = currentVal.trim().length > 0 ? ', ' : ''
            next[targetIndex] = {
                ...next[targetIndex],
                value: `${currentVal}${separator}${keyword}`
            }
            return next
        })
    }

    // Internship bullets
    const handleInternshipBulletChange = (orgIdx, bulletIdx, text) => {
        setInternships(prev => {
            const next = [...prev]
            const org = { ...next[orgIdx] }
            const bullets = [...(org.bullets || [])]
            bullets[bulletIdx] = text
            org.bullets = bullets
            next[orgIdx] = org
            return next
        })
    }

    const handleAddInternshipBullet = (orgIdx) => {
        setInternships(prev => {
            const next = [...prev]
            const org = { ...next[orgIdx] }
            const bullets = [...(org.bullets || [])]
            if (bullets.length >= 2) return prev
            bullets.push('')
            org.bullets = bullets
            next[orgIdx] = org
            return next
        })
    }

    const handleRemoveInternshipBullet = (orgIdx, bulletIdx) => {
        setInternships(prev => {
            const next = [...prev]
            const org = { ...next[orgIdx] }
            org.bullets = (org.bullets || []).filter((_, i) => i !== bulletIdx)
            next[orgIdx] = org
            return next
        })
    }

    // Project bullets
    const handleProjectBulletChange = (projIdx, bulletIdx, text) => {
        setProjects(prev => {
            const next = [...prev]
            const p = { ...next[projIdx] }
            const bullets = [...(p.bullets || [])]
            bullets[bulletIdx] = text
            p.bullets = bullets
            next[projIdx] = p
            return next
        })
    }

    const handleAddProjectBullet = (projIdx) => {
        setProjects(prev => {
            const next = [...prev]
            const p = { ...next[projIdx] }
            const bullets = [...(p.bullets || [])]
            if (bullets.length >= 3) return prev
            bullets.push('')
            p.bullets = bullets
            next[projIdx] = p
            return next
        })
    }

    const handleRemoveProjectBullet = (projIdx, bulletIdx) => {
        setProjects(prev => {
            const next = [...prev]
            const p = { ...next[projIdx] }
            const bullets = (p.bullets || []).filter((_, i) => i !== bulletIdx)
            if (bullets.length < 1) return prev // Min 1 bullet required
            p.bullets = bullets
            next[projIdx] = p
            return next
        })
    }

    // ─────────────────────────────────────────────────────────────
    // DERIVED SCORING STRIP DATA
    // ─────────────────────────────────────────────────────────────
    const beforeScore = currentScoring?.before?.score ?? currentScoring?.atsBefore ?? 0
    const afterScore = currentScoring?.after?.score ?? currentScoring?.atsAfter ?? beforeScore
    const diff = afterScore - beforeScore
    const afterColor = scoreColorHex(afterScore)

    // Missing keywords: must-have first
    const missingList = currentScoring?.after?.missing || []
    const sortedMissing = [...missingList].sort((a, b) => {
        if (a.importance === 'must' && b.importance !== 'must') return -1
        if (a.importance !== 'must' && b.importance === 'must') return 1
        return 0
    })
    const mustMissingCount = missingList.filter(k => k.importance === 'must').length

    return (
        <div className="resume-editor-panel">
            {/* ── TOP SCORE STRIP ── */}
            <div className="editor-score-strip">
                <div className="editor-score-strip__row">
                    <div className="editor-score-strip__nums">
                        <span className="editor-score-strip__before">{beforeScore}%</span>
                        <span className="editor-score-strip__arrow">→</span>
                        <span className="editor-score-strip__after" style={{ color: afterColor }}>
                            {afterScore}%
                        </span>
                        <span
                            className="editor-score-strip__chip"
                            style={{
                                background: diff >= 0 ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                                color: diff >= 0 ? '#22c55e' : '#ef4444',
                                borderColor: diff >= 0 ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'
                            }}
                        >
                            {diff >= 0 ? `+${diff}` : diff} pts
                        </span>
                    </div>
                </div>

                <p className="editor-score-strip__missing-note">
                    {mustMissingCount > 0
                        ? `${mustMissingCount} must-have keyword${mustMissingCount === 1 ? '' : 's'} still missing`
                        : 'All must-have keywords covered!'}
                </p>

                {pages > 1 && (
                    <div className="editor-score-strip__spill-warning">
                        ⚠ This resume spills onto page {pages}. Shorten a bullet or the summary to keep one page.
                    </div>
                )}
            </div>

            {/* ── SCROLLABLE EDIT FIELDS ── */}
            <div className="editor-fields-scroll">
                {/* 1. Summary */}
                <div className="editor-section">
                    <div className="editor-section__header">
                        <label className="editor-section__title" htmlFor="resume-summary">Summary</label>
                        <span className="editor-section__counter">{summary.length}/900</span>
                    </div>
                    <textarea
                        id="resume-summary"
                        className="editor-textarea"
                        rows={4}
                        maxLength={900}
                        value={summary}
                        placeholder="Write a concise professional summary…"
                        onChange={e => setSummary(e.target.value)}
                    />
                </div>

                {/* 2. Technical Skills */}
                <div className="editor-section">
                    <div className="editor-section__header">
                        <span className="editor-section__title">Skills Rows</span>
                        <span className="editor-section__counter">{skillsRows.length}/5 rows</span>
                    </div>

                    <div className="editor-skills-rows">
                        {skillsRows.map((row, i) => (
                            <div key={i} className="editor-skill-row">
                                <input
                                    type="text"
                                    className="editor-input editor-skill-row__label"
                                    maxLength={30}
                                    value={row.label}
                                    placeholder="Category label"
                                    onChange={e => handleSkillLabelChange(i, e.target.value)}
                                    onFocus={() => setLastFocusedSkillRow(i)}
                                />
                                <input
                                    type="text"
                                    className="editor-input editor-skill-row__val"
                                    maxLength={200}
                                    value={row.value}
                                    placeholder="Comma-separated skills"
                                    onChange={e => handleSkillValueChange(i, e.target.value)}
                                    onFocus={() => setLastFocusedSkillRow(i)}
                                />
                                {skillsRows.length > 1 && (
                                    <button
                                        type="button"
                                        className="editor-skill-row__remove"
                                        onClick={() => handleRemoveSkillRow(i)}
                                        aria-label="Remove skills row"
                                        title="Remove row"
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>

                    {skillsRows.length < 5 && (
                        <button
                            type="button"
                            className="editor-add-row-btn"
                            onClick={handleAddSkillRow}
                        >
                            + Add Skills Row
                        </button>
                    )}

                    {/* Missing keyword chips */}
                    {sortedMissing.length > 0 && (
                        <div className="editor-missing-keywords">
                            <span className="editor-missing-keywords__title">Missing Keywords (Click to add)</span>
                            <div className="editor-missing-keywords__chips">
                                {sortedMissing.slice(0, 15).map(kw => (
                                    <button
                                        key={kw.term}
                                        type="button"
                                        className={`editor-missing-keywords__chip ${kw.importance === 'must' ? 'editor-missing-keywords__chip--must' : ''}`}
                                        onClick={() => handleAddKeywordToSkills(kw.term)}
                                        title={`Add "${kw.term}" to skills`}
                                    >
                                        {kw.importance === 'must' && <span className="must-dot" />}
                                        + {kw.term}
                                    </button>
                                ))}
                            </div>
                            <p className="editor-missing-keywords__note">
                                Only add skills you genuinely have.
                            </p>
                        </div>
                    )}
                </div>

                {/* 3. Internships */}
                {internships.length > 0 && (
                    <div className="editor-section">
                        <span className="editor-section__title">Internships</span>
                        {internships.map((org, orgIdx) => (
                            <div key={orgIdx} className="editor-org-block">
                                <span className="editor-block-header__name">{org.organisation}</span>
                                {(org.bullets || []).map((bullet, bIdx) => (
                                    <div key={bIdx} className="editor-bullet-row">
                                        <textarea
                                            className="editor-textarea"
                                            rows={2}
                                            maxLength={350}
                                            value={bullet}
                                            placeholder="Action-driven bullet point with metrics…"
                                            onChange={e => handleInternshipBulletChange(orgIdx, bIdx, e.target.value)}
                                        />
                                        <button
                                            type="button"
                                            className="editor-bullet-row__remove"
                                            onClick={() => handleRemoveInternshipBullet(orgIdx, bIdx)}
                                            aria-label="Remove bullet"
                                            title="Remove bullet"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ))}
                                {(org.bullets || []).length < 2 && (
                                    <button
                                        type="button"
                                        className="editor-add-bullet-btn"
                                        onClick={() => handleAddInternshipBullet(orgIdx)}
                                    >
                                        + Add bullet
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* 4. Projects */}
                <div className="editor-section">
                    <span className="editor-section__title">Projects</span>
                    {projects.map((proj, projIdx) => (
                        <div key={projIdx} className="editor-proj-block">
                            <div className="editor-block-header">
                                <span className="editor-block-header__name">{proj.name}</span>
                                <span className="editor-block-header__stack">{proj.stack}</span>
                            </div>
                            {(proj.bullets || []).map((bullet, bIdx) => (
                                <div key={bIdx} className="editor-bullet-row">
                                    <textarea
                                        className="editor-textarea"
                                        rows={2}
                                        maxLength={350}
                                        value={bullet}
                                        placeholder="Project achievement with numbers and tools…"
                                        onChange={e => handleProjectBulletChange(projIdx, bIdx, e.target.value)}
                                    />
                                    {(proj.bullets || []).length > 1 && (
                                        <button
                                            type="button"
                                            className="editor-bullet-row__remove"
                                            onClick={() => handleRemoveProjectBullet(projIdx, bIdx)}
                                            aria-label="Remove bullet"
                                            title="Remove bullet"
                                        >
                                            ✕
                                        </button>
                                    )}
                                </div>
                            ))}
                            {(proj.bullets || []).length < 3 && (
                                <button
                                    type="button"
                                    className="editor-add-bullet-btn"
                                    onClick={() => handleAddProjectBullet(projIdx)}
                                >
                                    + Add bullet
                                </button>
                            )}
                        </div>
                    ))}
                </div>

                {/* 5. Certifications */}
                <div className="editor-section">
                    <div className="editor-section__header">
                        <label className="editor-section__title" htmlFor="resume-certs">Certifications</label>
                        <span className="editor-section__counter">{certifications.length}/600</span>
                    </div>
                    <textarea
                        id="resume-certs"
                        className="editor-textarea"
                        rows={2}
                        maxLength={600}
                        value={certifications}
                        placeholder="Certifications (e.g. AWS Certified Developer)…"
                        onChange={e => setCertifications(e.target.value)}
                    />
                </div>

                {/* 6. Coding Profiles */}
                <div className="editor-section">
                    <div className="editor-section__header">
                        <label className="editor-section__title" htmlFor="resume-profiles">Coding Profiles</label>
                        <span className="editor-section__counter">{codingProfiles.length}/300</span>
                    </div>
                    <textarea
                        id="resume-profiles"
                        className="editor-textarea"
                        rows={2}
                        maxLength={300}
                        value={codingProfiles}
                        placeholder="Coding profiles (e.g. LeetCode: Top 5%, Codeforces: Specialist)…"
                        onChange={e => setCodingProfiles(e.target.value)}
                    />
                </div>
            </div>

            {/* ── FOOTER ACTIONS ── */}
            <div className="editor-footer">
                <span className={`editor-footer__status ${hasUnsavedChanges ? 'has-unsaved' : ''}`}>
                    {saveStatusText}
                </span>

                <div className="editor-footer__actions">
                    <button
                        type="button"
                        className="editor-footer__btn editor-footer__btn--ghost"
                        onClick={onDiscard}
                        disabled={isSaving}
                    >
                        Discard
                    </button>
                    <button
                        type="button"
                        className="editor-footer__btn editor-footer__btn--primary"
                        onClick={handleSave}
                        disabled={isSaving || !hasUnsavedChanges}
                        title="Save changes (Ctrl + S)"
                    >
                        {isSaving ? 'Saving…' : 'Save (Ctrl+S)'}
                    </button>
                </div>
            </div>
        </div>
    )
}
