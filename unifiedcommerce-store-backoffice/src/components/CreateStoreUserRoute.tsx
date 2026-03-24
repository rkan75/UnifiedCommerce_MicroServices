import { Navigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { Button } from "@medusajs/ui"
import { api, type BackofficeUser } from "@/lib/api"
import { isAuthenticated } from "@/lib/auth"

type MeResponse = { user: BackofficeUser }

/**
 * Renders children only if the user is authenticated and can create store users:
 * admins (is_admin) or users with Store Admin User role (can_create_store_user).
 */
export default function CreateStoreUserRoute({ children }: { children: React.ReactNode }) {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />
  }

  const { data: meData, isLoading, isError, refetch } = useQuery<MeResponse>({
    queryKey: ["admin", "me"],
    queryFn: () => api.me(),
    enabled: true,
    retry: 1,
    staleTime: 60 * 1000,
  })

  const userFromMe = (meData as MeResponse | undefined)?.user
  if (isLoading && !userFromMe) {
    return (
      <div className="flex items-center justify-center p-12 text-gray-500">
        Loading…
      </div>
    )
  }

  if (isError && !userFromMe) {
    return (
      <div className="content-container py-12 flex flex-col items-center justify-center gap-4">
        <p className="text-gray-600">Could not load your profile. The page may not have access.</p>
        <Button variant="secondary" onClick={() => refetch()}>
          Retry
        </Button>
        <a href="/orders" className="text-sm text-green-600 hover:text-green-800">
          Back to orders
        </a>
      </div>
    )
  }

  const user = userFromMe
  if (!user) {
    return (
      <div className="flex items-center justify-center p-12 text-gray-500">
        Loading…
      </div>
    )
  }

  const canCreate = user.is_admin === true || user.can_create_store_user === true
  if (!canCreate) {
    return <Navigate to="/orders" replace />
  }

  return <>{children}</>
}
