import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router'
import "../auth.form.scss"
import { useAuth } from '../hooks/useAuth'

const Register = () => {

    const navigate = useNavigate()
    const { loading, handleRegister } = useAuth()

    const [username, setUsername] = useState("")
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [errors, setErrors] = useState({})   // holds per-field error messages

    // Client-side validation — must match backend Zod schema rules
    const validate = () => {
        const newErrors = {}

        if (!username.trim()) {
            newErrors.username = "Username is required"
        } else if (username.length < 3) {
            newErrors.username = "Username must be at least 3 characters"
        } else if (username.length > 20) {
            newErrors.username = "Username cannot exceed 20 characters"
        } else if (!/^[a-zA-Z0-9_]+$/.test(username)) {
            newErrors.username = "Only letters, numbers, and underscores allowed"
        }

        if (!email.trim()) {
            newErrors.email = "Email is required"
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            newErrors.email = "Please enter a valid email address"
        }

        if (!password) {
            newErrors.password = "Password is required"
        } else if (password.length < 8) {
            newErrors.password = "Password must be at least 8 characters"
        }

        setErrors(newErrors)
        return Object.keys(newErrors).length === 0  // true = valid
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!validate()) return   // stop here if client validation fails
        const success = await handleRegister({ username, email, password })
        if (success) navigate("/login")
    }

    // Clear field error as soon as user starts typing
    const clearError = (field) => {
        if (errors[field]) setErrors(prev => ({ ...prev, [field]: "" }))
    }

    if (loading) {
        return <main><div className="form-container"><h1>Loading...</h1></div></main>
    }

    return (
        <main>
            <div className="form-container">
                <h1>Register</h1>

                <form onSubmit={handleSubmit} noValidate>

                    <div className="input-group">
                        <label htmlFor="username">Username</label>
                        <input
                            type="text"
                            id="username"
                            name="username"
                            placeholder="Enter username (3–20 chars)"
                            value={username}
                            className={errors.username ? "input-error" : ""}
                            onChange={(e) => { setUsername(e.target.value); clearError("username") }}
                        />
                        {errors.username && <span className="field-error">{errors.username}</span>}
                    </div>

                    <div className="input-group">
                        <label htmlFor="email">Email</label>
                        <input
                            type="email"
                            id="email"
                            name="email"
                            placeholder="Enter email address"
                            value={email}
                            className={errors.email ? "input-error" : ""}
                            onChange={(e) => { setEmail(e.target.value); clearError("email") }}
                        />
                        {errors.email && <span className="field-error">{errors.email}</span>}
                    </div>

                    <div className="input-group">
                        <label htmlFor="password">Password</label>
                        <input
                            type="password"
                            id="password"
                            name="password"
                            placeholder="Min 8 characters"
                            value={password}
                            className={errors.password ? "input-error" : ""}
                            onChange={(e) => { setPassword(e.target.value); clearError("password") }}
                        />
                        {errors.password && <span className="field-error">{errors.password}</span>}
                    </div>

                    <button className="primary-button" disabled={loading}>
                        {loading ? "Creating account..." : "Register"}
                    </button>

                </form>

                <p>Already have an account? <Link to="/login">Login</Link></p>
            </div>
        </main>
    )
}

export default Register