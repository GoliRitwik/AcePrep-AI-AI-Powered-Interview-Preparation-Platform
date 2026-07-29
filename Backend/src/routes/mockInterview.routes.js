const express = require("express")
const authMiddleware = require("../middlewares/auth.middleware")
const mockInterviewController = require("../controllers/mockInterview.controller")

const mockInterviewRouter = express.Router()

// All routes require authentication
// IMPORTANT: static path segments must come before parameterized ones
// to prevent "active" or "report" being matched as :id

/**
 * @route POST /api/mock-interview/start
 * @description Start a new mock interview session
 * @access private
 */
mockInterviewRouter.post("/start", authMiddleware.authUser, mockInterviewController.startSession)

/**
 * @route GET /api/mock-interview/active/:reportId
 * @description Check for an in-progress session on a given report
 * @access private
 */
mockInterviewRouter.get("/active/:reportId", authMiddleware.authUser, mockInterviewController.getActiveSession)

/**
 * @route GET /api/mock-interview/report/:reportId
 * @description Get all sessions for this report (summary only, sorted desc)
 * @access private
 */
mockInterviewRouter.get("/report/:reportId", authMiddleware.authUser, mockInterviewController.getSessionsByReport)

/**
 * @route POST /api/mock-interview/:id/respond
 * @description Submit a candidate answer — SSE streaming response
 * @access private
 */
mockInterviewRouter.post("/:id/respond", authMiddleware.authUser, mockInterviewController.respondToSession)

/**
 * @route PATCH /api/mock-interview/:id/abandon
 * @description End session early; generates partial feedback if >= 3 questions answered
 * @access private
 */
mockInterviewRouter.patch("/:id/abandon", authMiddleware.authUser, mockInterviewController.abandonSession)

/**
 * @route GET /api/mock-interview/:id
 * @description Get full session document
 * @access private
 */
mockInterviewRouter.get("/:id", authMiddleware.authUser, mockInterviewController.getSession)

module.exports = mockInterviewRouter
