const pdfParse = require("pdf-parse")
const { generateInterviewReport, generateResumePdf, generateSummaryOptions } = require("../services/ai.service")
const interviewReportModel = require("../models/interviewReport.model")
const { nanoid } = require("nanoid")




/**
 * @description Controller to generate interview report based on user self description, resume and job description.
 */
async function generateInterViewReportController(req, res) {

    const resumeContent = await (new pdfParse.PDFParse(Uint8Array.from(req.file.buffer))).getText()
    const { selfDescription, jobDescription } = req.body

    const interViewReportByAi = await generateInterviewReport({
        resume: resumeContent.text,
        selfDescription,
        jobDescription
    })

    const interviewReport = await interviewReportModel.create({
        user: req.user.id,
        resume: resumeContent.text,
        selfDescription,
        jobDescription,
        ...interViewReportByAi
    })

    res.status(201).json({
        success: true,
        message: "Interview report generated successfully.",
        interviewReport
    })

}

/**
 * @description Controller to get interview report by interviewId.
 */
async function getInterviewReportByIdController(req, res) {

    const { interviewId } = req.params

    const interviewReport = await interviewReportModel.findOne({ _id: interviewId, user: req.user.id })

    if (!interviewReport) {
        return res.status(404).json({
            success: false,
            message: "Interview report not found."
        })
    }

    res.status(200).json({
        success: true,
        message: "Interview report fetched successfully.",
        interviewReport
    })
}


/** 
 * @description Controller to get all interview reports of logged in user.
 */
async function getAllInterviewReportsController(req, res) {
    const interviewReports = await interviewReportModel.find({ user: req.user.id }).sort({ createdAt: -1 }).select("-resume -selfDescription -jobDescription -__v -technicalQuestions -behavioralQuestions -skillGaps -preparationPlan")

    res.status(200).json({
        success: true,
        message: "Interview reports fetched successfully.",
        interviewReports
    })
}


/**
 * @description Controller to generate resume PDF based on user self description, resume and job description.
 */
async function generateResumePdfController(req, res) {
    const { interviewReportId } = req.params

    const interviewReport = await interviewReportModel.findById(interviewReportId)

    if (!interviewReport) {
        return res.status(404).json({
            success: false,
            message: "Interview report not found."
        })
    }

    // Guard: logged-in user must own this report
    if (interviewReport.user.toString() !== req.user.id.toString()) {
        return res.status(403).json({ success: false, message: "Not authorised." })
    }

    const { resume, jobDescription, selfDescription } = interviewReport

    // Resume builder params (all optional — fall back to original behaviour if omitted)
    const {
        confirmedSkills = [],
        chosenSummary = null,
        skillsWithEvidence = [],
        irrelevantSkillsToDeprioritize = []
    } = req.body || {}

    const pdfBuffer = await generateResumePdf({
        resume, jobDescription, selfDescription,
        confirmedSkills, chosenSummary, skillsWithEvidence, irrelevantSkillsToDeprioritize
    })

    res.set({
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=resume_${interviewReportId}.pdf`
    })

    res.send(pdfBuffer)
}


/**
 * @description Get summary options + skill evidence for the Resume Builder modal.
 *              Accepts { confirmedSkills: string[] } in the request body.
 */
async function getResumeOptionsController(req, res) {
    try {
        const report = await interviewReportModel.findOne({
            _id: req.params.reportId,
            user: req.user.id
        })
        if (!report) return res.status(404).json({ success: false, message: "Report not found." })

        const { confirmedSkills = [] } = req.body || {}

        const options = await generateSummaryOptions({
            resume: report.resume,
            jobDescription: report.jobDescription,
            confirmedSkills,
            report
        })

        return res.json({ success: true, options })
    } catch (err) {
        console.error("getResumeOptions error:", err)
        return res.status(500).json({ success: false, error: err.message })
    }
}


/**
 * @description Controller to delete an interview plan by id.
 *              Only the owner of the plan can delete it.
 */
async function deletePlanController(req, res) {
    const { id } = req.params

    const plan = await interviewReportModel.findById(id)

    if (!plan) {
        return res.status(404).json({ success: false, message: "Plan not found." })
    }

    // Guard: logged-in user must own this plan
    if (plan.user.toString() !== req.user.id.toString()) {
        return res.status(403).json({ success: false, message: "Not authorised to delete this plan." })
    }

    await plan.deleteOne()

    return res.status(200).json({ success: true, message: "Plan deleted successfully." })
}


/**
 * @route POST /api/interview/:id/share
 * @description Generate (or re-enable) a public share link for an interview plan.
 *              Creates a nanoid shareId on first call; subsequent calls reuse the same id.
 * @access private
 */
async function shareReportController(req, res) {
    const { id } = req.params

    const plan = await interviewReportModel.findById(id)

    if (!plan) {
        return res.status(404).json({ success: false, message: "Plan not found." })
    }
    if (plan.user.toString() !== req.user.id.toString()) {
        return res.status(403).json({ success: false, message: "Not authorised." })
    }

    // Generate shareId only once — reuse on subsequent calls
    if (!plan.shareId) {
        plan.shareId = nanoid(10)
    }
    plan.isShared = true
    await plan.save()

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173"

    return res.status(200).json({
        success: true,
        shareId:  plan.shareId,
        isShared: plan.isShared,
        shareUrl: `${frontendUrl}/share/${plan.shareId}`
    })
}


/**
 * @route PATCH /api/interview/:id/share
 * @description Toggle isShared on/off WITHOUT deleting shareId.
 *              Re-enabling reuses the same URL.
 * @access private
 */
async function toggleShareController(req, res) {
    const { id } = req.params
    const { isShared } = req.body

    const plan = await interviewReportModel.findById(id)

    if (!plan) {
        return res.status(404).json({ success: false, message: "Plan not found." })
    }
    if (plan.user.toString() !== req.user.id.toString()) {
        return res.status(403).json({ success: false, message: "Not authorised." })
    }

    plan.isShared = Boolean(isShared)
    await plan.save()

    return res.status(200).json({ success: true, isShared: plan.isShared })
}


/**
 * @route GET /api/interview/share/:shareId
 * @description Public endpoint — returns a limited, safe view of the report.
 *              NEVER returns skillGaps, resume, jobDescription, selfDescription, or user.
 * @access public (no authMiddleware)
 */
async function getSharedReportController(req, res) {
    const { shareId } = req.params

    const plan = await interviewReportModel.findOne({ shareId })

    if (!plan || !plan.isShared) {
        return res.status(404).json({ success: false, message: "This report is not available." })
    }

    // Explicitly construct the safe response — never spread the whole document
    const publicReport = {
        title:               plan.title,
        matchScore:          plan.matchScore,
        technicalQuestions:  plan.technicalQuestions,
        behavioralQuestions: plan.behavioralQuestions,
        preparationPlan:     plan.preparationPlan,
        createdAt:           plan.createdAt
    }

    return res.status(200).json({ success: true, report: publicReport })
}


module.exports = {
    generateInterViewReportController,
    getInterviewReportByIdController,
    getAllInterviewReportsController,
    generateResumePdfController,
    getResumeOptionsController,
    deletePlanController,
    shareReportController,
    toggleShareController,
    getSharedReportController
}