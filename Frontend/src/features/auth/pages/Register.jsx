import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '../hooks/useAuth.js'
import '../auth.form.scss'

const EyeIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
    </svg>
)

const EyeOffIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
        <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
)

const Register = () => {
    const { handleRegister, loading } = useAuth()
    const navigate = useNavigate()

    const [username, setUsername] = useState("")
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [showPassword, setShowPassword] = useState(false)
    const [errors, setErrors] = useState({})

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
        return Object.keys(newErrors).length === 0
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!validate()) return
        const success = await handleRegister({ username, email, password })
        if (success) navigate("/login")
    }

    const clearError = (field) => {
        if (errors[field]) setErrors(prev => ({ ...prev, [field]: "" }))
    }

    if (loading) {
        return (
            <main className="auth-page">
                <div className="form-container">
                    <p style={{ color: "rgba(255,255,255,0.6)" }}>Loading...</p>
                </div>
            </main>
        )
    }

    return (
        <main className="auth-page">
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
                        <div className="password-input-wrapper">
                            <input
                                type={showPassword ? "text" : "password"}
                                id="password"
                                name="password"
                                placeholder="Min 8 characters"
                                value={password}
                                className={errors.password ? "input-error" : ""}
                                onChange={(e) => { setPassword(e.target.value); clearError("password") }}
                            />
                            <button
                                type="button"
                                className="password-toggle-btn"
                                onClick={() => setShowPassword(!showPassword)}
                                aria-label={showPassword ? "Hide password" : "Show password"}
                            >
                                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                            </button>
                        </div>
                        {errors.password && <span className="field-error">{errors.password}</span>}
                    </div>

                    <button className="primary-button" disabled={loading} type="submit">
                        {loading ? "Creating account..." : "Register →"}
                    </button>
                </form>

                <p className="auth-switch">
                    Already have an account? <Link to="/login">Login</Link>
                </p>
            </div>
        </main>
    )
}

export default Register
