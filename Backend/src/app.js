const express = require("express")
const cookieParser = require("cookie-parser")
const cors = require("cors")
const helmet = require("helmet")
const morgan = require("morgan")
const { rateLimit } = require("express-rate-limit")

const app = express()


// ── 1. Security Headers (helmet) ─────────────────────────────────────────────
// Sets secure HTTP headers (X-Frame-Options, X-Content-Type-Options, etc.)
// crossOriginResourcePolicy disabled so our React SPA (different port) can read responses
app.use(helmet({
    crossOriginResourcePolicy: false
}))


// ── 2. HTTP Request Logger (morgan) ──────────────────────────────────────────
// 'dev' = colorised one-liner per request in development
// 'combined' = Apache-style full log in production
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"))


// ── 3. Body Parsers ───────────────────────────────────────────────────────────
app.use(express.json())
app.use(cookieParser())



// ── 4. CORS ──────────────────────────────────────────────────────────────────
const allowedOrigins = [
    process.env.FRONTEND_URL,
    "http://localhost:5173",
    "http://localhost:5174"
].filter(Boolean)

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests without an Origin header (e.g. server-to-server)
        if (!origin || allowedOrigins.includes(origin)) {
            return callback(null, true)
        }

        return callback(new Error("Not allowed by CORS"))
    },
    credentials: true
}))



// ── 5. General API Rate Limiter ───────────────────────────────────────────────
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


// ── 6. Routes ─────────────────────────────────────────────────────────────────
const authRouter = require("./routes/auth.routes")
const interviewRouter = require("./routes/interview.routes")
const mockInterviewRouter = require("./routes/mockInterview.routes")

app.use("/api/auth", authRouter)
app.use("/api/interview", interviewRouter)
app.use("/api/mock-interview", mockInterviewRouter)


// ── 7. Global Error Handler ───────────────────────────────────────────────────
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