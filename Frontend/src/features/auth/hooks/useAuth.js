import { useContext, useEffect } from "react";
import { AuthContext } from "../auth.context";
import { login, register, logout, getMe } from "../services/auth.api";
import toast from "react-hot-toast";



export const useAuth = () => {

    const context = useContext(AuthContext)
    const { user, setUser, loading, setLoading } = context


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

    useEffect(() => {

        const getAndSetUser = async () => {
            try {
                const data = await getMe()
                setUser(data.user)
            } catch (err) {
                // Silent — user is simply not logged in, no toast needed
            } finally {
                setLoading(false)
            }
        }

        getAndSetUser()

    }, [])

    return { user, loading, handleRegister, handleLogin, handleLogout }
}