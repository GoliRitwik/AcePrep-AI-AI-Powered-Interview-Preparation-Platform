const pdfParse = require("pdf-parse")
const { generateInterviewReport, generateResumePdf, generatePdfFromHtml, generateTailoredResume, buildResumeHtml, scoreResumeComparison, resumeContentToText, generateSummaryOptions } = require("../services/ai.service")
const { ensureAtsCache, scoreResume, buildScoreExplanation } = require("../services/ats.service")
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


/**
 * POST /api/interview/resume/generate/:reportId
 * Generates the tailored resume HTML + scores it deterministically, saves to report.tailoredResume.
 */
async function generateTailoredResumeController(req, res) {
    try {
        const report = await interviewReportModel.findById(req.params.reportId)
        if (!report) return res.status(404).json({ success: false, message: 'Report not found.' })
        if (report.user.toString() !== req.user.id.toString())
            return res.status(403).json({ success: false, message: 'Not authorised.' })

        const {
            confirmedSkills = [],
            chosenSummary = null,
            skillsWithEvidence = [],
            irrelevantSkillsToDeprioritize = [],
            summaryLabel = ''
        } = req.body || {}

        // 1. Generate content + HTML (no PDF)
        const { content, html } = await generateTailoredResume({
            resume: report.resume,
            selfDescription: report.selfDescription,
            jobDescription: report.jobDescription,
            confirmedSkills,
            chosenSummary,
            skillsWithEvidence,
            irrelevantSkillsToDeprioritize
        })

        // 2. Deterministic ATS Scoring (Part 4)
        let scoreAvailable = false
        let scoring = null
        let atsBefore = null
        let atsAfter = null
        let keywordsGained = []

        try {
            // Ensure atsCache exists on report (extracted once, cached across rebuilds)
            const atsCache = await ensureAtsCache(report)
            const before = atsCache.original
            const tailoredText = resumeContentToText(content)
            const after = scoreResume({
                text: tailoredText,
                requirements: atsCache.requirements,
                facts: atsCache.facts
            })

            const beforeMatchedTerms = new Set((before.matched || []).map(m => m.term.toLowerCase()))
            keywordsGained = (after.matched || [])
                .filter(m => !beforeMatchedTerms.has(m.term.toLowerCase()))
                .map(m => m.term)

            atsBefore = before.score
            atsAfter = after.score
            scoring = {
                version: 2,
                before,
                after,
                keywordsGained,
                explanation: buildScoreExplanation(after)
            }
            scoreAvailable = true
        } catch (scoreErr) {
            console.error('Deterministic ATS scoring failed (non-blocking):', scoreErr.message)
        }

        // 3. Save to report
        report.tailoredResume = {
            content,
            html,
            scoring,
            generatedAt: new Date(),
            atsBefore,
            atsAfter,
            matchedBefore: [],
            matchedAfter: [],
            missingAfter: [],
            keywordsGained,
            changes: {
                skillsAdded: confirmedSkills,
                skillsDeprioritized: irrelevantSkillsToDeprioritize,
                summaryAngle: summaryLabel,
                summaryText: chosenSummary
            }
        }
        await report.save()

        return res.json({ success: true, tailoredResume: report.tailoredResume, scoreAvailable })
    } catch (err) {
        console.error('generateTailoredResumeController error:', err)
        return res.status(500).json({ success: false, message: err.message })
    }
}


/**
 * PATCH /api/interview/resume/:reportId
 * In-place editing of tailored resume content with live re-render and deterministic re-score.
 */
async function updateTailoredResumeController(req, res) {
    try {
        const report = await interviewReportModel.findById(req.params.reportId)
        if (!report) return res.status(404).json({ success: false, message: 'Report not found.' })
        if (report.user.toString() !== req.user.id.toString())
            return res.status(403).json({ success: false, message: 'Not authorised.' })

        // Check if report has saved content & atsCache (older reports must rebuild once)
        if (!report.tailoredResume?.content || !report.atsCache?.requirements) {
            return res.status(409).json({ success: false, message: 'Rebuild the resume once to enable editing.' })
        }

        const saved = report.tailoredResume.content
        const input = req.body.content || {}
        const save = Boolean(req.body.save)

        // Helper to strip control characters, trim, and enforce max length
        const clean = (str, maxLen = 1000) => {
            if (typeof str !== 'string') return ''
            return str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim().slice(0, maxLen)
        }

        // 1. Sanitize editable fields and merge with immutable saved fields
        const sanitizedContent = {
            // Immutable identity & links (taken strictly from saved content)
            name: saved.name,
            email: saved.email,
            phone: saved.phone,
            githubUrl: saved.githubUrl,
            linkedinUrl: saved.linkedinUrl,

            // Editable: summary (max 900 chars)
            summary: clean(input.summary, 900),

            // Editable: skillsRows (max 5 rows; label max 30; value max 200)
            skillsRows: (Array.isArray(input.skillsRows) ? input.skillsRows.slice(0, 5) : []).map(row => {
                const rawItems = Array.isArray(row.items) ? row.items : (row.label ? [row] : [])
                return {
                    items: rawItems.map(item => ({
                        label: clean(item.label, 30),
                        value: clean(item.value, 200)
                    }))
                }
            }),

            // Editable: internships bullets (max 2 each), organisation is immutable
            internships: (saved.internships || []).map((org, i) => {
                const inputBullets = input.internships?.[i]?.bullets || org.bullets || []
                return {
                    organisation: org.organisation,
                    bullets: inputBullets.slice(0, 2).map(b => clean(b, 350))
                }
            }),

            // Editable: project bullets (max 3, min 1), name & stack are immutable
            projects: (saved.projects || []).map((proj, i) => {
                const inputBullets = input.projects?.[i]?.bullets || proj.bullets || []
                const cleanedBullets = inputBullets.slice(0, 3).map(b => clean(b, 350)).filter(Boolean)
                return {
                    name: proj.name,
                    stack: proj.stack,
                    bullets: cleanedBullets.length > 0 ? cleanedBullets : proj.bullets.slice(0, 1)
                }
            }),

            // Editable: certifications (max 600 chars), codingProfiles (max 300 chars)
            certifications: clean(input.certifications, 600),
            codingProfiles: clean(input.codingProfiles, 300)
        }

        // 2. Rebuild HTML (escapes all values)
        const html = buildResumeHtml(sanitizedContent)

        // 3. Re-score using cached requirements & facts
        const tailoredText = resumeContentToText(sanitizedContent)
        const after = scoreResume({
            text: tailoredText,
            requirements: report.atsCache.requirements,
            facts: report.atsCache.facts
        })
        const before = report.atsCache.original || scoreResume({
            text: report.resume,
            requirements: report.atsCache.requirements,
            facts: report.atsCache.facts
        })

        const beforeMatchedTerms = new Set((before.matched || []).map(m => m.term.toLowerCase()))
        const keywordsGained = (after.matched || [])
            .filter(m => !beforeMatchedTerms.has(m.term.toLowerCase()))
            .map(m => m.term)

        const scoring = {
            version: 2,
            before,
            after,
            keywordsGained,
            explanation: buildScoreExplanation(after)
        }

        // 4. Persist if save === true
        if (save) {
            report.tailoredResume.content = sanitizedContent
            report.tailoredResume.html = html
            report.tailoredResume.scoring = scoring
            report.tailoredResume.atsAfter = after.score
            report.tailoredResume.keywordsGained = keywordsGained
            report.tailoredResume.generatedAt = new Date()
            await report.save()
        }

        return res.json({
            success: true,
            html,
            scoring,
            atsBefore: before.score,
            atsAfter: after.score
        })
    } catch (err) {
        console.error('updateTailoredResumeController error:', err)
        return res.status(500).json({ success: false, message: err.message })
    }
}


/**
 * GET /api/interview/resume/pdf/:reportId
 * Renders the saved tailoredResume.html as a PDF and streams it.
 * Does NOT trigger any AI call.
 */
async function downloadTailoredResumePdfController(req, res) {
    try {
        const report = await interviewReportModel.findById(req.params.reportId)
        if (!report) return res.status(404).json({ success: false, message: 'Report not found.' })
        if (report.user.toString() !== req.user.id.toString())
            return res.status(403).json({ success: false, message: 'Not authorised.' })
        if (!report.tailoredResume || !report.tailoredResume.html)
            return res.status(404).json({ success: false, message: 'No tailored resume found. Build one first.' })

        const pdfBuffer = await generatePdfFromHtml(report.tailoredResume.html)

        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="resume.pdf"`
        })
        return res.send(pdfBuffer)
    } catch (err) {
        console.error('downloadTailoredResumePdfController error:', err)
        return res.status(500).json({ success: false, message: err.message })
    }
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
    getSharedReportController,
    generateTailoredResumeController,
    downloadTailoredResumePdfController,
    updateTailoredResumeController
}