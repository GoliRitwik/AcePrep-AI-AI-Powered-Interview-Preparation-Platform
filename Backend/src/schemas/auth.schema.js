const { z } = require('zod')

/**
 * Schema for POST /api/auth/register
 * Validates username, email, and password before the controller runs.
 */
const registerSchema = z.object({
    username: z.string()
        .min(3, "Username must be at least 3 characters")
        .max(20, "Username cannot exceed 20 characters")
        .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores"),

    email: z.string()
        .email("Please provide a valid email address"),

    password: z.string()
        .min(8, "Password must be at least 8 characters")
})

/**
 * Schema for POST /api/auth/login
 * Email format + non-empty password check.
 */
const loginSchema = z.object({
    email: z.string()
        .email("Please provide a valid email address"),

    password: z.string()
        .min(1, "Password is required")
})

module.exports = { registerSchema, loginSchema }
