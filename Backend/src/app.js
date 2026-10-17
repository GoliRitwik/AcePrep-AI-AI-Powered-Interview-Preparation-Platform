const express = require("express")
const cookieParser = require("cookie-parser")
const cors = require("cors")
const helmet = require("helmet")
const morgan = require("morgan")
const { rateLimit } = require("express-rate-limit")

const app = express()

// Trust reverse proxy (Render / Cloudflare / Heroku load balancers)
// Required for accurate client IP, secure cookies, and rate-limiting
app.set("trust proxy", 1)


// ── 1. Security Headers (helmet) ──────────────────────────────────────────
// Sets secure HTTP headers (X-Frame-Options, X-Content-Type-Options, etc.)
// crossOriginResourcePolicy disabled so our React SPA (different port/domain) can read responses
app.use(helmet({
    crossOriginResourcePolicy: false
}))


// ── 2. HTTP Request Logger (morgan) ─────────────────────────────────────────
// 'dev' = colorised one-liner per request in development
// 'combined' = Apache-style full log in production
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"))


// ── 3. Body Parsers ──────────────────────────────────────────────────────────
app.use(express.json())
app.use(cookieParser())


// ── 4. CORS ──────────────────────────────────────────────────────────────────
const defaultOrigins = [
    "https://ace-prep-ai-ai-powered-interview-pr.vercel.app",
    "http://localhost:5173",
    "http://localhost:5174"
]

const envOrigins = (process.env.FRONTEND_URL || "")
    .split(",")
    .map(o => o.trim().replace(/\/$/, ""))
    .filter(Boolean)

const allowedOrigins = Array.from(new Set([...defaultOrigins, ...envOrigins]))

console.log("Allowed CORS origins:", allowedOrigins)

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests without an Origin header (e.g. server-to-server, curl, health checks)
        if (!origin) {
            return callback(null, true)
        }

        const normalized = origin.replace(/\/$/, "")
        if (allowedOrigins.includes(normalized) || normalized.endsWith(".vercel.app")) {
            return callback(null, true)
        }

        return callback(new Error(`Not allowed by CORS: ${origin}`))
    },
    credentials: true
}))


// ── 5. Health Check Endpoint (Lightweight & Unauthenticated) ────────────────
// Fast liveness probe for monitoring tools and cold-start keep-alive
app.get("/api/health", (req, res) => {
    res.status(200).json({
        status: "ok",
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    })
})


// ── 6. General API Rate Limiter ──────────────────────────────────────────────
// Covers ALL /api/* routes — 100 requests per 15 minutes per IP
// Prevents general API abuse. Auth routes have a stricter additional limiter (in auth.routes.js)
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,   // 15 minute window
    max: 100,                    // max 100 requests per window
    standardHeaders: true,       // send RateLimit-* response headers (RFC standard)
    legacyHeaders: false,        // disable old X-RateLimit-* headers
    handler: (req, res) => {
        res.status(429).json({
            success: false,
            message: "Too many requests from this IP. Please try again after 15 minutes."
        })
    }
})
app.use("/api", apiLimiter)


// ── 7. Routes ────────────────────────────────────────────────────────────────
const authRouter = require("./routes/auth.routes")
const interviewRouter = require("./routes/interview.routes")
const mockInterviewRouter = require("./routes/mockInterview.routes")

app.use("/api/auth", authRouter)
app.use("/api/interview", interviewRouter)
app.use("/api/mock-interview", mockInterviewRouter)


// ── 8. Global Error Handler ──────────────────────────────────────────────────
// Must be LAST — catches all errors passed via next(err) from controllers/middleware
app.use((err, req, res, next) => {
    console.error(err.stack)
    const status = err.status || err.statusCode || 500
    res.status(status).json({
        success: false,
        message: err.message || "Something went wrong. Please try again."
    })
})


module.exports = app
