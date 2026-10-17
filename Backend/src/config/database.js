const mongoose = require("mongoose")

async function connectToDB() {
    try {
        await mongoose.connect(process.env.MONGO_URI)
        console.log("Connected to Database")
    } catch (err) {
        console.error("Database connection failed:", err.message)
        process.exit(1)   // crash loudly instead of running with no DB
    }
}

module.exports = connectToDB
