const mongoose = require('mongoose')

const blacklistTokenSchema = new mongoose.Schema({
    token: {
        type: String,
        required: [ true, "token is required to be added in blacklist" ]
    }
}, {
    timestamps: true
})

// Index on token for instant O(1) blacklist lookups on every request
blacklistTokenSchema.index({ token: 1 })
// TTL index: auto-delete expired tokens after 24 hours (matching 1d JWT lifetime)
blacklistTokenSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 })

const tokenBlacklistModel = mongoose.model("blacklistTokens", blacklistTokenSchema)

module.exports = tokenBlacklistModel
