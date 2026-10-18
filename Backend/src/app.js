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
// crossOriginResourcePolicy disabled so our React SPA (different domain) can read responses
app.use(helmet({
    crossOriginResourcePolicy: false
}))


// ── 2. HTTP Request Logger (morgan) ─────────────────────────────────────────
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"))


// ── 3. Body Parsers ──────────────────────────────────────────────────────────
// cookieParser MUST be before auth routes so req.cookies is populated
app.use(express.json())
app.use(cookieParser())


// ── 4. CORS ──────────────────────────────────────────────────────────────────
const allowedOrigins = [
    process.env.FRONTEND_URL,
    "https://ace-prep-ai-ai-powered-interview-pr.vercel.app",
    "http://localhost:5173",
    "http://localhost:5174"
].filter(Boolean)

console.log("Allowed CORS origins:", allowedOrigins)

app.use(cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true)

        // Allow any Vercel preview deployment for this project
        const isVercelPreview =
            origin.includes("ace-prep-ai-ai-powered") &&
            origin.endsWith(".vercel.app")

        if (allowedOrigins.includes(origin) || isVercelPreview) {
            return callback(null, true)
        }

        return callback(new Error("Not allowed by CORS"))
    },
    credentials: true
}))


// ── 5. Health Check ──────────────────────────────────────────────────────────
// /health — keep-alive ping from frontend (FIX 5)
app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok", timestamp: new Date() })
})

// /api/health — monitoring tools
app.get("/api/health", (req, res) => {
    res.status(200).json({
        status: "ok",
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    })
})


// ── 6. General API Rate Limiter ──────────────────────────────────────────────
// Covers ALL /api/* routes — 100 requests per 15 minutes per IP
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
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
