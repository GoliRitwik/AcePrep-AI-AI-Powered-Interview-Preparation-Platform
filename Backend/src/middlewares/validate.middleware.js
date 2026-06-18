/**
 * @name validate
 * @description Factory function that returns an Express middleware.
 *              Validates req.body against a Zod schema BEFORE the controller runs.
 *              On failure → passes a 400 error to the global error handler.
 *              On success → replaces req.body with Zod's parsed (safe) data and calls next().
 *
 * @param {import('zod').ZodSchema} schema - The Zod schema to validate against
 * @returns {import('express').RequestHandler}
 *
 * @example
 * // In a route file:
 * router.post("/register", validate(registerSchema), authController.registerUserController)
 */
const validate = (schema) => (req, res, next) => {
    const result = schema.safeParse(req.body)

    if (!result.success) {
        // Extract the first validation error message for a clean user-facing message
        const message = result.error.errors[0]?.message || "Invalid input"
        const err = new Error(message)
        err.status = 400
        return next(err)  // flows into the global error handler in app.js
    }

    // Replace req.body with the parsed data (Zod strips unknown fields automatically)
    req.body = result.data
    next()
}

module.exports = validate
