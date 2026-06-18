import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router'
import "../auth.form.scss"
import { useAuth } from '../hooks/useAuth'

const Login = () => {

    const { loading, handleLogin } = useAuth()
    const navigate = useNavigate()

    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [errors, setErrors] = useState({})   // holds per-field error messages

    // Client-side validation — runs before the API call
    const validate = () => {
        const newErrors = {}

        if (!email.trim()) {
            newErrors.email = "Email is required"
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            newErrors.email = "Please enter a valid email address"
        }

        if (!password) {
            newErrors.password = "Password is required"
        }

        setErrors(newErrors)
        return Object.keys(newErrors).length === 0  // true = valid
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!validate()) return   // stop here if client validation fails
        const success = await handleLogin({ email, password })
        if (success) navigate('/')
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
                <h1>Login</h1>

                <form onSubmit={handleSubmit} noValidate>

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
                            placeholder="Enter password"
                            value={password}
                            className={errors.password ? "input-error" : ""}
                            onChange={(e) => { setPassword(e.target.value); clearError("password") }}
                        />
                        {errors.password && <span className="field-error">{errors.password}</span>}
                    </div>

                    <button className="primary-button" disabled={loading}>
                        {loading ? "Logging in..." : "Login"}
                    </button>

                </form>

                <p>Don't have an account? <Link to="/register">Register</Link></p>
            </div>
        </main>
    )
}

export default Login