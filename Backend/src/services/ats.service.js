const { GoogleGenAI } = require("@google/genai")
const { z } = require("zod")
const { zodToJsonSchema } = require("zod-to-json-schema")
const crypto = require("crypto")

const REPORT_MODEL = "gemini-2.5-flash"

function getAiClient() {
    return new GoogleGenAI({
        apiKey: process.env.GOOGLE_GENAI_API_KEY
    })
}

// ═══════════════════════════════════════════════════════════════════════════
// ATS INPUTS SCHEMA
// ═══════════════════════════════════════════════════════════════════════════

const atsInputsSchema = z.object({
    requirements: z.object({
        jobTitle: z.string().describe("Target job title from the job description"),
        minYears: z.number().nullable().describe("Minimum years of professional experience required, or null if none specified. Use lower bound for ranges like '2-5 years' -> 2"),
        degreeRequired: z.boolean().describe("true if a degree (BS, B.Tech, MS, etc.) is explicitly required"),
        keywords: z.array(z.object({
            term: z.string().describe("A skill, tool, technology, standard, methodology or domain concept, 1 to 4 words. NEVER a sentence, verb phrase, years-of-experience statement, or degree"),
            aliases: z.array(z.string()).max(4).describe("Up to 4 common spellings, abbreviations, or acronyms"),
            importance: z.enum(["must", "nice"]).describe("'must' if under required/qualifications/responsibilities or repeated; 'nice' if preferred/bonus/nice to have"),
            category: z.string().describe("e.g. 'Language', 'Framework', 'Database', 'Cloud', 'Tool', 'Methodology', 'Concept'")
        })).max(30).describe("Max 30 key technical and role skills/concepts from the JD")
    }),
    facts: z.object({
        professionalYears: z.number().describe("Paid full-time years of experience from resume; each internship counts as 0.5. For students/freshers with internships only, e.g. 1 internship = 0.5"),
        degreeMatch: z.enum(["match", "related", "none"]).describe("Whether candidate's degree from resume matches the required degree ('match'), is related ('related'), or none ('none')")
    })
})

/**
 * Extract ATS requirements and candidate facts with a single Gemini call.
 */
async function extractAtsInputs({ jobDescription, resume }) {
    const prompt =
`You are an expert ATS (Applicant Tracking System) parser. Analyze this job description and resume to extract structured ATS requirements and candidate facts.

JOB DESCRIPTION:
${jobDescription}

CANDIDATE RESUME:
${resume}

EXTRACTION RULES:
1. REQUIREMENTS.jobTitle: Target job title from the JD.
2. REQUIREMENTS.minYears: Minimum years of professional experience required, as a number, or null if none specified. Use lower bound for ranges (e.g. "2-5 years" -> 2, "3+ years" -> 3).
3. REQUIREMENTS.degreeRequired: true if a degree (BS, MS, B.Tech, etc.) is explicitly stated as required.
4. REQUIREMENTS.keywords: Up to 30 skills, tools, technologies, standards, methodologies or domain concepts.
   - term: 1 to 4 words. NEVER a full sentence, verb phrase, years-of-experience statement, or degree. ("microservices", "code review", "CI/CD", "query optimization", "Java", "distributed systems").
   - aliases: Up to 4 common spellings/abbreviations (e.g. "Node.js" -> ["NodeJS", "Node"], "Kubernetes" -> ["K8s"]).
   - importance: "must" if listed under required/qualifications/responsibilities or repeated; "nice" if preferred/bonus/nice to have.
   - category: e.g. "Language", "Framework", "Database", "Cloud", "Tool", "Methodology", "Concept".
   - Skip generic filler (team player, fast-paced, passionate). Include at most 3 soft skills only if named explicitly.
   - Use ONLY what the job description states or implies. Do not invent terms.
5. FACTS.professionalYears: Paid full-time years of experience evidenced ONLY in the resume text. Each internship counts as 0.5 years. Freshers/students with internships only get 0.5 per internship.
6. FACTS.degreeMatch: "match" if resume degree matches required degree field; "related" if in a related field (e.g. IT/Cybersecurity vs CS); "none" if degree field doesn't match or no degree found.`

    const aiClient = getAiClient()
    const response = await aiClient.models.generateContent({
        model: REPORT_MODEL,
        contents: prompt,
        config: {
            temperature: 0,
            responseMimeType: 'application/json',
            responseSchema: zodToJsonSchema(atsInputsSchema)
        }
    })

    return JSON.parse(response.text)
}

// ═══════════════════════════════════════════════════════════════════════════
// DETERMINISTIC TOKENIZING & MATCHING
// ═══════════════════════════════════════════════════════════════════════════

function stemWord(w) {
    if (!w || typeof w !== 'string') return ''
    if (w.endsWith('ing') && w.length - 3 >= 3) return w.slice(0, -3)
    if (w.endsWith('ly') && w.length - 2 >= 3) return w.slice(0, -2)
    if (w.endsWith('ed') && w.length - 2 >= 3) return w.slice(0, -2)
    if (w.endsWith('es') && w.length - 2 >= 3) return w.slice(0, -2)
    if (w.endsWith('s') && !w.endsWith('ss') && w.length - 1 >= 3) return w.slice(0, -1)
    return w
}

function normalizeTokens(text) {
    if (!text) return { raw: '', tokens: [], stemmed: [], compact: '' }
    const raw = String(text)
        .replace(/[\u2010-\u2015\u2212]/g, '-')
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201C\u201D]/g, '"')

    const lower = raw.toLowerCase()
    const tokens = lower.match(/[a-z0-9+#]+/g) || []
    const stemmed = tokens.map(stemWord)
    const compact = lower.replace(/[^a-z0-9+#]/g, '')

    return { raw, tokens, stemmed, compact }
}

/**
 * Deterministic term matching in resume text.
 */
function containsTerm(text, term, aliases = []) {
    if (!text || !term) return false
    const parsedText = typeof text === 'object' && text.stemmed ? text : normalizeTokens(text)

    const candidates = [term, ...(aliases || [])]

    for (const cand of candidates) {
        if (!cand || typeof cand !== 'string') continue
        const trimmed = cand.trim()
        if (!trimmed) continue

        // 1-2 char terms ("C", "R", "Go"): match only as exact standalone, case-sensitive token
        if (trimmed.length <= 2) {
            const rawTokens = parsedText.raw.match(/[a-zA-Z0-9+#]+/g) || []
            if (rawTokens.some(t => t === trimmed)) return true
            continue
        }

        const candTokens = trimmed.toLowerCase().match(/[a-z0-9+#]+/g) || []
        if (candTokens.length === 0) continue

        const candStemmed = candTokens.map(stemWord)
        const candCompact = trimmed.toLowerCase().replace(/[^a-z0-9+#]/g, '')

        // Check compact form (e.g. "node.js" -> "nodejs", "ci/cd" -> "cicd")
        if (candCompact.length >= 3 && parsedText.compact.includes(candCompact)) {
            return true
        }

        // Check exact consecutive stemmed sequence
        let foundConsecutive = false
        for (let i = 0; i <= parsedText.stemmed.length - candStemmed.length; i++) {
            let match = true
            for (let j = 0; j < candStemmed.length; j++) {
                if (parsedText.stemmed[i + j] !== candStemmed[j]) {
                    match = false
                    break
                }
            }
            if (match) {
                foundConsecutive = true
                break
            }
        }
        if (foundConsecutive) return true

        // Multi-word terms: all content words appear within an 8-token window
        if (candStemmed.length > 1) {
            const windowSize = Math.max(8, candStemmed.length + 3)
            for (let i = 0; i <= parsedText.stemmed.length - candStemmed.length; i++) {
                const subWindow = parsedText.stemmed.slice(i, i + windowSize)
                const allInWindow = candStemmed.every(sw => subWindow.includes(sw))
                if (allInWindow) return true
            }
        }
    }

    return false
}

// ═══════════════════════════════════════════════════════════════════════════
// SCORE RESUME (100-POINT RUBRIC)
// ═══════════════════════════════════════════════════════════════════════════

function scoreResume({ text, requirements, facts }) {
    if (!text || !requirements) {
        return {
            score: 0,
            breakdown: {
                skills: { points: 0, max: 55, detail: 'No data' },
                title: { points: 0, max: 10, detail: 'No data' },
                experience: { points: 0, max: 15, detail: 'No data' },
                education: { points: 0, max: 10, detail: 'No data' },
                format: { points: 0, max: 10, detail: 'No data' }
            },
            matched: [],
            missing: []
        }
    }

    const parsedText = normalizeTokens(text)
    const keywords = requirements.keywords || []

    // 1. Skills match (55 pts)
    let totalWeight = 0
    let matchedWeight = 0
    const matched = []
    const missing = []

    for (const kw of keywords) {
        const weight = kw.importance === 'must' ? 3 : 1
        totalWeight += weight
        const isMatched = containsTerm(parsedText, kw.term, kw.aliases)
        if (isMatched) {
            matchedWeight += weight
            matched.push(kw)
        } else {
            missing.push(kw)
        }
    }

    const skillsPoints = totalWeight > 0 ? (matchedWeight / totalWeight) * 55 : 55
    const mustCount = keywords.filter(k => k.importance === 'must').length
    const matchedMustCount = matched.filter(k => k.importance === 'must').length
    const skillsDetail = `Matched ${matched.length} of ${keywords.length} keywords (${matchedMustCount} of ${mustCount} must-haves)`

    // 2. Role title alignment (10 pts)
    const jobTitle = requirements.jobTitle || ''
    const titleTokens = jobTitle.toLowerCase().match(/[a-z0-9+#]+/g) || []
    const ignoredTitleWords = new Set([
        'i', 'ii', 'iii', 'iv', 'senior', 'junior', 'lead', 'sr', 'jr',
        'principal', 'staff', 'intern', 'and', 'or', 'the', 'of', 'for', 'in', 'at', 'to'
    ])
    const sigTitleWords = titleTokens.filter(w => !ignoredTitleWords.has(w) && w.length > 1)
    let titlePoints = 10
    let titleDetail = 'Role title matches'
    if (sigTitleWords.length > 0) {
        const matchedTitleWords = sigTitleWords.filter(w => containsTerm(parsedText, w))
        const frac = matchedTitleWords.length / sigTitleWords.length
        titlePoints = frac * 10
        titleDetail = `${matchedTitleWords.length} of ${sigTitleWords.length} title keywords found`
    }

    // 3. Experience (15 pts)
    const minYears = requirements.minYears
    const profYears = facts?.professionalYears ?? 0
    let expPoints = 15
    let expDetail = 'No minimum experience requirement'
    if (minYears != null && minYears > 1) {
        const ratio = Math.min(1, profYears / minYears)
        expPoints = ratio * 15
        expDetail = `Role asks for ${minYears}+ years, resume shows ~${profYears} years`
    } else if (minYears != null) {
        expDetail = `Meets experience requirement (${minYears} year)`
    }

    // 4. Education (10 pts)
    let eduPoints = 10
    let eduDetail = 'No specific degree required'
    if (requirements.degreeRequired) {
        const dMatch = facts?.degreeMatch || 'none'
        if (dMatch === 'match') {
            eduPoints = 10
            eduDetail = 'Degree matches requirement'
        } else if (dMatch === 'related') {
            eduPoints = 5
            eduDetail = 'Related degree found'
        } else {
            eduPoints = 0
            eduDetail = 'No matching degree found'
        }
    }

    // 5. Format and readability (10 pts)
    const rawText = parsedText.raw
    const hasEmail = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(rawText)
    const hasPhone = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\b\d{10}\b/.test(rawText)

    const lowerRaw = rawText.toLowerCase()
    const hasSummary = /summary|objective|profile|about/i.test(lowerRaw)
    const hasEducation = /education|academic|degree/i.test(lowerRaw)
    const hasSkills = /skills|technical skills|technologies/i.test(lowerRaw)
    const hasProjectsOrExp = /project|experience|internship|employment/i.test(lowerRaw)

    const sectionsScore = (hasSummary ? 1 : 0) + (hasEducation ? 1 : 0) + (hasSkills ? 1 : 0) + (hasProjectsOrExp ? 1 : 0)

    const lines = rawText.split('\n')
    let metricCount = 0
    for (const line of lines) {
        if (/\d+%\s*|\b\d+x\b|\b\d+\s*percent|\b[1-9]\d{1,9}\b/.test(line)) {
            metricCount++
        }
    }
    const metricScore = metricCount >= 3 ? 2 : (metricCount >= 1 ? 1 : 0)
    const lengthScore = rawText.length <= 6500 ? 1 : (rawText.length <= 9000 ? 0.5 : 0)

    const formatPoints = (hasEmail ? 1.5 : 0) + (hasPhone ? 1.5 : 0) + sectionsScore + metricScore + lengthScore
    const formatDetail = `${Math.round(formatPoints * 10) / 10}/10 format criteria met`

    const finalScore = Math.max(0, Math.min(100, Math.round(skillsPoints + titlePoints + expPoints + eduPoints + formatPoints)))

    return {
        score: finalScore,
        breakdown: {
            skills: { points: Math.round(skillsPoints * 10) / 10, max: 55, detail: skillsDetail },
            title: { points: Math.round(titlePoints * 10) / 10, max: 10, detail: titleDetail },
            experience: { points: Math.round(expPoints * 10) / 10, max: 15, detail: expDetail },
            education: { points: Math.round(eduPoints * 10) / 10, max: 10, detail: eduDetail },
            format: { points: Math.round(formatPoints * 10) / 10, max: 10, detail: formatDetail }
        },
        matched,
        missing
    }
}

function buildScoreExplanation(result) {
    if (!result || !result.breakdown) return ''
    const { skills, experience, education } = result.breakdown
    return `${skills.detail}. Experience: ${experience.detail}. Education: ${education.detail}.`
}

/**
 * Cache on report: report.atsCache = { key, requirements, facts, original }
 */
async function ensureAtsCache(report) {
    const key = crypto.createHash('sha1').update((report.jobDescription || '') + "\n" + (report.resume || '')).digest('hex')
    if (report.atsCache && report.atsCache.key === key && report.atsCache.requirements && report.atsCache.original) {
        return report.atsCache
    }

    const { requirements, facts } = await extractAtsInputs({
        jobDescription: report.jobDescription,
        resume: report.resume
    })

    const original = scoreResume({
        text: report.resume,
        requirements,
        facts
    })

    report.atsCache = {
        key,
        requirements,
        facts,
        original
    }
    return report.atsCache
}

module.exports = {
    extractAtsInputs,
    containsTerm,
    scoreResume,
    buildScoreExplanation,
    ensureAtsCache,
    normalizeTokens
}
