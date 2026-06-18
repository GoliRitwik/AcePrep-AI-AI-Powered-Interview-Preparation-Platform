import React from 'react'

/**
 * ErrorBoundary - catches unexpected React errors and shows a fallback UI
 * instead of a blank/broken screen.
 */
class ErrorBoundary extends React.Component {

    constructor(props) {
        super(props)
        this.state = { hasError: false, error: null }
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error }
    }

    componentDidCatch(error, info) {
        console.error("ErrorBoundary caught an error:", error, info)
    }

    handleRetry = () => {
        this.setState({ hasError: false, error: null })
    }

    render() {
        if (this.state.hasError) {
            return (
                <main style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100vh',
                    gap: '1rem',
                    background: '#0f1117',
                    color: '#e2e8f0',
                    fontFamily: 'inherit',
                    textAlign: 'center',
                    padding: '2rem'
                }}>
                    <h1 style={{ fontSize: '2rem', color: '#f87171' }}>Something went wrong</h1>
                    <p style={{ color: '#94a3b8', maxWidth: '400px' }}>
                        {this.state.error?.message || "An unexpected error occurred."}
                    </p>
                    <button
                        onClick={this.handleRetry}
                        style={{
                            marginTop: '1rem',
                            padding: '0.75rem 2rem',
                            borderRadius: '8px',
                            border: 'none',
                            background: '#6366f1',
                            color: '#fff',
                            cursor: 'pointer',
                            fontSize: '1rem',
                        }}
                    >
                        Try Again
                    </button>
                </main>
            )
        }

        return this.props.children
    }
}

export default ErrorBoundary
