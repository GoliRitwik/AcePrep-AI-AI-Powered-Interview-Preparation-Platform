import React, { createContext, useState, useEffect } from "react"
import { login, register, logout, getMe } from "./services/auth.api"
import toast from "react-hot-toast"

export const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => { 
    const [user, setUser] = useState(null)
    const [loading, setLoading] = useState(true)

    const handleLogin = async ({ email, password }) => {
        setLoading(true)
        try {
            const data = await login({ email, password })
            setUser(data.user)
            toast.success("Logged in successfully!")
            return true
        } catch (err) {
            const message = err.response?.data?.message || "Login failed. Please try again."
            toast.error(message)
            return false
        } finally {
            setLoading(false)
        }
    }

    const handleRegister = async ({ username, email, password }) => {
        setLoading(true)
        try {
            await register({ username, email, password })
            toast.success("Account created! Please sign in.")
            return true
        } catch (err) {
            const message = err.response?.data?.message || "Registration failed. Please try again."
            toast.error(message)
            return false
        } finally {
            setLoading(false)
        }
    }

    const handleLogout = async () => {
        setLoading(true)
        try {
            await logout()
            setUser(null)
            toast.success("Logged out successfully!")
        } catch (err) {
            toast.error("Logout failed. Please try again.")
        } finally {
            setLoading(false)
        }
    }

    // Session restore on initial mount: runs ONCE for the whole application
    useEffect(() => {
        let isMounted = true

        const checkAuth = async () => {
            try {
                const data = await getMe()
                if (isMounted) {
                    setUser(data.user)
                }
            } catch (err) {
                if (isMounted) {
                    setUser(null)
                }
            } finally {
                if (isMounted) {
                    setLoading(false)
                }
            }
        }

        checkAuth()

        return () => {
            isMounted = false
        }
    }, [])

    return (
        <AuthContext.Provider value={{ user, setUser, loading, setLoading, handleLogin, handleRegister, handleLogout }}>
            {children}
        </AuthContext.Provider>
    )
}
