import { Routes, Route, Link, useLocation, useNavigate, Navigate } from "react-router-dom"
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query"
import { Toaster } from "@medusajs/ui"
import { useEffect, useState } from "react"
import LoginPage from "@/pages/Login"
import OrderListPage from "@/pages/OrderList"
import OrderWeightPage from "@/pages/OrderWeight"
import CreateStoreUserPage from "@/pages/CreateStoreUser"
import ManageUsersPage from "@/pages/ManageUsers"
import ProtectedRoute from "@/components/ProtectedRoute"
import AdminOnlyRoute from "@/components/AdminOnlyRoute"
import CreateStoreUserRoute from "@/components/CreateStoreUserRoute"
import { isAuthenticated, clearToken } from "@/lib/auth"
import { api } from "@/lib/api"

const queryClient = new QueryClient()

function Header() {
  const [auth, setAuth] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    setAuth(isAuthenticated())
  }, [location.pathname])

  const handleLogout = () => {
    clearToken()
    setAuth(false)
    navigate("/login", { replace: true })
  }

  if (!auth) return null

  return (
    <header className="shrink-0 border-b border-green-200/60 bg-white/95 backdrop-blur-sm sticky top-0 z-10">
      <div className="content-container py-3 px-4 flex items-center gap-4">
        <Link to="/orders" className="flex items-center shrink-0" aria-label="Home">
          <img
            src="/logo.png"
            alt="Logo"
            className="h-8 object-contain"
          />
        </Link>
        <h1 className="text-2xl font-semibold text-gray-900 flex-1 text-center">
          e-Commerce BackOffice Platform
        </h1>
        <button
          type="button"
          onClick={handleLogout}
          className="shrink-0 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-red-600"
        >
          Sign out
        </button>
      </div>
    </header>
  )
}

function Sidebar() {
  const location = useLocation()
  const [auth, setAuth] = useState(false)
  const { data: meData } = useQuery({
    queryKey: ["admin", "me"],
    queryFn: () => api.me(),
    enabled: isAuthenticated(),
  })
  const isAdmin = meData?.user?.is_admin ?? false
  const canCreateStoreUser = meData?.user?.can_create_store_user ?? isAdmin

  useEffect(() => {
    setAuth(isAuthenticated())
  }, [location.pathname])

  if (!auth) return null

  const ordersActive = location.pathname === "/orders" || location.pathname.startsWith("/orders/")
  const createUserActive = location.pathname === "/store-users/new"
  const manageUsersActive = location.pathname === "/users"

  return (
    <aside className="w-56 shrink-0 flex flex-col border-r border-green-200/60 bg-white/90 min-h-screen py-6 px-4">
      <nav className="flex flex-col gap-1">
        <Link
          to="/orders"
          className={`rounded-lg px-3 py-2 text-sm font-medium ${ordersActive ? "bg-green-100 text-green-800" : "text-gray-700 hover:bg-gray-100"}`}
        >
          {isAdmin ? "List all orders" : "My store orders"}
        </Link>
        {canCreateStoreUser && (
          <Link
            to="/store-users/new"
            className={`rounded-lg px-3 py-2 text-sm font-medium ${createUserActive ? "bg-green-100 text-green-800" : "text-gray-700 hover:bg-gray-100"}`}
          >
            Create store user
          </Link>
        )}
        {isAdmin && (
          <Link
            to="/users"
            className={`rounded-lg px-3 py-2 text-sm font-medium ${manageUsersActive ? "bg-green-100 text-green-800" : "text-gray-700 hover:bg-gray-100"}`}
          >
            Manage users & roles
          </Link>
        )}
      </nav>
    </aside>
  )
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/orders"
        element={
          <ProtectedRoute>
            <OrderListPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/orders/:id/weight"
        element={
          <ProtectedRoute>
            <OrderWeightPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/store-users/new"
        element={
          <CreateStoreUserRoute>
            <CreateStoreUserPage />
          </CreateStoreUserRoute>
        }
      />
      <Route
        path="/users"
        element={
          <AdminOnlyRoute>
            <ManageUsersPage />
          </AdminOnlyRoute>
        }
      />
      <Route path="/" element={isAuthenticated() ? <Navigate to="/orders" replace /> : <LoginPage />} />
      {/* Catch-all: unknown paths redirect to orders or login */}
      <Route path="*" element={<Navigate to={isAuthenticated() ? "/orders" : "/login"} replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Header />
        <div className="flex flex-1 min-h-0">
          <Sidebar />
          <main className="flex-1 min-w-0 overflow-auto">
            <AppRoutes />
          </main>
        </div>
      </div>
      <Toaster />
    </QueryClientProvider>
  )
}
