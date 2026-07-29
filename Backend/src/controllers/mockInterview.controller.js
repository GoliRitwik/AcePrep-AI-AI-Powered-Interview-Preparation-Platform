const MockInterview = require("../models/mockInterview.model")
const InterviewReport = require("../models/interviewReport.model")
const {
    buildQuestionPool,
    classifyAnswer,
    decideNextStep,
    generateInterviewerMessage,
    generateMockInterviewFeedback
} = require("../services/ai.service")

// ── In-memory cooldown tracker per session ────────────────────────────────────
// Prevents rapid double-submits from hammering the AI (1s cooldown)
const lastRespondTime = new Map()

// ── Fix B: classifyAnswer with 8s timeout ──────────────────────────────
// If Gemini is slow/rate-limited the classify call can hang indefinitely,
// leaving the SSE pipe open with no data. This wrapper falls back to a
// safe default classification so the interview continues.
async function classifyAnswerSafe(answer, question, difficulty, wordCount, isTooLong) {
    const TIMEOUT_MS = 8000
    const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("classify_timeout")), TIMEOUT_MS)
    )
    try {
        return await Promise.race([classifyAnswer(answer, question, difficulty, wordCount, isTooLong), timeout])
    } catch (err) {
        console.warn("[classifyAnswer] timed out or failed, using safe default:", err.message)
        return { quality: "acceptable", hasConcreteExample: false, keyClaimToProbe: null }
    }
}

// ── Opening message builder (pure JS, zero latency) ───────────────────────────
function buildOpeningMessage(report, mode, persona) {
    const greetings = {
        friendly:
            `Hi! Great to meet you. I am looking forward to our conversation. ` +
            `We will be exploring the ${report.title} role today. ` +
            `Take your time — let us start: can you give me a brief intro ` +
            `about yourself and what drew you to this opportunity?`,
        neutral:
            `Good day. We are conducting a ${mode} interview for the ` +
            `${report.title} position. Please keep answers focused and specific. ` +
            `Let us begin: please give me a brief professional introduction.`,
        tough:
            `Let us get started. ${report.title} role — we have a lot to cover. ` +
            `I expect specific, implementation-level answers, not general overviews. ` +
            `First question: walk me through your background and why you are applying.`
    }
    return greetings[persona]
}

// ── Validation helpers ────────────────────────────────────────────────────────
const VALID_MODES = ["technical", "behavioral", "hr", "mixed"]
const VALID_DIFFICULTIES = ["easy", "medium", "hard"]
const VALID_PERSONAS = ["friendly", "neutral", "tough"]


// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/mock-interview/start
// ═══════════════════════════════════════════════════════════════════════════════
async function startSession(req, res) {
    try {
        const { reportId, mode, difficulty, persona } = req.body

        // Validate required fields
        if (!reportId) return res.status(400).json({ success: false, message: "reportId is required." })
        if (!VALID_MODES.includes(mode)) {
            return res.status(400).json({ success: false, message: `mode must be one of: ${VALID_MODES.join(", ")}` })
        }
        if (!VALID_DIFFICULTIES.includes(difficulty)) {
            return res.status(400).json({ success: false, message: `difficulty must be one of: ${VALID_DIFFICULTIES.join(", ")}` })
        }
        if (!VALID_PERSONAS.includes(persona)) {
            return res.status(400).json({ success: false, message: `persona must be one of: ${VALID_PERSONAS.join(", ")}` })
        }

        // Fetch report and verify ownership
        const report = await InterviewReport.findById(reportId)
        if (!report) return res.status(404).json({ success: false, message: "Report not found." })
        if (report.user.toString() !== req.user.id) {
            return res.status(403).json({ success: false, message: "Access denied." })
        }

        // Build question pool (pure JS)
        const questionPool = buildQuestionPool(report, mode)

        // Opening message — pure JS, zero AI call
        const openingMessage = buildOpeningMessage(report, mode, persona)

        // Create session document
        const session = await MockInterview.create({
            user: req.user.id,
            report: reportId,
            mode,
            difficulty,
            persona,
            messages: [{ role: "interviewer", content: openingMessage }],
            sessionState: {
                totalQuestionsInPool: questionPool.length
            },
            limits: {
                maxFollowUpsPerQuestion: difficulty === "easy" ? 1 : 2
            }
        })

        return res.status(201).json({
            success: true,
            mockInterviewId: session._id,
            message: openingMessage,
            totalQuestions: questionPool.length
        })
    } catch (err) {
        console.error("[startSession]", err)
        return res.status(500).json({ success: false, message: "Failed to start session." })
    }
}


// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/mock-interview/active/:reportId
// ═══════════════════════════════════════════════════════════════════════════════
async function getActiveSession(req, res) {
    try {
        const active = await MockInterview.findOne({
            user: req.user.id,
            report: req.params.reportId,
            status: "in_progress"
        }).sort({ createdAt: -1 })

        if (!active) return res.json({ active: null })

        return res.json({
            active: {
                _id: active._id,
                messages: active.messages,
                sessionState: active.sessionState,
                mode: active.mode,
                difficulty: active.difficulty,
                persona: active.persona,
                limits: active.limits,
                createdAt: active.createdAt
            }
        })
    } catch (err) {
        console.error("[getActiveSession]", err)
        return res.status(500).json({ success: false, message: "Failed to check active session." })
    }
}


// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/mock-interview/:id/respond   (SSE streaming)
// ═══════════════════════════════════════════════════════════════════════════════
async function respondToSession(req, res) {
    const sessionId = req.params.id

    // 1s cooldown per session — prevents rapid double-submits
    const now = Date.now()
    const lastTime = lastRespondTime.get(sessionId) || 0
    if (now - lastTime < 1000) {
        return res.status(429).json({ success: false, message: "Please wait before submitting again." })
    }
    lastRespondTime.set(sessionId, now)

    try {
        // Fetch and verify session
        const session = await MockInterview.findById(sessionId)
        if (!session) return res.status(404).json({ success: false, message: "Session not found." })
        if (session.user.toString() !== req.user.id) {
            return res.status(403).json({ success: false, message: "Access denied." })
        }
        if (session.status !== "in_progress") {
            return res.status(400).json({ success: false, message: "This session is no longer active." })
        }

        // Sanitize answer
        const rawAnswer = (req.body.answer || "").trim()
        if (!rawAnswer) {
            return res.status(400).json({ success: false, message: "Answer cannot be empty." })
        }

        // Word count — computed in JS, never by the LLM
        const words = rawAnswer.split(/\s+/).filter(Boolean)
        const wordCount = words.length
        const isTooLong = wordCount > session.limits.maxAnswerWords
        const isExtremelyLong = wordCount > session.limits.hardCostCapWords

        // Store full answer in transcript; truncate only what goes to AI prompts
        const answerForPrompts = isExtremelyLong
            ? words.slice(0, session.limits.hardCostCapWords).join(" ") + " [truncated for cost control]"
            : rawAnswer

        // Push candidate message
        session.messages.push({ role: "candidate", content: rawAnswer })

        // ── Open SSE connection BEFORE any AI calls ───────────────────────────
        // This prevents the browser from timing out during the classify call.
        // The frontend shows a typing indicator as soon as it receives the first event.
        res.setHeader("Content-Type", "text/event-stream")
        res.setHeader("Cache-Control", "no-cache, no-transform")
        res.setHeader("Connection", "keep-alive")
        res.setHeader("X-Accel-Buffering", "no")           // disable nginx buffering
        res.setHeader("X-Content-Type-Options", "nosniff") // Fix D: Brave SSE compat
        res.flushHeaders()                                  // send headers immediately

        // Send an immediate keepalive so the browser knows the pipe is open
        res.write(`data: ${JSON.stringify({ typing: true })}\n\n`)

        // Rebuild question pool from report + mode
        const report = await InterviewReport.findById(session.report)
        const questionPool = buildQuestionPool(report, session.mode)

        // Find the current question
        const currentQ = questionPool.find(
            q => q.index === session.sessionState.currentQuestionIndex
        )

        // Classify the answer (AI call — happens while frontend shows typing indicator)
        // FIX B: uses classifyAnswerSafe() which times out after 8s instead of hanging
        const classification = await classifyAnswerSafe(
            answerForPrompts,
            currentQ?.question || "opening introduction",
            session.difficulty,
            wordCount,
            isTooLong
        )
        session.sessionState.lastAnswerQuality = classification.quality

        // Decide next step (pure JS — server authoritative)
        const decision = decideNextStep({
            classification,
            sessionState: session.sessionState,
            questionPool,
            limits: session.limits
        })

        // Stream the interviewer response
        const stream = await generateInterviewerMessage({
            conversationHistory: session.messages,
            report,
            mode: session.mode,
            difficulty: session.difficulty,
            persona: session.persona,
            classification,
            decision,
            sessionState: session.sessionState,
            limits: session.limits
        })

        let fullMessage = ""
        for await (const chunk of stream) {
            const text = chunk.text ?? ""
            if (text) {
                fullMessage += text
                res.write(`data: ${JSON.stringify({ token: text })}\n\n`)
            }
        }

        // Update session state from decision (server-authoritative)
        session.messages.push({ role: "interviewer", content: fullMessage })

        if (decision.action === "advance") {
            session.sessionState.askedQuestionIndices.push(decision.nextQuestion.index)
            session.sessionState.currentQuestionIndex = decision.nextQuestion.index
        } else if (decision.action === "follow_up") {
            const key = String(session.sessionState.currentQuestionIndex)
            session.sessionState.followUpCountPerQuestion[key] =
                (session.sessionState.followUpCountPerQuestion[key] || 0) + 1
            session.markModified("sessionState.followUpCountPerQuestion")
        }

        // If closing — generate feedback
        if (decision.action === "close") {
            const feedback = await generateMockInterviewFeedback({
                conversationHistory: session.messages,
                report,
                mode: session.mode,
                sessionState: session.sessionState
            })

            // Compare with previous completed session
            const previous = await MockInterview.findOne({
                user: req.user.id,
                report: session.report,
                status: "completed",
                _id: { $ne: session._id }
            }).sort({ completedAt: -1 })

            if (previous?.feedback?.overallScore != null) {
                const delta = feedback.overallScore - previous.feedback.overallScore
                feedback.comparedToPrevious = {
                    previousScore: previous.feedback.overallScore,
                    scoreDelta: delta,
                    trend: delta > 5 ? "improved" : delta < -5 ? "declined" : "similar"
                }
            }

            session.feedback = feedback
            session.status = "completed"
            session.completedAt = new Date()

            res.write(`data: ${JSON.stringify({ complete: true, feedback: session.feedback })}\n\n`)
        }

        await session.save()
        lastRespondTime.delete(sessionId)
        res.end()

    } catch (err) {
        console.error("[respondToSession]", err)
        lastRespondTime.delete(sessionId)
        // Only send JSON error if headers not yet sent
        if (!res.headersSent) {
            return res.status(500).json({ success: false, message: "Failed to process answer." })
        }
        try {
            res.write(`data: ${JSON.stringify({ error: "stream_error" })}\n\n`)
            res.end()
        } catch {}
    }
}


// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/mock-interview/:id
// ═══════════════════════════════════════════════════════════════════════════════
async function getSession(req, res) {
    try {
        const session = await MockInterview.findById(req.params.id)
        if (!session) return res.status(404).json({ success: false, message: "Session not found." })
        if (session.user.toString() !== req.user.id) {
            return res.status(403).json({ success: false, message: "Access denied." })
        }
        return res.json({ success: true, session })
    } catch (err) {
        console.error("[getSession]", err)
        return res.status(500).json({ success: false, message: "Failed to get session." })
    }
}


// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/mock-interview/report/:reportId
// ═══════════════════════════════════════════════════════════════════════════════
async function getSessionsByReport(req, res) {
    try {
        const sessions = await MockInterview.find({
            user: req.user.id,
            report: req.params.reportId
        })
            .sort({ createdAt: -1 })
            .select("_id mode difficulty persona status createdAt completedAt feedback.overallScore sessionState.askedQuestionIndices")

        return res.json({ success: true, sessions })
    } catch (err) {
        console.error("[getSessionsByReport]", err)
        return res.status(500).json({ success: false, message: "Failed to get sessions." })
    }
}


// ═══════════════════════════════════════════════════════════════════════════════
// PATCH /api/mock-interview/:id/abandon
// ═══════════════════════════════════════════════════════════════════════════════
async function abandonSession(req, res) {
    try {
        const session = await MockInterview.findById(req.params.id)
        if (!session) return res.status(404).json({ success: false, message: "Session not found." })
        if (session.user.toString() !== req.user.id) {
            return res.status(403).json({ success: false, message: "Access denied." })
        }
        if (session.status !== "in_progress") {
            return res.status(400).json({ success: false, message: "Session is not in progress." })
        }

        const askedCount = session.sessionState.askedQuestionIndices.length

        if (askedCount >= 3) {
            const report = await InterviewReport.findById(session.report)
            const feedback = await generateMockInterviewFeedback({
                conversationHistory: session.messages,
                report,
                mode: session.mode,
                sessionState: session.sessionState
            })
            feedback.summary =
                `Session ended early at question ${askedCount} of ` +
                `${session.sessionState.totalQuestionsInPool}. ` + feedback.summary

            session.feedback = feedback
            session.status = "abandoned"
            session.abandonedAt = new Date()
            await session.save()
            return res.json({ success: true, partialFeedback: feedback })
        } else {
            session.status = "abandoned"
            session.abandonedAt = new Date()
            await session.save()
            return res.json({ success: true, partialFeedback: null, reason: "too_few_answers" })
        }
    } catch (err) {
        console.error("[abandonSession]", err)
        return res.status(500).json({ success: false, message: "Failed to abandon session." })
    }
}


module.exports = {
    startSession,
    getActiveSession,
    respondToSession,
    getSession,
    getSessionsByReport,
    abandonSession
}
