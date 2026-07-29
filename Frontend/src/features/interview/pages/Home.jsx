import React, { useState, useRef } from 'react'
import "../style/home.scss"
import { useInterview } from '../hooks/useInterview.js'
import { useNavigate, Link, useLocation } from 'react-router'
import { useAuth } from '../../auth/hooks/useAuth.js'
import LoadingOverlay from '../../../components/LoadingOverlay/LoadingOverlay.jsx'
import GenerateButton from '../../../components/GenerateButton/GenerateButton.jsx'
import toast from 'react-hot-toast'

const Home = () => {

    const { loading, generateReport, cancelGeneration, reports } = useInterview()
    const { user, handleLogout } = useAuth()
    const [ jobDescription, setJobDescription ] = useState("")
    const [ selfDescription, setSelfDescription ] = useState("")
    const resumeInputRef = useRef()
    const [selectedFile, setSelectedFile] = useState(null)
    const [isDragging, setIsDragging] = useState(false)

    // Formats raw bytes into a human-readable string (KB / MB)
    const formatFileSize = (bytes) => {
        if (bytes < 1024) return `${bytes} B`
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    }

    // Single handler for both click-to-select and drag-and-drop
    const handleFileSelect = (file) => {
        if (!file) return
        if (file.size > 5 * 1024 * 1024) {
            toast.error("File size must be under 5MB")
            return
        }
        setSelectedFile(file)
    }

    const handleRemoveFile = () => {
        setSelectedFile(null)
        if (resumeInputRef.current) resumeInputRef.current.value = ''   // allow re-selecting the same file
    }

    const navigate = useNavigate()
    const location = useLocation()

    // Tracks report generation specifically (separate from hook's loading state
    // which also fires on initial page load)
    const [isGenerating, setIsGenerating] = useState(false)

    const handleGenerateReport = async () => {
        // Use selectedFile state — this is set by BOTH click-select and drag-and-drop.
        // Never read resumeInputRef.current.files[0] here: drag-and-drop doesn't
        // populate the <input> file list, so it would always be undefined.
        const resumeFile = selectedFile || undefined
        setIsGenerating(true)
        try {
            const data = await generateReport({ jobDescription, selfDescription, resumeFile })
            // data is null when user cancelled — don't navigate in that case
            if (data?._id) {
                navigate(`/interview/${data._id}`)
            }
        } finally {
            // Always reset — even if the API call throws
            setIsGenerating(false)
        }
    }

    // Only show the simple loading screen on initial page load (reports fetching)
    // During generation, isGenerating=true so we skip this and show the overlay instead
    if (loading && !isGenerating) {
        return (
            <main className='loading-screen'>
                <h1>Loading your interview plan...</h1>
            </main>
        )
    }

    return (
        <div className='home-page'>

            {/* ── Navbar ── */}
            <nav className='app-navbar'>
                <div className='nav-logo'>
                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
                    </svg>
                    AI Interview <span>Prep</span>
                </div>

                {/* Navigation links */}
                <div className='nav-links'>
                    <Link
                        to="/"
                        className={`nav-link${location.pathname === '/' ? ' nav-link--active' : ''}`}
                    >
                        New Plan
                    </Link>
                    <Link
                        to="/plans"
                        className={`nav-link${location.pathname === '/plans' ? ' nav-link--active' : ''}`}
                    >
                        My Plans
                    </Link>
                </div>

                <div className='nav-user'>
                    <div className='user-greeting'>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                            <circle cx="12" cy="7" r="4" />
                        </svg>
                        Hello, <strong>{user?.username}</strong>
                    </div>
                    <button className='logout-btn' onClick={handleLogout}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                            <polyline points="16 17 21 12 16 7" />
                            <line x1="21" y1="12" x2="9" y2="12" />
                        </svg>
                        Logout
                    </button>
                </div>
            </nav>

            {/* Page Header */}
            <header className='page-header'>
                <h1>Create Your Custom <span className='highlight'>Interview Plan</span></h1>
                <p>Let our AI analyze the job requirements and your unique profile to build a winning strategy.</p>
            </header>

            {/* Main Card */}
            <div className='interview-card'>
                <div className='interview-card__body'>

                    {/* Left Panel - Job Description */}
                    <div className='panel panel--left'>
                        <div className='panel__header'>
                            <span className='panel__icon'>
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></svg>
                            </span>
                            <h2>Target Job Description</h2>
                            <span className='badge badge--required'>Required</span>
                        </div>
                        <textarea
                            onChange={(e) => { setJobDescription(e.target.value) }}
                            className='panel__textarea'
                            placeholder={`Paste the full job description here...\ne.g. 'Senior Frontend Engineer at Google requires proficiency in React, TypeScript, and large-scale system design...'`}
                            maxLength={5000}
                        />
                        <div className='char-counter'>0 / 5000 chars</div>
                    </div>

                    {/* Vertical Divider */}
                    <div className='panel-divider' />

                    {/* Right Panel - Profile */}
                    <div className='panel panel--right'>
                        <div className='panel__header'>
                            <span className='panel__icon'>
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                            </span>
                            <h2>Your Profile</h2>
                        </div>

                        {/* Upload Resume */}
                        <div className='upload-section'>
                            <label className='section-label'>
                                Upload Resume
                                <span className='badge badge--best'>Best Results</span>
                            </label>

                            {/* Hidden file input — triggered programmatically */}
                            <input
                                ref={resumeInputRef}
                                type='file'
                                id='resume'
                                name='resume'
                                accept='.pdf,.docx'
                                style={{ display: 'none' }}
                                onChange={(e) => handleFileSelect(e.target.files[0])}
                            />

                            {selectedFile ? (
                                /* ── File preview card ── */
                                <div className='file-preview'>
                                    <span className='file-preview__icon'>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                            <polyline points="14 2 14 8 20 8" />
                                            <line x1="16" y1="13" x2="8" y2="13" />
                                            <line x1="16" y1="17" x2="8" y2="17" />
                                            <polyline points="10 9 9 9 8 9" />
                                        </svg>
                                    </span>
                                    <div className='file-preview__info'>
                                        <p className='file-preview__name' title={selectedFile.name}>
                                            {selectedFile.name}
                                        </p>
                                        <p className='file-preview__size'>{formatFileSize(selectedFile.size)}</p>
                                    </div>
                                    <button
                                        className='file-preview__remove'
                                        onClick={handleRemoveFile}
                                        title='Remove file'
                                        type='button'
                                    >
                                        ✕
                                    </button>
                                </div>
                            ) : (
                                /* ── Drop zone — div with full drag handlers ── */
                                <div
                                    className={`dropzone${isDragging ? ' dropzone--dragging' : ''}`}
                                    onClick={() => resumeInputRef.current?.click()}
                                    onDragEnter={(e) => {
                                        e.preventDefault()
                                        e.stopPropagation()
                                        setIsDragging(true)
                                    }}
                                    onDragOver={(e) => {
                                        // MUST call preventDefault() or the browser
                                        // treats the drop as a navigation event
                                        e.preventDefault()
                                        e.stopPropagation()
                                        setIsDragging(true)
                                    }}
                                    onDragLeave={(e) => {
                                        e.preventDefault()
                                        e.stopPropagation()
                                        // Only clear when leaving the zone entirely,
                                        // not when moving between child elements
                                        if (!e.currentTarget.contains(e.relatedTarget)) {
                                            setIsDragging(false)
                                        }
                                    }}
                                    onDrop={(e) => {
                                        e.preventDefault()
                                        e.stopPropagation()
                                        setIsDragging(false)
                                        // Drop events use dataTransfer.files — NOT e.target.files
                                        handleFileSelect(e.dataTransfer.files[0])
                                    }}
                                >
                                    <span className='dropzone__icon'>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 16 12 12 8 16" /><line x1="12" y1="12" x2="12" y2="21" /><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" /></svg>
                                    </span>
                                    <p className='dropzone__title'>
                                        {isDragging ? 'Drop your file here' : 'Click to upload or drag & drop'}
                                    </p>
                                    <p className='dropzone__subtitle'>PDF or DOCX · Max 5MB</p>
                                </div>
                            )}
                        </div>

                        {/* OR Divider */}
                        <div className='or-divider'><span>OR</span></div>

                        {/* Quick Self-Description */}
                        <div className='self-description'>
                            <label className='section-label' htmlFor='selfDescription'>Quick Self-Description</label>
                            <textarea
                                onChange={(e) => { setSelfDescription(e.target.value) }}
                                id='selfDescription'
                                name='selfDescription'
                                className='panel__textarea panel__textarea--short'
                                placeholder="Briefly describe your experience, key skills, and years of experience if you don't have a resume handy..."
                            />
                        </div>

                        {/* Info Box */}
                        <div className='info-box'>
                            <span className='info-box__icon'>
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" stroke="#1a1f27" strokeWidth="2" /><line x1="12" y1="16" x2="12.01" y2="16" stroke="#1a1f27" strokeWidth="2" /></svg>
                            </span>
                            <p>Either a <strong>Resume</strong> or a <strong>Self Description</strong> is required to generate a personalized plan.</p>
                        </div>
                    </div>
                </div>

                {/* Card Footer */}
                <div className='interview-card__footer'>
                    <span className='footer-info'>AI-Powered Strategy Generation &bull; Approx 30s</span>
                    <GenerateButton
                        onClick={handleGenerateReport}
                        isLoading={isGenerating}
                        label="Generate My Interview Strategy"
                        loadingLabel="Generating your plan…"
                    />
                </div>
            </div>

            {/* Page Footer */}
            <footer className='page-footer'>
                <a href='#'>Privacy Policy</a>
                <a href='#'>Terms of Service</a>
                <a href='#'>Help Center</a>
            </footer>

            {/* Full-screen overlay — appears during report generation only */}
            <LoadingOverlay isVisible={isGenerating} onCancel={cancelGeneration} />

        </div>
    )
}

export default Home