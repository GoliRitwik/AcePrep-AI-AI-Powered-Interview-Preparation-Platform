// ── Voice Engine ───────────────────────────────────────────────────────────────
// All browser voice API logic lives here. Keep this out of React components.
// Backend has zero knowledge of voice — it streams text. Frontend decides
// whether to also speak it. No voice fields in any API schema.
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Speak a text string using the Web Speech API (TTS).
 * @param {string} text - Text to speak
 * @param {SpeechSynthesisVoice|null} voice - Voice to use (null = browser default)
 * @param {Function} onStart - Called when speech starts
 * @param {Function} onEnd - Called when speech ends (or is cancelled normally)
 * @param {Function} onError - Called on real errors (not "interrupted")
 * @returns {Function} cancel — call to stop speaking immediately
 */
export function speakText(text, voice, onStart, onEnd, onError) {
    window.speechSynthesis.cancel()

    // Clean text for speech — characters that sound wrong aloud
    const cleaned = text
        .replace(/\[.*?\]/g, "")
        .replace(/\*\*/g, "")
        .replace(/`/g, "")
        .replace(/─+/g, "")
        .replace(/[{}"]/g, "")
        .replace(/\s{2,}/g, " ")
        .trim()

    if (!cleaned) { onEnd?.(); return () => {} }

    const utterance = new SpeechSynthesisUtterance(cleaned)
    if (voice) utterance.voice = voice
    utterance.rate = 0.92
    utterance.pitch = 1.0
    utterance.volume = 1.0

    // Chrome bug: speechSynthesis pauses silently after ~15 seconds.
    // Fix: ping it every 10 seconds to keep it alive.
    let keepAlive
    utterance.onstart = () => {
        keepAlive = setInterval(() => {
            if (window.speechSynthesis.speaking) {
                window.speechSynthesis.pause()
                window.speechSynthesis.resume()
            } else {
                clearInterval(keepAlive)
            }
        }, 10000)
        onStart?.()
    }

    utterance.onend = () => {
        clearInterval(keepAlive)
        onEnd?.()
    }

    utterance.onerror = (e) => {
        clearInterval(keepAlive)
        // "interrupted" fires when cancel() is called — not a real error
        if (e.error !== "interrupted") onError?.(e)
        else onEnd?.()
    }

    window.speechSynthesis.speak(utterance)
    return () => {
        clearInterval(keepAlive)
        window.speechSynthesis.cancel()
    }
}

/** Stop all TTS immediately. */
export function stopSpeaking() {
    window.speechSynthesis.cancel()
}

/** Returns true if TTS is currently playing. */
export function isSpeaking() {
    return window.speechSynthesis.speaking
}

// ── Recognition engine constants ──────────────────────────────────────────────
const WATCHDOG_INTERVAL_MS        = 2000    // how often watchdog polls
const WATCHDOG_SILENCE_THRESHOLD_MS = 12000 // no activity for 12s = assume dead
const MAX_RESTARTS_PER_WINDOW     = 4       // circuit breaker: max restarts in 30s
const RESTART_WINDOW_MS           = 30000   // rolling window for restart count
const MIN_RESTART_INTERVAL_MS     = 400     // prevents restart storm on rapid failures
const PROACTIVE_ROTATION_MS       = 45000   // restart before Chrome's ~60s server timeout
const LOW_CONFIDENCE_THRESHOLD    = 0.55    // flag transcripts below this confidence

/**
 * Create a speech recognition controller with full reliability features:
 * - Watchdog: detects silent deaths (no onend/onerror ever fires)
 * - Proactive rotation: prevents Chrome's ~60s server timeout
 * - Circuit breaker: caps restarts at 4 per 30s to avoid infinite loops
 * - Confidence scoring: flags low-confidence transcripts for the UI
 *
 * @param {Function} onTranscript    (text: string, isLowConfidence: boolean) => void
 * @param {Function} onInterim       (text: string) => void
 * @param {Function} onError         ({ error: string, message: string }) => void
 * @param {Function} [onStatusChange] (status: string) => void — optional
 * @returns {{ start, stop, abort, getStatus }|null}
 */
export function createSpeechRecognizer(onTranscript, onInterim, onError, onStatusChange) {
    const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition

    if (!SpeechRecognition) {
        onError?.({ error: "not-supported", message: "SpeechRecognition is not supported in this browser." })
        return null
    }

    // ── Engine-internal mutable state (NOT React state) ───────────────────────
    let recognition              = null
    let shouldBeRunning          = false
    let lastActivityAt           = Date.now()
    let restartTimestamps        = []
    let watchdogInterval         = null
    let proactiveRotationTimeout = null
    let lastStartAttempt         = 0
    let isRestarting             = false

    // ── Helpers ───────────────────────────────────────────────────────────────

    function recordActivity() {
        lastActivityAt = Date.now()
    }

    function canRestart() {
        const now = Date.now()
        // Prune timestamps outside the rolling window
        restartTimestamps = restartTimestamps.filter(t => now - t < RESTART_WINDOW_MS)
        return (
            restartTimestamps.length < MAX_RESTARTS_PER_WINDOW &&
            now - lastStartAttempt >= MIN_RESTART_INTERVAL_MS
        )
    }

    function attemptRestart(reason) {
        if (!shouldBeRunning || isRestarting) return

        if (!canRestart()) {
            onStatusChange?.("degraded")
            onError?.({
                error: "restart-limit-exceeded",
                message:
                    "Voice recognition has become unstable (" + reason + "). " +
                    "Switch to text mode to continue your answer."
            })
            return
        }

        isRestarting = true
        restartTimestamps.push(Date.now())
        lastStartAttempt = Date.now()

        // Brief pause before restart prevents rapid-fire restart storms
        setTimeout(() => {
            isRestarting = false
            if (!shouldBeRunning) return
            try {
                recognition.start()
                recordActivity()
                onStatusChange?.("recovering")
            } catch (e) {
                const msg = String(e.message || e)
                // "already started" / "already running" is the one benign case
                if (!msg.includes("already started") && !msg.includes("already running")) {
                    onError?.({ error: "restart-failed", message: "Could not restart voice recognition: " + msg })
                }
            }
        }, MIN_RESTART_INTERVAL_MS)
    }

    // ── Build a fresh SpeechRecognition instance ──────────────────────────────
    // Called on first start AND when the watchdog rebuilds after a silent death.

    function buildInstance() {
        const r = new SpeechRecognition()
        r.continuous      = true
        r.interimResults  = true
        r.lang            = "en-US"
        r.maxAlternatives = 1

        r.onresult = (event) => {
            recordActivity()
            let interim        = ""
            let finalText      = ""
            let isLowConfidence = false

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const result = event.results[i]
                const alt    = result[0]
                if (result.isFinal) {
                    finalText += alt.transcript + " "
                    // Confidence is only available on final results in Chrome
                    if (
                        typeof alt.confidence === "number" &&
                        alt.confidence > 0 &&
                        alt.confidence < LOW_CONFIDENCE_THRESHOLD
                    ) {
                        isLowConfidence = true
                    }
                } else {
                    interim += alt.transcript
                }
            }

            if (finalText) onTranscript?.(finalText.trim(), isLowConfidence)
            if (interim)   onInterim?.(interim)
        }

        // Any browser activity event resets the watchdog clock
        r.onspeechstart = recordActivity
        r.onaudiostart  = recordActivity
        r.onsoundstart  = recordActivity

        r.onerror = (event) => {
            recordActivity() // error is activity — don't double-trigger watchdog
            if (event.error === "no-speech") return  // normal pause, not a failure
            if (event.error === "aborted")   return  // deliberate stop(), not an error

            const errorMessages = {
                network:
                    "Connection to speech servers was interrupted. " +
                    "This can happen on slow or unstable Wi-Fi.",
                "audio-capture":
                    "Microphone stopped providing audio. " +
                    "Check it is still connected and not in use by another app.",
                "not-allowed":
                    "Microphone access was blocked. " +
                    "Check your browser permissions for this site.",
                "service-not-allowed":
                    "Speech recognition was blocked by the browser. " +
                    "This sometimes happens in private/incognito mode."
            }

            onError?.({
                error: event.error,
                message: errorMessages[event.error] || "Speech recognition error: " + event.error
            })

            if (shouldBeRunning) attemptRestart(event.error)
        }

        r.onend = () => {
            // onend fires after stop(), abort(), or any unexpected termination.
            // Only restart when we should still be running.
            if (shouldBeRunning) attemptRestart("session ended")
        }

        return r
    }

    // ── Watchdog ─────────────────────────────────────────────────────────────
    // Catches the worst-case: recognition dies silently with NO onend/onerror.
    // This is common when the tab loses focus briefly or on network blips.

    function startWatchdog() {
        stopWatchdog()
        watchdogInterval = setInterval(() => {
            if (!shouldBeRunning) return
            const silentMs = Date.now() - lastActivityAt
            if (silentMs > WATCHDOG_SILENCE_THRESHOLD_MS) {
                onStatusChange?.("watchdog-restart")
                console.warn(
                    "[voiceEngine] No recognition activity for " +
                    Math.round(silentMs / 1000) + "s — rebuilding instance"
                )
                // The existing instance may be in an unrecoverable zombie state.
                // Build a fresh one and restart.
                try { recognition.abort() } catch (_) { /* best effort */ }
                recognition     = buildInstance()
                lastActivityAt  = Date.now()
                isRestarting    = false
                attemptRestart("watchdog timeout")
            }
        }, WATCHDOG_INTERVAL_MS)
    }

    function stopWatchdog() {
        if (watchdogInterval) clearInterval(watchdogInterval)
        watchdogInterval = null
    }

    // ── Proactive rotation ────────────────────────────────────────────────────
    // Chrome kills recognition server-side at ~60 seconds. Restarting at 45s
    // prevents this from ever surfacing as a visible glitch to the user.

    function scheduleProactiveRotation() {
        clearProactiveRotation()
        proactiveRotationTimeout = setTimeout(() => {
            if (!shouldBeRunning) return
            console.log("[voiceEngine] Proactive rotation — preventing Chrome 60s timeout")
            onStatusChange?.("rotating")
            try { recognition.stop() } catch (_) { /* best effort */ }
            // onend fires → attemptRestart → recognition.start() → scheduleProactiveRotation again
        }, PROACTIVE_ROTATION_MS)
    }

    function clearProactiveRotation() {
        if (proactiveRotationTimeout) clearTimeout(proactiveRotationTimeout)
        proactiveRotationTimeout = null
    }

    // ── Build initial instance ────────────────────────────────────────────────
    recognition = buildInstance()

    // ── Public API ────────────────────────────────────────────────────────────
    return {
        start() {
            shouldBeRunning   = true
            lastActivityAt    = Date.now()
            restartTimestamps = []
            isRestarting      = false
            try { recognition.start() } catch (_) { /* already running */ }
            startWatchdog()
            scheduleProactiveRotation()
            onStatusChange?.("listening")
        },

        stop() {
            shouldBeRunning = false
            stopWatchdog()
            clearProactiveRotation()
            try { recognition.stop() } catch (_) { /* already stopped */ }
            onStatusChange?.("stopped")
        },

        abort() {
            shouldBeRunning = false
            stopWatchdog()
            clearProactiveRotation()
            try { recognition.abort() } catch (_) { /* already stopped */ }
            onStatusChange?.("stopped")
        },

        // Expose internal state for debugging
        getStatus() {
            return {
                shouldBeRunning,
                lastActivityAgoMs: Date.now() - lastActivityAt,
                restartCount: restartTimestamps.length,
                isRestarting
            }
        }
    }
}

/**
 * Returns all English-language voices available in the browser.
 * Handles the async loading that Chrome requires.
 */
export async function getAvailableVoices() {
    return new Promise((resolve) => {
        const voices = window.speechSynthesis.getVoices()
        if (voices.length > 0) {
            resolve(voices.filter(v => v.lang.startsWith("en")))
        } else {
            window.speechSynthesis.onvoiceschanged = () => {
                resolve(
                    window.speechSynthesis.getVoices()
                        .filter(v => v.lang.startsWith("en"))
                )
            }
        }
    })
}

/** True if both TTS and microphone recognition are available. */
export function isVoiceSupported() {
    return (
        ("SpeechRecognition" in window || "webkitSpeechRecognition" in window) &&
        "speechSynthesis" in window
    )
}

/**
 * True on Firefox: TTS works but SpeechRecognition is blocked.
 * Users can still hear questions but must type their answers.
 */
export function isTTSOnly() {
    return (
        "speechSynthesis" in window &&
        !("SpeechRecognition" in window) &&
        !("webkitSpeechRecognition" in window)
    )
}
