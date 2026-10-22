import React, { useState, useEffect } from 'react'
import '../style/interview.scss'
import { useInterview } from '../hooks/useInterview.js'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import toast from 'react-hot-toast'
import GenerateButton from '../../../components/GenerateButton/GenerateButton.jsx'
import ResumeBuilderModal from '../components/ResumeBuilderModal/ResumeBuilderModal.jsx'



const NAV_ITEMS = [
    { id: 'technical', label: 'Technical Questions', icon: (<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>) },
    { id: 'behavioral', label: 'Behavioral Questions', icon: (<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>) },
    { id: 'roadmap', label: 'Road Map', icon: (<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11" /></svg>) },
]

// ── Sub-components ────────────────────────────────────────────────────────────
const QuestionCard = ({ item, index }) => {
    const [ open, setOpen ] = useState(false)
    return (
        <div className='q-card'>
            <div className='q-card__header' onClick={() => setOpen(o => !o)}>
                <span className='q-card__index'>Q{index + 1}</span>
                <p className='q-card__question'>{item.question}</p>
                <span className={`q-card__chevron ${open ? 'q-card__chevron--open' : ''}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
                </span>
            </div>
            {open && (
                <div className='q-card__body'>
                    <div className='q-card__section'>
                        <span className='q-card__tag q-card__tag--intention'>Intention</span>
                        <p>{item.intention}</p>
                    </div>
                    <div className='q-card__section'>
                        <span className='q-card__tag q-card__tag--answer'>Model Answer</span>
                        <p>{item.answer}</p>
                    </div>
                </div>
            )}
        </div>
    )
}

const RoadMapDay = ({ day }) => (
    <div className='roadmap-day'>
        <div className='roadmap-day__header'>
            <span className='roadmap-day__badge'>Day {day.day}</span>
            <h3 className='roadmap-day__focus'>{day.focus}</h3>
        </div>
        <ul className='roadmap-day__tasks'>
            {day.tasks.map((task, i) => (
                <li key={i}>
                    <span className='roadmap-day__bullet' />
                    {task}
                </li>
            ))}
        </ul>
    </div>
)

// ── Main Component ────────────────────────────────────────────────────────────
const Interview = () => {
    const [ activeNav, setActiveNav ] = useState('technical')
    const { report, getReportById, loading, getResumePdf } = useInterview()
    const { interviewId, id: routeId } = useParams()
    const effectiveId = interviewId || routeId
    const [searchParams] = useSearchParams()
    const sectionParam = searchParams.get('section')
    const navigate = useNavigate()

    

    if (loading || !report) {
        return (
            <main className='loading-screen'>
                <h1>Loading your interview plan...</h1>
            </main>
        )
    }

    const scoreColor =
        report.matchScore >= 80 ? 'score--high' :
            report.matchScore >= 60 ? 'score--mid' : 'score--low'


    return (
        <div className='interview-page'>
            <div className='interview-layout'>

                {/* ── Left Nav ── */}
                <nav className='interview-nav'>
                    <div className="nav-content">
                        <p className='interview-nav__label'>Sections</p>
                        {NAV_ITEMS.map(item => (
                            <button
                                key={item.id}
                                className={`interview-nav__item ${activeNav === item.id ? 'interview-nav__item--active' : ''}`}
                                onClick={() => setActiveNav(item.id)}
                            >
                                <span className='interview-nav__icon'>{item.icon}</span>
                                {item.label}
                            </button>
                        ))}
                    </div>

                    <div className="nav-actions">
                        {/* Start Mock Interview */}
                        <button
                            className="button primary-button"
                            onClick={() => navigate(`/mock-interview/${effectiveId}`)}
                            style={{ marginBottom: '0.25rem' }}
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                                style={{ marginRight: '0.5rem' }}>
                                <polygon points="5 3 19 12 5 21 5 3" />
                            </svg>
                            Mock Interview
                        </button>

                        {/* Download Resume */}
                        <GenerateButton
                            onClick={() => setShowResumeBuilder(true)}
                            isLoading={false}
                            label="Download Resume"
                            loadingLabel="Building PDF…"
                        />

                        </div>
                </nav>

                <div className='interview-divider' />

                {/* ── Center Content ── */}
                <main className='interview-content'>
                    {activeNav === 'technical' && (
                        <section>
                            <div className='content-header'>
                                <h2>Technical Questions</h2>
                                <span className='content-header__count'>{report.technicalQuestions.length} questions</span>
                            </div>
                            <div className='q-list'>
                                {report.technicalQuestions.map((q, i) => (
                                    <QuestionCard key={i} item={q} index={i} />
                                ))}
                            </div>
                        </section>
                    )}

                    {activeNav === 'behavioral' && (
                        <section>
                            <div className='content-header'>
                                <h2>Behavioral Questions</h2>
                                <span className='content-header__count'>{report.behavioralQuestions.length} questions</span>
                            </div>
                            <div className='q-list'>
                                {report.behavioralQuestions.map((q, i) => (
                                    <QuestionCard key={i} item={q} index={i} />
                                ))}
                            </div>
                        </section>
                    )}

                    {activeNav === 'roadmap' && (
                        <section>
                            <div className='content-header'>
                                <h2>Preparation Road Map</h2>
                                <span className='content-header__count'>{report.preparationPlan.length}-day plan</span>
                            </div>
                            <div className='roadmap-list'>
                                {report.preparationPlan.map((day) => (
                                    <RoadMapDay key={day.day} day={day} />
                                ))}
                            </div>
                        </section>
                    )}
                </main>

                <div className='interview-divider' />

                {/* ── Right Sidebar ── */}
                <aside className='interview-sidebar'>

                    {/* ── Match Score card ── */}
                    <div className='sidebar-card match-score'>
                        <p className='sidebar-section-label'>Match Score</p>
                        <div className={`match-score__ring ${scoreColor}`}>
                            <span className='match-score__value'>{report.matchScore}</span>
                            <span className='match-score__pct'>%</span>
                        </div>
                        {/* matchSummary: new field — fallback for old reports */}
                        <p className='match-score__summary'>
                            {report.matchSummary || 'Match analysis complete.'}
                        </p>
                    </div>

                    {/* ── Skill Gaps card ── */}
                    <div className='sidebar-card skill-gaps'>
                        <p className='sidebar-section-label'>Skill Gaps</p>

                        {report.skillGaps.length === 0 ? (
                            /* Zero-gap positive empty state */
                            <div className='skill-gaps__empty'>
                                <span className='skill-gaps__empty-icon'>✓</span>
                                <p className='skill-gaps__empty-text'>
                                    No major skill gaps identified — focus on mock
                                    interviews and deepening your strongest areas.
                                </p>
                            </div>
                        ) : (
                            <div className='skill-gaps__list'>
                                {report.skillGaps.map((gap, i) => (
                                    <div key={i} className={`gap-row gap-row--${gap.severity}`}>
                                        {/* Top line: skill name + severity badge */}
                                        <div className='gap-row__top'>
                                            <span className='gap-row__skill'>{gap.skill}</span>
                                            <span className={`gap-row__badge gap-row__badge--${gap.severity}`}>
                                                {gap.severity.charAt(0).toUpperCase() + gap.severity.slice(1)}
                                            </span>
                                        </div>

                                        {/* Reason — why this skill matters for this role */}
                                        {gap.reason && (
                                            <p className='gap-row__reason'>{gap.reason}</p>
                                        )}

                                        {/* Actionable suggestion */}
                                        {gap.suggestion && (
                                            <p className='gap-row__suggestion'>
                                                <span className='gap-row__suggestion-icon'>💡</span>
                                                {gap.suggestion}
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                </aside>
            </div>

            {/* ── Resume Builder Modal ── */}
            {showResumeBuilder && report && (
                <ResumeBuilderModal
                    report={report}
                    onClose={() => setShowResumeBuilder(false)}
                    onDownloadComplete={() => {
                        setShowResumeBuilder(false)
                        toast.success('Resume downloaded!')
                    }}
                />
            )}
        </div>
    )
}

export default Interview