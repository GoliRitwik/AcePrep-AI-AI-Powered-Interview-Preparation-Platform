const express = require("express")
const authMiddleware = require("../middlewares/auth.middleware")
const interviewController = require("../controllers/interview.controller")
const upload = require("../middlewares/file.middleware")

const interviewRouter = express.Router()



/**
 * @route POST /api/interview/
 * @description generate new interview report on the basis of user self description,resume pdf and job description.
 * @access private
 */
interviewRouter.post("/", authMiddleware.authUser, upload.single("resume"), interviewController.generateInterViewReportController)

/**
 * @route GET /api/interview/report/:interviewId
 * @description get interview report by interviewId.
 * @access private
 */
interviewRouter.get("/report/:interviewId", authMiddleware.authUser, interviewController.getInterviewReportByIdController)


/**
 * @route GET /api/interview/
 * @description get all interview reports of logged in user.
 * @access private
 */
interviewRouter.get("/", authMiddleware.authUser, interviewController.getAllInterviewReportsController)


/**
 * @route POST /api/interview/resume/options/:reportId
 * @description Generate two summary options + validate skill evidence (Resume Builder step 2).
 * @access private
 */
interviewRouter.post("/resume/options/:reportId", authMiddleware.authUser, interviewController.getResumeOptionsController)


/**
 * @route POST /api/interview/resume/pdf
 * @description generate resume pdf on the basis of user self description, resume content and job description.
 * @access private
 */
interviewRouter.post("/resume/pdf/:interviewReportId", authMiddleware.authUser, interviewController.generateResumePdfController)


/**
 * @route POST /api/interview/resume/generate/:reportId
 * @description Generate tailored resume HTML + ATS scoring. No PDF.
 * @access private
 */
interviewRouter.post("/resume/generate/:reportId", authMiddleware.authUser, interviewController.generateTailoredResumeController)

/**
 * @route GET /api/interview/resume/pdf/:reportId
 * @description Download the saved tailored resume as PDF. No AI call.
 * @access private
 */
interviewRouter.get("/resume/pdf/:reportId", authMiddleware.authUser, interviewController.downloadTailoredResumePdfController)


/**
 * @route GET /api/interview/share/:shareId   ← PUBLIC, no auth
 * @description Get a publicly shared report (safe fields only). Must be defined
 *              before /:id routes to prevent "share" being matched as an id.
 * @access public
 */
interviewRouter.get("/share/:shareId", interviewController.getSharedReportController)


/**
 * @route POST /api/interview/:id/share
 * @description Generate (or re-enable) a public share link.
 * @access private
 */
interviewRouter.post("/:id/share", authMiddleware.authUser, interviewController.shareReportController)


/**
 * @route PATCH /api/interview/:id/share
 * @description Toggle isShared on/off (does NOT delete shareId).
 * @access private
 */
interviewRouter.patch("/:id/share", authMiddleware.authUser, interviewController.toggleShareController)


/**
 * @route DELETE /api/interview/:id
 * @description delete an interview plan by id. Only the owner can delete.
 * @access private
 */
interviewRouter.delete("/:id", authMiddleware.authUser, interviewController.deletePlanController)



module.exports = interviewRouter