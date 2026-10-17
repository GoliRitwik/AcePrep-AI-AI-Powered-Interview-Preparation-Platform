import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router'
import toast from 'react-hot-toast'
import '../style/mockInterview.scss'
import {
    startMockInterview,
    getActiveMockSession,
    sendMockInterviewAnswer,
    abandonMockSession
} from '../services/interview.api'
import {
    speakText,
    stopSpeaking,
    isSpeaking,
    createSpeechRecognizer,
    getAvailableVoices,
    isVoiceSupported,
    isTTSOnly
} from '../utils/voiceEngine'

// ── Constants ─────────────────────────────────────────────────────────────────
const MIC_DELAY_AFTER_TTS_MS = 600
const API_BASE_URL =
    import.meta.env.VITE_API_URL || "https://aceprep-backend-elm2.onrender.com"
const MODE_OPTIONS = [
    { value: "technical", label: "Technical", desc: "DSA, system design, and project deep-dives" },
    { value: "behavioral", label: "Behavioral", desc: "STAR questions mapped to key competencies" },
    { value: "hr", label: "HR", desc: "Motivation, culture fit, career goals, general background" },
    { value: "mixed", label: "Mixed", desc: "Full loop: HR intro → Technical → Behavioral" },
]
const PERSONA_OPTIONS = [
    { value: "friendly", label: "Friendly", desc: "Supportive, gives hints, encouraging tone" },
    { value: "neutral", label: "Neutral", desc: "Professional, no reaction, purely evaluative" },
    { value: "tough", label: "Tough", desc: "Demanding, challenges every answer, no compliments" },
]
const DIFFICULTY_OPTIONS = [
    { value: "easy", label: "Easy", desc: "Conceptual questions, 1 follow-up max" },
    { value: "medium", label: "Medium", desc: "Applied questions, up to 2 follow-ups" },
    { value: "hard", label: "Hard", desc: "Implementation depth, probing follow-ups, time pressure" },
]

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatTime(seconds) {
    const m = String(Math.floor(seconds / 60)).padStart(2, "0")
    const s = String(seconds % 60).padStart(2, "0")
    return `${m}:${s}`
}

function countWords(text) {
    return text.trim().split(/\s+/).filter(Boolean).length
}

// ── Sub-components ────────────────────────────────────────────────────────────
const PillGroup = ({ options, value, onChange }) => (
    <div className="pill-group">
        {options.map(opt => (
            <button
                key={opt.value}
                type="button"
                className={`pill${value === opt.value ? " pill--active" : ""}`}
                onClick={() => onChange(opt.value)}
            >
                <span className="pill__label">{opt.label}</span>
                <span className="pill__desc">{opt.desc}</span>
            </button>
        ))}
    </div>
)

const ChatMessage = ({ msg }) => (
    <div className={`chat-msg chat-msg--${msg.role}`}>
        <span className="chat-msg__sender">
            {msg.role === "interviewer" ? "Interviewer" : "You"}
        </span>
        <div className="chat-msg__bubble">
            {msg.content}
        </div>
    </div>
)

const TypingIndicator = () => (
    <div className="chat-msg chat-msg--interviewer">
        <span className="chat-msg__sender">Interviewer</span>
        <div className="chat-msg__bubble chat-msg__bubble--typing">
            <span /><span /><span />
        </div>
    </div>
)

const ScoreBar = ({ label, value, max = 25 }) => (
    <div className="score-bar">
        <div className="score-bar__header">
            <span className="score-bar__label">{label}</span>
            <span className="score-bar__value">{value}<span className="score-bar__max">/{max}</span></span>
        </div>
        <div className="score-bar__track">
            <div
                className="score-bar__fill"
                style={{ width: `${(value / max) * 100}%` }}
            />
        </div>
    </div>
)

// ── Main Component ────────────────────────────────────────────────────────────
const MockInterview = () => {
    const { reportId } = useParams()
    const navigate = useNavigate()

    // ── View state ────────────────────────────────────────────────────────────
    const [view, setView] = useState("loading") // loading | resume | setup | chat | feedback

    // ── Setup form ────────────────────────────────────────────────────────────
    const [mode, setMode] = useState("mixed")
    const [persona, setPersona] = useState("neutral")
    const [difficulty, setDifficulty] = useState("medium")
    const [isStarting, setIsStarting] = useState(false)

    // ── Session ───────────────────────────────────────────────────────────────
    const [sessionId, setSessionId] = useState(null)
    const [messages, setMessages] = useState([])
    const [sessionState, setSessionState] = useState(null)
    const [totalQuestions, setTotalQuestions] = useState(7)
    const [sessionStatus, setSessionStatus] = useState("in_progress")
    const [sessionMode, setSessionMode] = useState("mixed")
    const [sessionDifficulty, setSessionDifficulty] = useState("medium")
    const [feedback, setFeedback] = useState(null)
    const [resumedSession, setResumedSession] = useState(null)

    // ── Streaming ─────────────────────────────────────────────────────────────
    const [streamingText, setStreamingText] = useState("")
    const [isStreaming, setIsStreaming] = useState(false)

    // ── Timer ─────────────────────────────────────────────────────────────────
    const [elapsed, setElapsed] = useState(0)
    const timerRef = useRef(null)

    // ── End session overlay ───────────────────────────────────────────────────
    const [showEndOverlay, setShowEndOverlay] = useState(false)
    const [isAbandoning, setIsAbandoning] = useState(false)

    // ── Text input ────────────────────────────────────────────────────────────
    const [inputMode, setInputMode] = useState("text") // "text" | "voice"
    const [textAnswer, setTextAnswer] = useState("")
    // inputModeRef: always current inside stale SSE/TTS callbacks
    const inputModeRef = useRef("text")

    // ── Voice state machine ───────────────────────────────────────────────────
    // IDLE | LISTENING | FINALIZING | PROCESSING | RESPONDING | SPEAKING_BLOCKED
    const [voiceState, setVoiceState] = useState("IDLE")
    const [micReady, setMicReady] = useState(false)
    const [micPermission, setMicPermission] = useState("pending") // pending|granted|denied
    const [voiceSupported, setVoiceSupported] = useState(true)
    const [ttsOnly, setTtsOnly] = useState(false)
    const [availableVoices, setAvailableVoices] = useState([])
    const [selectedVoiceIdx, setSelectedVoiceIdx] = useState(0)
    // selectedVoiceRef: always current inside stale SSE/TTS callbacks
    const selectedVoiceRef = useRef(null)
    const [interimText, setInterimText] = useState("")
    const finalTranscriptRef = useRef("")
    const recognizerRef = useRef(null)
    // pendingSendRef: set when user taps Send while recognition is still finalizing.
    // The onTranscript callback checks this and submits as soon as the last result fires.
    const pendingSendRef = useRef(false)
    // New in Part 3: low-confidence hint + degraded-state banner
    const [lastTranscriptLowConfidence, setLastTranscriptLowConfidence] = useState(false)
    const [showSwitchToTextPrompt, setShowSwitchToTextPrompt] = useState(false)

    // ── Refs ──────────────────────────────────────────────────────────────────
    const chatBottomRef = useRef(null)
    const textareaRef = useRef(null)
    const sessionIdRef = useRef(null)  // for unmount cleanup
    const sessionStatusRef = useRef("in_progress")

    // Sync refs
    useEffect(() => { sessionIdRef.current = sessionId }, [sessionId])
    useEffect(() => { sessionStatusRef.current = sessionStatus }, [sessionStatus])

    // ── Auto-scroll ───────────────────────────────────────────────────────────
    useEffect(() => {
        chatBottomRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [messages, streamingText])

    // ── Timer ─────────────────────────────────────────────────────────────────
    const startTimer = useCallback(() => {
        clearInterval(timerRef.current)
        timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000)
    }, [])

    useEffect(() => () => clearInterval(timerRef.current), [])

    // ── Timer color ───────────────────────────────────────────────────────────
    const timerColor = elapsed >= 1800 ? "timer--red" : elapsed >= 1500 ? "timer--amber" : ""

    // ── Mic permission check + voice load ─────────────────────────────────────
    useEffect(() => {
        if (!isVoiceSupported()) { setVoiceSupported(false); return }
        if (isTTSOnly()) { setTtsOnly(true); return }

        navigator.mediaDevices?.getUserMedia({ audio: true })
            .then(stream => {
                stream.getTracks().forEach(t => t.stop())
                setMicPermission("granted")
                getAvailableVoices().then(voices => {
                    setAvailableVoices(voices)
                    // Populate ref immediately so callbacks always have a voice
                    if (voices.length > 0) selectedVoiceRef.current = voices[0]
                })
            })
            .catch(() => setMicPermission("denied"))

        // Part 4 — Brave browser advisory
        const checkBrave = async () => {
            const isBrave = (navigator.brave && await navigator.brave.isBrave?.()) || false
            if (isBrave) {
                toast(
                    "Voice recognition can be less reliable on Brave due to privacy shields. " +
                    "For best results: lower Shields for this site, or use Chrome.",
                    { duration: 7000, icon: "🛡️" }
                )
            }
        }
        checkBrave()
    }, [])

    // ── Mount: check for active session ──────────────────────────────────────
    useEffect(() => {
        getActiveMockSession(reportId)
            .then(data => {
                if (data.active) {
                    setResumedSession(data.active)
                    setView("resume")
                } else {
                    setView("setup")
                }
            })
            .catch(() => setView("setup"))
    }, [reportId])

    // ── Unmount cleanup ───────────────────────────────────────────────────────
    useEffect(() => {
        return () => {
            stopSpeaking()
            recognizerRef.current?.abort()
            clearInterval(timerRef.current)
            // Fire-and-forget abandon if still in_progress
            if (sessionStatusRef.current === "in_progress" && sessionIdRef.current) {
                fetch(`${API_BASE_URL}/api/mock-interview/${sessionIdRef.current}/abandon`, {
                    method: "PATCH",
                    credentials: "include"
                }).catch(() => { })
            }
        }
    }, [])

    // ── Resume existing session ───────────────────────────────────────────────
    const handleResume = () => {
        const s = resumedSession
        setSessionId(s._id)
        setMessages(s.messages || [])
        setSessionState(s.sessionState)
        setTotalQuestions(s.sessionState?.totalQuestionsInPool || 7)
        setSessionMode(s.mode)
        setSessionDifficulty(s.difficulty)
        setPersona(s.persona)
        startTimer()
        setView("chat")
    }

    // ── Start new session ─────────────────────────────────────────────────────
    const handleStart = async () => {
        setIsStarting(true)
        try {
            const data = await startMockInterview({ reportId, mode, difficulty, persona })
            setSessionId(data.mockInterviewId)
            setMessages([{ role: "interviewer", content: data.message }])
            setTotalQuestions(data.totalQuestions)
            setSessionMode(mode)
            setSessionDifficulty(difficulty)
            startTimer()
            setView("chat")

            // Auto-speak opening message in voice mode
            // Use inputModeRef (not state) in case closure is stale
            if (inputModeRef.current === "voice" && micPermission === "granted") {
                setVoiceState("SPEAKING_BLOCKED")
                setMicReady(false)
                // rAF: avoids Chrome bug where speak() silently fails right after cancel()
                requestAnimationFrame(() => {
                    speakText(
                        data.message,
                        selectedVoiceRef.current,
                        () => setVoiceState("SPEAKING_BLOCKED"),
                        () => {
                            setTimeout(() => { setMicReady(true); setVoiceState("IDLE") }, MIC_DELAY_AFTER_TTS_MS)
                        },
                        (e) => {
                            console.error("TTS error (opening):", e)
                            setTimeout(() => { setMicReady(true); setVoiceState("IDLE") }, 300)
                        }
                    )
                })
            }
        } catch (err) {
            toast.error(err?.response?.data?.message || "Failed to start interview.")
        } finally {
            setIsStarting(false)
        }
    }

    // ── Submit answer ─────────────────────────────────────────────────────────
    // IMPORTANT: reads inputModeRef / selectedVoiceRef (not state) inside
    // callbacks — SSE callbacks close over stale state if we use state directly.
    const handleSubmitAnswer = useCallback(async (answer) => {
        if (!answer.trim() || isStreaming) return

        // 1. Immediately update UI — don't wait for the AI
        setMessages(prev => [...prev, { role: "candidate", content: answer }])
        setTextAnswer("")
        setStreamingText("")
        setIsStreaming(true)
        finalTranscriptRef.current = ""
        setInterimText("")

        if (inputModeRef.current === "voice") {
            setVoiceState("PROCESSING")  // show spinner immediately
            setMicReady(false)
            recognizerRef.current?.stop()
        }

        let accumulated = ""
        let completeCalled = false  // guard against double onComplete

        await sendMockInterviewAnswer(
            sessionId,
            answer,
            // onToken — first token arrives → switch from PROCESSING to RESPONDING
            (token) => {
                accumulated += token
                setStreamingText(t => t + token)
                if (inputModeRef.current === "voice") setVoiceState("RESPONDING")
            },
            // onComplete
            (fb) => {
                if (completeCalled) return  // prevent double-fire from stream end fallback
                completeCalled = true

                setMessages(prev => [...prev, { role: "interviewer", content: accumulated }])
                setStreamingText("")
                setIsStreaming(false)

                if (fb) {
                    // Session finished → go to feedback
                    setFeedback(fb)
                    setSessionStatus("completed")
                    stopSpeaking()
                    clearInterval(timerRef.current)
                    setVoiceState("IDLE")
                    setView("feedback")
                    return
                }

                // Voice mode: speak the full response, then re-enable mic
                if (inputModeRef.current === "voice" && accumulated) {
                    setVoiceState("SPEAKING_BLOCKED")
                    requestAnimationFrame(() => {
                        speakText(
                            accumulated,
                            selectedVoiceRef.current,
                            () => setVoiceState("SPEAKING_BLOCKED"),
                            () => {
                                setTimeout(() => {
                                    setMicReady(true)
                                    setVoiceState("IDLE")
                                }, MIC_DELAY_AFTER_TTS_MS)
                            },
                            (e) => {
                                console.error("TTS error:", e)
                                // Even on TTS error — re-enable mic so user isn't stuck
                                setTimeout(() => { setMicReady(true); setVoiceState("IDLE") }, 300)
                            }
                        )
                    })
                } else if (inputModeRef.current !== "voice") {
                    // Text mode: nothing to speak, just unblock
                    setVoiceState("IDLE")
                }
            },
            // onError
            (reason) => {
                setIsStreaming(false)
                setStreamingText("")
                // Always re-enable mic on error so user isn't stuck
                setVoiceState("IDLE")
                setMicReady(true)
                if (reason === "rate_limited") {
                    toast.error("Please wait a moment before sending again.")
                } else if (reason === "response_timeout") {
                    toast.error("Interviewer took too long to respond — please try again.", { duration: 4000 })
                } else if (reason === "network_error") {
                    toast.error("Connection lost — check your internet and try again.", { duration: 4000 })
                } else {
                    toast.error("Something went wrong. Please try again.")
                }
            }
        )
    }, [sessionId, isStreaming])

    // ── Keyboard shortcut: Cmd/Ctrl+Enter ────────────────────────────────────
    const handleKeyDown = (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault()
            handleSubmitAnswer(textAnswer)
        }
    }

    // ── Voice mode: toggle mic ────────────────────────────────────────────────
    const handleMicToggle = () => {
        if (voiceState === "IDLE" && micReady && !isSpeaking()) {
            // Start listening
            finalTranscriptRef.current = ""
            pendingSendRef.current = false
            setInterimText("")
            setLastTranscriptLowConfidence(false)
            setVoiceState("LISTENING")

            recognizerRef.current = createSpeechRecognizer(
                // onTranscript (final) — Part 2: now receives (text, isLowConfidence)
                (text, isLowConfidence) => {
                    // Discard if TTS still playing
                    if (isSpeaking()) return
                    finalTranscriptRef.current = (finalTranscriptRef.current + " " + text).trim()
                    if (isLowConfidence) setLastTranscriptLowConfidence(true)

                    // If user already tapped Send while recognition was finalizing,
                    // submit now that the last onresult final event has arrived.
                    if (pendingSendRef.current) {
                        pendingSendRef.current = false
                        const captured = finalTranscriptRef.current
                        finalTranscriptRef.current = ""
                        setInterimText("")
                        handleSubmitAnswer(captured)
                    }
                },
                // onInterim
                (interim) => {
                    if (!isSpeaking()) setInterimText(interim)
                },
                // onError — Part 2: now receives { error, message } objects
                (err) => {
                    if (err.error === "not-supported") {
                        setInputMode("text")
                        inputModeRef.current = "text"
                        toast("Voice not supported — switching to text mode")
                        return
                    }
                    if (err.error === "restart-limit-exceeded") {
                        toast.error(err.message, { duration: 6000 })
                        setShowSwitchToTextPrompt(true)
                        setVoiceState("IDLE")
                        return
                    }
                    if (err.error === "not-allowed" || err.error === "audio-capture") {
                        toast.error(err.message, { duration: 5000 })
                        setVoiceState("IDLE")
                        return
                    }
                    if (err.message) {
                        toast(err.message, { duration: 3500 })
                    }
                },
                // onStatusChange — Part 2: optional, for watchdog / circuit breaker signals
                (status) => {
                    if (status === "watchdog-restart") {
                        console.warn("[MockInterview] voice recognition recovered via watchdog")
                    }
                    if (status === "degraded") {
                        setShowSwitchToTextPrompt(true)
                    }
                }
            )
            recognizerRef.current?.start()
        } else if (voiceState === "LISTENING") {
            // Stop listening (don't auto-send — user taps Send to confirm)
            recognizerRef.current?.stop()
            setVoiceState("IDLE")
            setMicReady(false)
        }
    }

    // ── Voice: send accumulated transcript ────────────────────────────────────
    // recognition.stop() is async. The final onresult event may fire AFTER
    // this function returns. pendingSendRef defers submit until it arrives.
    // FINALIZING state (600ms window) is shown while we wait.
    const FINALIZE_WAIT_MS = 600

    const handleVoiceSend = () => {
        const currentTranscript = finalTranscriptRef.current.trim()

        if (currentTranscript) {
            // Already have final text — submit immediately
            finalTranscriptRef.current = ""
            setInterimText("")
            setLastTranscriptLowConfidence(false)
            recognizerRef.current?.stop()
            handleSubmitAnswer(currentTranscript)
        } else {
            // No final transcript yet (recognition still processing last word).
            // Show FINALIZING state, set flag, wait for last onresult to fire.
            setVoiceState("FINALIZING")
            pendingSendRef.current = true
            recognizerRef.current?.stop()
            setInterimText("")

            // 600ms is sufficient for the last onresult to fire after stop()
            setTimeout(() => {
                if (!pendingSendRef.current) return  // already handled by onTranscript
                pendingSendRef.current = false
                const interimFallback = interimText.trim()
                setInterimText("")

                if (interimFallback) {
                    finalTranscriptRef.current = ""
                    handleSubmitAnswer(interimFallback)
                } else {
                    toast.error("No speech detected — please try again or switch to text mode")
                    setVoiceState("IDLE")
                    setMicReady(true)
                }
            }, FINALIZE_WAIT_MS)
        }
    }

    // ── Skip TTS ──────────────────────────────────────────────────────────────
    const handleSkipTTS = () => {
        stopSpeaking()
        setTimeout(() => { setMicReady(true); setVoiceState("IDLE") }, 100)
    }

    // ── Mode switch ───────────────────────────────────────────────────────────
    const handleSwitchToText = () => {
        stopSpeaking()
        recognizerRef.current?.stop()
        setInputMode("text")
        inputModeRef.current = "text"   // keep ref in sync
        // Preserve any accumulated transcript
        if (finalTranscriptRef.current) {
            setTextAnswer(finalTranscriptRef.current)
            finalTranscriptRef.current = ""
        }
        setInterimText("")
        setVoiceState("IDLE")
        setMicReady(false)
    }

    const handleSwitchToVoice = () => {
        setInputMode("voice")
        inputModeRef.current = "voice"  // keep ref in sync
        setVoiceState("IDLE")
        setMicReady(true)
    }

    // ── Abandon ───────────────────────────────────────────────────────────────
    const handleAbandon = async () => {
        setIsAbandoning(true)
        stopSpeaking()
        recognizerRef.current?.abort()
        clearInterval(timerRef.current)
        try {
            const data = await abandonMockSession(sessionId)
            setSessionStatus("abandoned")
            if (data.partialFeedback) {
                setFeedback(data.partialFeedback)
                setView("feedback")
            } else {
                toast("Not enough answers for feedback (need at least 3 questions). Session saved.", { icon: "💾" })
                navigate(`/interview/${reportId}`)
            }
        } catch {
            toast.error("Failed to end session.")
        } finally {
            setIsAbandoning(false)
            setShowEndOverlay(false)
        }
    }

    // ── Preview voice ─────────────────────────────────────────────────────────
    const handlePreviewVoice = () => {
        speakText("Hello, I will be your interviewer today.", selectedVoiceRef.current, null, null, null)
    }

    // ── Word count ────────────────────────────────────────────────────────────
    const wordCount = countWords(textAnswer)
    const wordCountClass = wordCount >= 200 ? "wc--red" : wordCount >= 180 ? "wc--amber" : ""
    const voiceWordCount = countWords(finalTranscriptRef.current + " " + interimText)

    // ── Question counter ──────────────────────────────────────────────────────
    const questionsAsked = sessionState?.askedQuestionIndices?.length || 0

    // ═══════════════════════════════════════════════════════════════════════════
    // VIEWS
    // ═══════════════════════════════════════════════════════════════════════════

    if (view === "loading") {
        return (
            <main className="mi-loading">
                <div className="mi-loading__spinner" />
                <p>Checking for active session…</p>
            </main>
        )
    }

    // ── Resume screen ─────────────────────────────────────────────────────────
    if (view === "resume") {
        const s = resumedSession
        const asked = s?.sessionState?.askedQuestionIndices?.length || 0
        const total = s?.sessionState?.totalQuestionsInPool || 7
        return (
            <main className="mi-resume">
                <div className="mi-resume__card">
                    <div className="mi-resume__icon">⏱</div>
                    <h1>Active Session Found</h1>
                    <p className="mi-resume__sub">
                        You have an in-progress <strong>{s?.mode}</strong> interview
                        — Question <strong>{asked}</strong> of <strong>{total}</strong>
                    </p>
                    <div className="mi-resume__actions">
                        <button className="mi-btn mi-btn--primary" onClick={handleResume}>
                            Resume Interview
                        </button>
                        <button className="mi-btn mi-btn--ghost" onClick={() => setView("setup")}>
                            Start New Session
                        </button>
                    </div>
                </div>
            </main>
        )
    }

    // ── Setup screen ──────────────────────────────────────────────────────────
    if (view === "setup") {
        const ttsOnlyNote = ttsOnly
        const startingInVoice = micPermission === "granted" && !ttsOnlyNote
        return (
            <main className="mi-setup">
                <div className="mi-setup__card">
                    <h1 className="mi-setup__title">Configure Your Mock Interview</h1>
                    <p className="mi-setup__sub">Customise the session to match your preparation goals.</p>

                    <div className="mi-setup__section">
                        <label className="mi-setup__label">Interview Mode</label>
                        <PillGroup options={MODE_OPTIONS} value={mode} onChange={setMode} />
                    </div>

                    <div className="mi-setup__section">
                        <label className="mi-setup__label">Interviewer Persona</label>
                        <PillGroup options={PERSONA_OPTIONS} value={persona} onChange={setPersona} />
                    </div>

                    <div className="mi-setup__section">
                        <label className="mi-setup__label">Difficulty</label>
                        <PillGroup options={DIFFICULTY_OPTIONS} value={difficulty} onChange={setDifficulty} />
                    </div>

                    <p className="mi-setup__info">
                        Session: up to 7 questions · max 30 minutes · answers capped at 200 words
                    </p>

                    {/* Voice setup */}
                    <div className="mi-setup__voice">
                        <div className="mi-setup__voice-status">
                            {micPermission === "pending" && (
                                <span className="mic-status mic-status--pending">Checking microphone…</span>
                            )}
                            {micPermission === "granted" && !ttsOnlyNote && (
                                <span className="mic-status mic-status--granted">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3zm-1 19.93V23h2v-2.07A7 7 0 0 0 19 14h-2a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.93z" /></svg>
                                    Microphone ready
                                </span>
                            )}
                            {micPermission === "denied" && (
                                <span className="mic-status mic-status--denied">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3zm-1 19.93V23h2v-2.07A7 7 0 0 0 19 14h-2a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.93z" /></svg>
                                    Microphone unavailable — text mode will be used
                                </span>
                            )}
                            {ttsOnlyNote && (
                                <span className="mic-status mic-status--denied">
                                    Firefox detected — AI will speak questions aloud but mic input is unavailable. You will type your answers.
                                </span>
                            )}
                        </div>

                        {micPermission === "granted" && !ttsOnlyNote && availableVoices.length > 0 && (
                            <div className="mi-setup__voice-picker">
                                <select
                                    className="voice-select"
                                    value={selectedVoiceIdx}
                                    onChange={e => {
                                        const idx = Number(e.target.value)
                                        setSelectedVoiceIdx(idx)
                                        // Sync ref immediately so callbacks use the new voice
                                        selectedVoiceRef.current = availableVoices[idx] || null
                                    }}
                                >
                                    {availableVoices.map((v, i) => (
                                        <option key={i} value={i}>{v.name}</option>
                                    ))}
                                </select>
                                <button className="mi-btn mi-btn--ghost mi-btn--sm" onClick={handlePreviewVoice}>
                                    Preview
                                </button>
                            </div>
                        )}

                        <p className="mi-setup__starting-mode">
                            Starting in: <strong>{startingInVoice ? "Voice mode 🎤" : "Text mode ⌨"}</strong>
                        </p>
                    </div>

                    <button
                        className="mi-btn mi-btn--primary mi-btn--lg"
                        onClick={handleStart}
                        disabled={isStarting}
                    >
                        {isStarting ? "Starting…" : "Start Interview"}
                    </button>
                </div>
            </main>
        )
    }

    // ── Feedback view ─────────────────────────────────────────────────────────
    if (view === "feedback" && feedback) {
        const scores = feedback.scores || {}
        const ratingColor = { strong: "rating--strong", acceptable: "rating--acceptable", weak: "rating--weak" }
        const trendIcon = feedback.comparedToPrevious?.trend === "improved" ? "📈"
            : feedback.comparedToPrevious?.trend === "declined" ? "📉" : "➡️"

        return (
            <main className="mi-feedback">
                <div className="mi-feedback__inner">
                    <div className="mi-feedback__header">
                        <h1>Interview Complete</h1>
                        {sessionStatus === "abandoned" && (
                            <span className="mi-feedback__badge mi-feedback__badge--partial">Partial Session</span>
                        )}
                    </div>

                    {/* Overall score */}
                    <div className="mi-feedback__score-card">
                        <div className="mi-feedback__overall">
                            <span className="mi-feedback__score-num">{feedback.overallScore}</span>
                            <span className="mi-feedback__score-max">/100</span>
                        </div>
                        <p className="mi-feedback__summary">{feedback.summary}</p>
                        {feedback.comparedToPrevious && (
                            <p className="mi-feedback__trend">
                                {trendIcon} {feedback.comparedToPrevious.trend === "improved" ? "+" : ""}
                                {feedback.comparedToPrevious.scoreDelta} vs previous session
                                ({feedback.comparedToPrevious.previousScore}/100)
                            </p>
                        )}
                    </div>

                    {/* Dimension bars */}
                    <div className="mi-feedback__dimensions">
                        <ScoreBar label="Technical Accuracy" value={scores.technicalAccuracy || 0} />
                        <ScoreBar label="Communication Clarity" value={scores.communicationClarity || 0} />
                        <ScoreBar label="Structure & Examples" value={scores.structureAndExamples || 0} />
                        <ScoreBar label="Depth Under Pressure" value={scores.depthUnderPressure || 0} />
                    </div>

                    {/* Per-question ratings */}
                    {feedback.perQuestionRatings?.length > 0 && (
                        <div className="mi-feedback__section">
                            <h2>Per-Question Ratings</h2>
                            <div className="pq-list">
                                {feedback.perQuestionRatings.map((r, i) => (
                                    <div key={i} className={`pq-row ${ratingColor[r.rating] || ""}`}>
                                        <div className="pq-row__top">
                                            <span className="pq-row__q">{r.question}</span>
                                            <span className={`pq-row__badge pq-row__badge--${r.rating}`}>
                                                {r.rating.charAt(0).toUpperCase() + r.rating.slice(1)}
                                            </span>
                                        </div>
                                        <p className="pq-row__comment">{r.comment}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Strengths & improvements */}
                    <div className="mi-feedback__cols">
                        <div className="mi-feedback__section">
                            <h2>✓ Strengths</h2>
                            <ul className="mi-feedback__list mi-feedback__list--strengths">
                                {feedback.strengths?.map((s, i) => <li key={i}>{s}</li>)}
                            </ul>
                        </div>
                        <div className="mi-feedback__section">
                            <h2>↑ Improvements</h2>
                            <ul className="mi-feedback__list mi-feedback__list--improvements">
                                {feedback.improvements?.map((s, i) => <li key={i}>{s}</li>)}
                            </ul>
                        </div>
                    </div>

                    <div className="mi-feedback__actions">
                        <button className="mi-btn mi-btn--primary" onClick={() => navigate(`/interview/${reportId}`)}>
                            Back to Report
                        </button>
                        <button className="mi-btn mi-btn--ghost" onClick={() => setView("setup")}>
                            Try Again
                        </button>
                    </div>
                </div>
            </main>
        )
    }

    // ── Chat view ─────────────────────────────────────────────────────────────
    const canSubmitText = !isStreaming && textAnswer.trim().length > 0 && sessionStatus === "in_progress"
    const canToggleMic = micReady && !isSpeaking() && inputMode === "voice" &&
        (voiceState === "IDLE" || voiceState === "LISTENING")

    return (
        <div className="mi-chat">

            {/* ── Top Bar ── */}
            <header className="mi-topbar">
                <div className="mi-topbar__left">
                    <span className="mi-topbar__mode-badge">{sessionMode}</span>
                    <span className="mi-topbar__diff-badge mi-topbar__diff-badge--{sessionDifficulty}">{sessionDifficulty}</span>
                </div>
                <div className="mi-topbar__center">
                    <span className="mi-topbar__counter">
                        Question {questionsAsked} of {totalQuestions}
                    </span>
                </div>
                <div className="mi-topbar__right">
                    <span className={`mi-topbar__timer ${timerColor}`}>{formatTime(elapsed)}</span>

                    {/* Mode toggle */}
                    {!ttsOnly && micPermission === "granted" && (
                        <div className="mi-mode-toggle">
                            <button
                                className={`mi-mode-toggle__btn${inputMode === "voice" ? " active" : ""}`}
                                onClick={handleSwitchToVoice}
                                title="Voice mode"
                            >🎤</button>
                            <button
                                className={`mi-mode-toggle__btn${inputMode === "text" ? " active" : ""}`}
                                onClick={handleSwitchToText}
                                title="Text mode"
                            >⌨</button>
                        </div>
                    )}

                    <button
                        className="mi-btn mi-btn--ghost mi-btn--sm"
                        onClick={() => setShowEndOverlay(true)}
                        disabled={sessionStatus !== "in_progress"}
                    >
                        End
                    </button>
                </div>
            </header>

            {/* ── Messages ── */}
            <div className="mi-messages">
                {messages.map((msg, i) => (
                    <ChatMessage key={i} msg={msg} />
                ))}
                {isStreaming && streamingText && (
                    <div className="chat-msg chat-msg--interviewer">
                        <span className="chat-msg__sender">Interviewer</span>
                        <div className="chat-msg__bubble chat-msg__bubble--streaming">
                            {streamingText}
                            <span className="chat-cursor" />
                        </div>
                    </div>
                )}
                {isStreaming && !streamingText && <TypingIndicator />}
                <div ref={chatBottomRef} />
            </div>

            {/* ── Input Area ── */}
            {sessionStatus === "in_progress" && (
                <div className="mi-input-area">

                    {inputMode === "text" ? (
                        /* Text mode */
                        <div className="mi-text-input">
                            <textarea
                                ref={textareaRef}
                                className="mi-textarea"
                                value={textAnswer}
                                onChange={e => setTextAnswer(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Type your answer here…"
                                rows={1}
                                disabled={isStreaming}
                            />
                            <div className="mi-text-input__footer">
                                <span className={`mi-wc ${wordCountClass}`}>{wordCount} / 200 words</span>
                                {wordCount >= 200 && <span className="mi-wc-note">Long answers may be truncated</span>}
                                <button
                                    className="mi-send-btn"
                                    onClick={() => handleSubmitAnswer(textAnswer)}
                                    disabled={!canSubmitText}
                                    title="Send (Ctrl+Enter)"
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="22" y1="2" x2="11" y2="13" />
                                        <polygon points="22 2 15 22 11 13 2 9 22 2" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    ) : (
                        /* Voice mode */
                        <div className="mi-voice-area">

                            {/* Part 3C — Switch-to-text prompt banner (shown on degraded/circuit-breaker state) */}
                            {showSwitchToTextPrompt && (
                                <div className="mi-switch-prompt">
                                    <span>Voice recognition is having issues</span>
                                    <button onClick={handleSwitchToText}>
                                        Switch to text mode
                                    </button>
                                    <button
                                        className="mi-switch-prompt__dismiss"
                                        onClick={() => setShowSwitchToTextPrompt(false)}
                                    >
                                        ✕
                                    </button>
                                </div>
                            )}

                            {voiceState === "SPEAKING_BLOCKED" || voiceState === "RESPONDING" ? (
                                <div className="mi-voice-state mi-voice-state--speaking">
                                    <div className="sound-wave">
                                        <span /><span /><span /><span />
                                    </div>
                                    <p>Interviewer speaking…</p>
                                    <button className="mi-btn mi-btn--ghost mi-btn--sm" onClick={handleSkipTTS}>
                                        ▶▶ Skip
                                    </button>
                                </div>
                            ) : voiceState === "PROCESSING" ? (
                                <div className="mi-voice-state mi-voice-state--processing">
                                    <div className="mi-loading__spinner" />
                                    <p>Processing your answer…</p>
                                    <p>Usually takes 3–8 seconds</p>
                                </div>
                            ) : voiceState === "FINALIZING" ? (
                                /* Part 3A — Capturing last words before submit */
                                <div className="mi-voice-state mi-voice-finalizing">
                                    <div className="mi-voice-finalizing__dots">
                                        <span /><span /><span />
                                    </div>
                                    <p>Capturing last words…</p>
                                </div>
                            ) : voiceState === "LISTENING" ? (
                                <div className="mi-voice-state mi-voice-state--listening">
                                    {(interimText || finalTranscriptRef.current) && (
                                        <div className="mi-interim-preview">
                                            <p className="mi-interim-text">
                                                {finalTranscriptRef.current} <em>{interimText}</em>
                                            </p>
                                            <span className={`mi-wc ${voiceWordCount >= 200 ? "wc--red" : voiceWordCount >= 180 ? "wc--amber" : ""}`}>
                                                {voiceWordCount} / 200 words
                                            </span>
                                        </div>
                                    )}
                                    {/* Part 3B — Low-confidence hint */}
                                    {lastTranscriptLowConfidence && (
                                        <p className="mi-confidence-hint">
                                            Didn’t catch that clearly — keep talking or edit before sending
                                        </p>
                                    )}
                                    <button
                                        className="mi-mic-btn mi-mic-btn--active"
                                        onClick={handleMicToggle}
                                        aria-label="Stop recording"
                                    >
                                        <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3zm-1 19.93V23h2v-2.07A7 7 0 0 0 19 14h-2a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.93z" />
                                        </svg>
                                    </button>
                                    <p className="mi-voice-hint">Listening… tap mic to stop</p>
                                    {(finalTranscriptRef.current || interimText) && (
                                        <button
                                            className="mi-btn mi-btn--primary mi-btn--sm"
                                            onClick={handleVoiceSend}
                                        >
                                            Send Answer
                                        </button>
                                    )}
                                </div>
                            ) : (
                                /* IDLE */
                                <div className="mi-voice-state mi-voice-state--idle">
                                    <button
                                        className={`mi-mic-btn${canToggleMic ? "" : " mi-mic-btn--disabled"}`}
                                        onClick={handleMicToggle}
                                        disabled={!canToggleMic}
                                        aria-label="Start speaking"
                                    >
                                        <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3zm-1 19.93V23h2v-2.07A7 7 0 0 0 19 14h-2a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.93z" />
                                        </svg>
                                    </button>
                                    <p className="mi-voice-hint">
                                        {micReady ? "Your turn — tap mic to speak" : "Waiting for interviewer…"}
                                    </p>
                                    {/* Part 3D — Always-visible text fallback link */}
                                    <button
                                        className="mi-text-fallback-link"
                                        onClick={handleSwitchToText}
                                    >
                                        Switch to text mode
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* ── End Interview overlay ── */}
            {showEndOverlay && (
                <div className="mi-overlay">
                    <div className="mi-overlay__card">
                        <h2>End this session early?</h2>
                        <p>
                            {(sessionState?.askedQuestionIndices?.length || 0) >= 3
                                ? "You'll receive partial feedback based on your answers so far."
                                : "You need at least 3 answered questions for feedback."}
                        </p>
                        <div className="mi-overlay__actions">
                            <button
                                className="mi-btn mi-btn--primary"
                                onClick={handleAbandon}
                                disabled={isAbandoning}
                            >
                                {isAbandoning ? "Ending…" : "Get partial feedback"}
                            </button>
                            <button
                                className="mi-btn mi-btn--ghost"
                                onClick={() => setShowEndOverlay(false)}
                                disabled={isAbandoning}
                            >
                                Keep going
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default MockInterview
