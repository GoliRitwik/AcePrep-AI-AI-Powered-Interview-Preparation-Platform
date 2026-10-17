import axios from "axios";

// Authenticated API — sends cookies automatically
const API_BASE_URL =
    import.meta.env.VITE_API_URL || "https://aceprep-backend-elm2.onrender.com"

const api = axios.create({
    baseURL: API_BASE_URL,
    withCredentials: true,
})

// Public API — never attaches auth cookies (used for shared report lookups)
const publicApi = axios.create({
    baseURL: API_BASE_URL,
    withCredentials: false,
})


/**
 * @description Service to generate interview report based on user self description, resume and job description.
 * @param {AbortSignal} [signal] - Optional AbortSignal to cancel the request mid-flight
 */
export const generateInterviewReport = async ({ jobDescription, selfDescription, resumeFile, signal }) => {

    const formData = new FormData()
    formData.append("jobDescription", jobDescription)
    formData.append("selfDescription", selfDescription)
    formData.append("resume", resumeFile)

    const response = await api.post("/api/interview/", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        signal   // AbortController.signal — axios will throw CanceledError if aborted
    })

    return response.data

}


/**
 * @description Service to get interview report by interviewId.
 */
export const getInterviewReportById = async (interviewId) => {
    const response = await api.get(`/api/interview/report/${interviewId}`)

    return response.data
}


/**
 * @description Service to get all interview reports of logged in user.
 */
export const getAllInterviewReports = async () => {
    const response = await api.get("/api/interview/")

    return response.data
}


/**
 * @description Generate summary options + validate skill evidence (Resume Builder step 2).
 * @param {string} reportId
 * @param {string[]} confirmedSkills - Skills the user confirmed they know
 */
export const getResumeOptions = async (reportId, confirmedSkills = []) => {
    const response = await api.post(`/api/interview/resume/options/${reportId}`, {
        confirmedSkills
    })
    return response.data
}


/**
 * @description Service to generate resume pdf.
 *              Accepts optional resume-builder params (confirmedSkills, chosenSummary, etc.)
 *              Falls back to original single-AI-call behaviour when params are omitted.
 */
export const generateResumePdf = async ({ interviewReportId, confirmedSkills = [], chosenSummary = null, skillsWithEvidence = [], irrelevantSkillsToDeprioritize = [] }) => {
    const response = await api.post(
        `/api/interview/resume/pdf/${interviewReportId}`,
        { confirmedSkills, chosenSummary, skillsWithEvidence, irrelevantSkillsToDeprioritize },
        { responseType: "blob" }
    )
    return response.data
}


/**
 * @description Service to delete an interview plan by id.
 */
export const deleteInterviewPlan = async (id) => {
    const response = await api.delete(`/api/interview/${id}`)
    return response.data
}


/**
 * @description Generate (or re-enable) a public share link for a plan.
 *              Returns { shareId, shareUrl, isShared }
 */
export const shareReport = async (id) => {
    const response = await api.post(`/api/interview/${id}/share`)
    return response.data
}


/**
 * @description Toggle public sharing on/off without destroying the shareId.
 */
export const toggleShare = async (id, isShared) => {
    const response = await api.patch(`/api/interview/${id}/share`, { isShared })
    return response.data
}


/**
 * @description Fetch a publicly shared report (no auth cookies).
 *              Used by the /share/:shareId public route.
 */
export const getSharedReport = async (shareId) => {
    const response = await publicApi.get(`/api/interview/share/${shareId}`)
    return response.data
}


// ═══════════════════════════════════════════════════════════════════════════════
// MOCK INTERVIEW APIs
// ═══════════════════════════════════════════════════════════════════════════════

/** Start a new mock interview session. */
export const startMockInterview = async ({ reportId, mode, difficulty, persona }) => {
    const response = await api.post("/api/mock-interview/start", {
        reportId, mode, difficulty, persona
    })
    return response.data
}

/** Check for an in-progress session on a given report. */
export const getActiveMockSession = async (reportId) => {
    const response = await api.get(`/api/mock-interview/active/${reportId}`)
    return response.data
}

/** Get all sessions for a report (summary, sorted desc). */
export const getMockSessionsByReport = async (reportId) => {
    const response = await api.get(`/api/mock-interview/report/${reportId}`)
    return response.data
}

/** Get a full session document. */
export const getMockSession = async (id) => {
    const response = await api.get(`/api/mock-interview/${id}`)
    return response.data
}

/** Abandon a session, optionally receiving partial feedback. */
export const abandonMockSession = async (id) => {
    const response = await api.patch(`/api/mock-interview/${id}/abandon`)
    return response.data
}

/**
 * Submit a candidate answer and stream the interviewer response via SSE.
 * Uses fetch (not axios) because axios does not support streaming reads.
 *
 * Fix C: wraps the stream in a 20-second timeout. If no token arrives in
 * that window, onError("response_timeout") is called so the frontend recovers.
 *
 * @param {string} id - Session ID
 * @param {string} answer - Candidate's answer text
 * @param {Function} onToken - Called per SSE token chunk: onToken(text)
 * @param {Function} onComplete - Called when stream ends: onComplete(feedback|null)
 * @param {Function} onError - Called on error: onError(reason)
 */
export const sendMockInterviewAnswer = async (id, answer, onToken, onComplete, onError) => {
    const RESPONSE_TIMEOUT_MS = 20000   // 20s — if no token arrives, abort
    let timeoutId = null
    let firstTokenReceived = false
    let receivedComplete = false        // guard: don't call onComplete twice

    const clearResponseTimeout = () => {
        if (timeoutId !== null) { clearTimeout(timeoutId); timeoutId = null }
    }

    // Start the timeout clock BEFORE the fetch — classify call included
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
            if (!firstTokenReceived) reject(new Error("response_timeout"))
        }, RESPONSE_TIMEOUT_MS)
    })

    const streamPromise = (async () => {
        let response
        try {
            response = await fetch(`${API_BASE_URL}/api/mock-interview/${id}/respond`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ answer }),
                credentials: "include"
            })
        } catch {
            throw new Error("network_error")
        }

        if (!response.ok) {
            throw new Error(response.status === 429 ? "rate_limited" : "server_error")
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder("utf-8")
        let buffer = ""

        while (true) {
            const { done, value } = await reader.read()
            if (done) break
            // stream: true handles multi-byte chars split across chunks
            buffer += decoder.decode(value, { stream: true })

            // SSE events are delimited by double newlines
            const events = buffer.split("\n\n")
            // Last element may be an incomplete event — keep for next read
            buffer = events.pop()

            for (const evt of events) {
                const line = evt.split("\n").find(l => l.startsWith("data: "))
                if (!line) continue
                try {
                    const data = JSON.parse(line.slice(6))
                    // typing: true — server is alive during classify, nothing to render
                    if (data.typing) continue
                    if (data.token) {
                        if (!firstTokenReceived) {
                            firstTokenReceived = true
                            clearResponseTimeout()  // cancel timeout once streaming starts
                        }
                        onToken(data.token)
                    }
                    if (data.complete && !receivedComplete) {
                        receivedComplete = true
                        onComplete(data.feedback)
                    }
                    if (data.error) throw new Error(data.error)
                } catch (parseErr) {
                    // Malformed SSE JSON — safe to skip individual events
                    if (parseErr.message !== "Unexpected token") throw parseErr
                }
            }
        }
        // Stream ended without a complete event (edge case — server closed pipe early)
        if (!receivedComplete) onComplete?.(null)
    })()

    try {
        await Promise.race([streamPromise, timeoutPromise])
    } catch (err) {
        clearResponseTimeout()
        onError?.(err.message || "unknown_error")
    }
}