import { Navigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { isAuthenticated } from "@/lib/auth"

/**
 * Renders children only if the user is authenticated and an admin (no store_id).
 * Store users (e.g. Store Order Pickup User) are redirected to /orders.
 */
export default function AdminOnlyRoute({ children }: { children: React.ReactNode }) {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />
  }

  const { data: meData, isLoading } = useQuery({
    queryKey: ["admin", "me"],
    queryFn: () => api.me(),
    enabled: true,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12 text-gray-500">
        Loading…
      </div>
    )
  }

  if (!meData?.user?.is_admin) {
    return <Navigate to="/orders" replace />
  }

  return <>{children}</>
}
