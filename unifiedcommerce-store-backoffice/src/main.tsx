import React from "react"
import ReactDOM from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import App from "./App"
import "./index.css"

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("App error:", error, info.componentStack)
  }
  render() {
    if (this.state.hasError && this.state.error) {
      return (
        <div style={{ padding: 24, fontFamily: "system-ui", maxWidth: 600 }}>
          <h1 style={{ color: "#b91c1c", marginBottom: 8 }}>Something went wrong</h1>
          <pre style={{ background: "#fef2f2", padding: 16, borderRadius: 8, overflow: "auto", fontSize: 14 }}>
            {this.state.error.message}
          </pre>
          <p style={{ marginTop: 16, color: "#6b7280" }}>
            Check the browser console for details. Fix the error and refresh.
          </p>
        </div>
      )
    }
    return this.props.children
  }
}

const root = document.getElementById("root")
if (!root) {
  document.body.innerHTML = "<p>Root element #root not found.</p>"
} else {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <AppErrorBoundary>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </AppErrorBoundary>
    </React.StrictMode>
  )
}
