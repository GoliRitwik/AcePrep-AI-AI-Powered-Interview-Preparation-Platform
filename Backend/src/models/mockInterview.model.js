const mongoose = require("mongoose")

const mockInterviewSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    report: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "InterviewReport",
        required: true
    },

    mode: {
        type: String,
        enum: ["technical", "behavioral", "hr", "mixed"],
        required: true
    },
    difficulty: {
        type: String,
        enum: ["easy", "medium", "hard"],
        required: true
    },
    persona: {
        type: String,
        enum: ["friendly", "neutral", "tough"],
        required: true
    },

    messages: [{
        role: {
            type: String,
            enum: ["interviewer", "candidate"],
            required: true
        },
        content: { type: String, required: true },
        timestamp: { type: Date, default: Date.now }
    }],

    // IMPORTANT: followUpCountPerQuestion uses Mixed type (not Map).
    // Mongoose Map silently breaks when passed through JSON.stringify,
    // .toObject(), or destructuring — which happens constantly in
    // helper functions. Use plain object with bracket notation:
    //   state.followUpCountPerQuestion[key] = value
    // Always call markModified("sessionState.followUpCountPerQuestion")
    // after mutation.
    sessionState: {
        currentQuestionIndex: { type: Number, default: 0 },
        followUpCountPerQuestion: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        },
        askedQuestionIndices: [Number],
        totalQuestionsInPool: { type: Number, default: 0 },
        lastAnswerQuality: {
            type: String,
            enum: ["strong", "acceptable", "weak", "vague", null],
            default: null
        },
        phase: {
            type: String,
            enum: ["intro", "questioning", "closing"],
            default: "intro"
        }
    },

    limits: {
        maxQuestions: { type: Number, default: 7 },
        maxFollowUpsPerQuestion: { type: Number, default: 2 },
        maxDurationMinutes: { type: Number, default: 30 },
        maxAnswerWords: { type: Number, default: 200 },
        hardCostCapWords: { type: Number, default: 600 }
    },

    status: {
        type: String,
        enum: ["in_progress", "completed", "abandoned"],
        default: "in_progress"
    },

    feedback: {
        scores: {
            technicalAccuracy: { type: Number, min: 0, max: 25 },
            communicationClarity: { type: Number, min: 0, max: 25 },
            structureAndExamples: { type: Number, min: 0, max: 25 },
            depthUnderPressure: { type: Number, min: 0, max: 25 }
        },
        overallScore: { type: Number, min: 0, max: 100 },
        perQuestionRatings: [{
            questionIndex: Number,
            question: String,
            rating: { type: String, enum: ["strong", "acceptable", "weak"] },
            comment: String
        }],
        strengths: [String],
        improvements: [String],
        summary: String,
        comparedToPrevious: {
            previousScore: Number,
            scoreDelta: Number,
            trend: {
                type: String,
                enum: ["improved", "declined", "similar"]
            }
        }
    },

    createdAt: { type: Date, default: Date.now },
    completedAt: { type: Date, default: null },
    abandonedAt: { type: Date, default: null }
}, {
    timestamps: { updatedAt: "updatedAt", createdAt: false }
})

// Rate limiting index — prevents API spam on the respond endpoint
mockInterviewSchema.index({ user: 1, updatedAt: -1 })

module.exports = mongoose.model("MockInterview", mockInterviewSchema)
