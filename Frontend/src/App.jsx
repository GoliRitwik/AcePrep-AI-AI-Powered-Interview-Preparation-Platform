import { RouterProvider } from "react-router"
import { router } from "./app.routes.jsx"
import { AuthProvider } from "./features/auth/auth.context.jsx"
import { InterviewProvider } from "./features/interview/interview.context.jsx"
import { Toaster } from "react-hot-toast"

// Ping backend on app load to wake up Render free instance
// Fires immediately when app loads — Render starts waking up BEFORE user tries to login
const warmUpBackend = () => {
    const backendUrl =
        import.meta.env.VITE_API_URL ||
        "https://aceprep-backend-elm2.onrender.com"
    fetch(`${backendUrl}/health`, { method: "GET" })
        .then(() => console.log("Backend is awake"))
        .catch(() => console.log("Backend warming up..."))
}
warmUpBackend()


function App() {

  return (
    <AuthProvider>
      <InterviewProvider>
        <RouterProvider router={router} />
        {/* Toast notifications - position top-right, auto-dismiss after 4s */}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              borderRadius: '8px',
              fontFamily: 'inherit',
            },
            success: {
              style: {
                background: '#1a1f27',
                color: '#4ade80',
                border: '1px solid #4ade8033',
              },
            },
            error: {
              style: {
                background: '#1a1f27',
                color: '#f87171',
                border: '1px solid #f8717133',
              },
            },
          }}
        />
      </InterviewProvider>
    </AuthProvider>
  )
}

export default App
