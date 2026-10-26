import React, { useState, useRef } from 'react'
import '../style/home.scss'
import { useInterview } from '../hooks/useInterview.js'
import { useNavigate, Link } from 'react-router'
import LoadingOverlay from '../../../components/LoadingOverlay/LoadingOverlay.jsx'
import toast from 'react-hot-toast'

const Home = () => {
    const { generateReport, cancelGeneration } = useInterview()
    const [jobDescription, setJobDescription] = useState("")
    const [selfDescription, setSelfDescription] = useState("")
    const resumeInputRef = useRef(null)
    const [selectedFile, setSelectedFile] = useState(null)
    const [isDragging, setIsDragging] = useState(false)
    const [isGenerating, setIsGenerating] = useState(false)

    const navigate = useNavigate()

    const formatFileSize = (bytes) => {
        if (bytes < 1024) return `${bytes} B`
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    }

    const handleFileSelect = (file) => {
        if (!file) return
        if (file.size > 5 * 1024 * 1024) {
            toast.error("File size must be under 5MB")
            return
        }
        setSelectedFile(file)
    }

    const handleRemoveFile = (e) => {
        e.stopPropagation()
        setSelectedFile(null)
        if (resumeInputRef.current) resumeInputRef.current.value = ''
    }

    const handleGenerateReport = async () => {
        if (!jobDescription.trim()) {
            toast.error("Please provide a job description.")
            return
        }
        if (!selectedFile && !selfDescription.trim()) {
            toast.error("Please upload a resume or provide a quick self-description.")
            return
        }

        const resumeFile = selectedFile || undefined
        setIsGenerating(true)
        try {
            const data = await generateReport({ jobDescription, selfDescription, resumeFile })
            if (data?._id) {
                navigate(`/interview/${data._id}`)
            }
        } finally {
            setIsGenerating(false)
        }
    }

    return (
        <div className="home-container">
            <section className="generator-section">
                <div className="section-header-left">
                    <h1 className="generator-title">Optimize your resume</h1>
                    <p className="generator-subtitle">
                        Paste a job description and upload your resume. We will tailor it and score it against ATS in under 30 seconds.
                    </p>
                </div>

                <div className="generator-form-grid">
                    <div className="form-col form-col--left">
                        <div className="field-header">
                            <label className="field-label" htmlFor="jobDescription">
                                JOB DESCRIPTION <span className="required-asterisk">*</span>
                            </label>
                        </div>
                        <textarea
                            id="jobDescription"
                            name="jobDescription"
                            className="jd-textarea"
                            placeholder="Paste the full job description here..."
                            value={jobDescription}
                            maxLength={5000}
                            onChange={(e) => setJobDescription(e.target.value)}
                        />
                        <div className="char-count">
                            {jobDescription.length} / 5000
                        </div>
                    </div>

                    <div className="form-col form-col--right">
                        <div className="field-header">
                            <label className="field-label">
                                YOUR RESUME
                            </label>
                        </div>

                        <input
                            ref={resumeInputRef}
                            type="file"
                            id="resume"
                            name="resume"
                            accept=".pdf,.docx"
                            style={{ display: 'none' }}
                            onChange={(e) => handleFileSelect(e.target.files[0])}
                        />

                        {selectedFile ? (
                            <div className="file-preview-box">
                                <div className="file-info-col">
                                    <span className="file-name" title={selectedFile.name}>{selectedFile.name}</span>
                                    <span className="file-size">{formatFileSize(selectedFile.size)}</span>
                                </div>
                                <button
                                    type="button"
                                    className="file-remove-btn"
                                    onClick={handleRemoveFile}
                                    title="Remove file"
                                >
                                    x
                                </button>
                            </div>
                        ) : (
                            <div
                                className={`upload-dropzone${isDragging ? ' upload-dropzone--dragging' : ''}`}
                                onClick={() => resumeInputRef.current?.click()}
                                onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
                                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
                                onDragLeave={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (!e.currentTarget.contains(e.relatedTarget)) setIsDragging(false);
                                }}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setIsDragging(false);
                                    handleFileSelect(e.dataTransfer.files[0]);
                                }}
                            >
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="dropzone-icon">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                    <polyline points="17 8 12 3 7 8" />
                                    <line x1="12" y1="3" x2="12" y2="15" />
                                </svg>
                                <p className="dropzone-text">
                                    {isDragging ? "Drop your resume here" : "Click to upload or drag and drop"}
                                </p>
                                <span className="dropzone-hint">PDF or DOCX (Max 5MB)</span>
                            </div>
                        )}

                        <div className="or-divider">
                            <span>OR</span>
                        </div>

                        <textarea
                            id="selfDescription"
                            name="selfDescription"
                            className="self-textarea"
                            placeholder="Briefly describe your experience if you do not have a resume ready..."
                            value={selfDescription}
                            onChange={(e) => setSelfDescription(e.target.value)}
                        />
                    </div>
                </div>

                <div className="generator-action-row">
                    <button
                        type="button"
                        className="optimize-btn"
                        onClick={handleGenerateReport}
                        disabled={isGenerating}
                    >
                        {isGenerating ? "Optimizing resume..." : "Optimize Resume"}
                    </button>
                    <span className="action-subtext">Takes 20-30 seconds - ATS scored</span>
                    <Link to="/history" className="history-shortcut-link">
                        View your resume history
                    </Link>
                </div>
            </section>

            <LoadingOverlay isVisible={isGenerating} onCancel={cancelGeneration} />
        </div>
    )
}

export default Home
