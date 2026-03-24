/**
 * Store associate login — same theme as storefront hero (green/emerald gradient).
 * On success: store token, redirect to /orders.
 */

import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { api } from "@/lib/api"
import { setToken } from "@/lib/auth"

export default function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const { token } = await api.auth.login(email.trim(), password)
      setToken(token)
      navigate("/orders", { replace: true })
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Sign in failed. Try again."
      if (msg.toLowerCase().includes("failed to fetch") || msg.toLowerCase().includes("network")) {
        const origin = typeof window !== "undefined" ? window.location.origin : ""
        setError(
          origin
            ? `Cannot reach the backend. Ensure the backend's AUTH_CORS includes this app's URL: ${origin} (then redeploy the backend).`
            : "Cannot reach the backend. Ensure the backend is running and AUTH_CORS includes this app's origin, then redeploy the backend."
        )
      } else {
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-gradient-to-br from-green-50 via-emerald-50 to-lime-50 relative overflow-hidden">
      {/* Background blurs like storefront hero */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-br from-green-200/40 to-emerald-300/30 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-gradient-to-tr from-lime-200/40 to-yellow-200/30 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: "radial-gradient(circle at 2px 2px, #16a34a 1px, transparent 0)",
            backgroundSize: "50px 50px",
          }}
        />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="card p-8 sm:p-10 shadow-xl">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200/50 rounded-full text-green-700 text-sm font-medium mb-6">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              Store associate
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Welcome back</h1>
            <p className="text-gray-600 mt-2">Sign in to manage orders and pick items.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="you@store.com"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-green-500 focus:ring-2 focus:ring-green-500/20 outline-none transition"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-green-500 focus:ring-2 focus:ring-green-500/20 outline-none transition"
              />
            </div>
            {error && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3.5 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
