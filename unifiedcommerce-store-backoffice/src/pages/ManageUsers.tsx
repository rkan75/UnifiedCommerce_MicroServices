/**
 * Manage users — list users and reassign RBAC roles (admin only).
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { api, type RbacRole } from "@/lib/api"
import { useToast } from "@medusajs/ui"

type UserRow = {
  id: string
  email: string
  first_name?: string
  last_name?: string
  rbac_roles?: { id: string; name: string }[]
}

export default function ManageUsersPage() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [savingUserId, setSavingUserId] = useState<string | null>(null)
  const [selectedRoleIds, setSelectedRoleIds] = useState<Record<string, string[]>>({})

  const { data: meData } = useQuery({ queryKey: ["admin", "me"], queryFn: () => api.me() })
  const user = meData?.user
  const isAdmin = user?.is_admin ?? false

  const { data: usersData, isLoading: usersLoading, error: usersError } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => api.users.list(),
    enabled: isAdmin,
  })
  const { data: rolesData } = useQuery({
    queryKey: ["admin", "roles"],
    queryFn: () => api.roles.list(),
    enabled: isAdmin,
  })

  const users: UserRow[] = usersData?.users ?? []
  const roles: RbacRole[] = rolesData?.roles ?? []

  const setRolesMutation = useMutation({
    mutationFn: ({ userId, roleIds }: { userId: string; roleIds: string[] }) =>
      api.users.setRoles(userId, roleIds),
    onMutate: ({ userId }) => setSavingUserId(userId),
    onSuccess: (_, { userId }) => {
      setSavingUserId(null)
      setSelectedRoleIds((prev) => ({ ...prev, [userId]: [] }))
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] })
      toast({ title: "Roles updated", description: "User roles have been saved." })
    },
    onError: (e: Error, { userId: _userId }) => {
      setSavingUserId(null)
      toast({ title: "Error", description: e.message, variant: "error" })
    },
  })

  const handleRoleChange = (userId: string, roleId: string, checked: boolean) => {
    setSelectedRoleIds((prev) => {
      const base = prev[userId] ?? (users.find((u) => u.id === userId)?.rbac_roles ?? []).map((r) => r.id)
      if (checked) return { ...prev, [userId]: [...base, roleId] }
      return { ...prev, [userId]: base.filter((id) => id !== roleId) }
    })
  }

  const getCurrentRoleIdsForUser = (u: UserRow) =>
    selectedRoleIds[u.id] !== undefined ? selectedRoleIds[u.id] : (u.rbac_roles ?? []).map((r) => r.id)

  const hasRoleChanges = (u: UserRow) => {
    const current = getCurrentRoleIdsForUser(u)
    const saved = (u.rbac_roles ?? []).map((r) => r.id)
    const compare = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: "base" })
    return JSON.stringify([...current].sort(compare)) !== JSON.stringify([...saved].sort(compare))
  }

  if (user && !isAdmin) {
    return (
      <div className="content-container py-8">
        <div className="card p-6 border-amber-200 bg-amber-50">
          <p className="text-amber-800">Only admins can manage users and roles.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50/50 via-white to-emerald-50/50">
      <div className="content-container py-8">
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-sm border border-green-200/50 rounded-full shadow-sm mb-4">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-sm font-medium text-green-700">Manage users</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Users & roles</h1>
          <p className="text-gray-600 mt-1">
            View users and reassign roles. Store Order Pickup User and Store Admin User are for store-associated users.
          </p>
        </div>

        {usersError && (
          <div className="card p-6 border-red-200 bg-red-50 mb-6">
            <p className="text-red-700">{usersError instanceof Error ? usersError.message : "Failed to load users."}</p>
          </div>
        )}

        {usersLoading && (
          <div className="card p-12 text-center text-gray-500">Loading users…</div>
        )}

        {!usersLoading && !usersError && users.length === 0 && (
          <div className="card p-12 text-center text-gray-500">No users found.</div>
        )}

        {!usersLoading && !usersError && users.length > 0 && (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50/80">
                    <th className="px-4 py-3 text-sm font-semibold text-gray-700">User</th>
                    <th className="px-4 py-3 text-sm font-semibold text-gray-700">Current roles</th>
                    <th className="px-4 py-3 text-sm font-semibold text-gray-700">Assign roles</th>
                    <th className="px-4 py-3 text-sm font-semibold text-gray-700">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const currentRoleIds = getCurrentRoleIdsForUser(u)
                    const hasChanges = hasRoleChanges(u)
                    return (
                      <tr key={u.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">{u.email}</p>
                          <p className="text-sm text-gray-500">
                            {[u.first_name, u.last_name].filter(Boolean).join(" ") || "—"}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {(u.rbac_roles ?? []).length === 0
                            ? "No roles"
                            : (u.rbac_roles ?? []).map((r) => r.name).join(", ")}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            {roles.map((r) => {
                              const checked = currentRoleIds.includes(r.id)
                              return (
                                <label
                                  key={r.id}
                                  className="inline-flex items-center gap-1.5 text-sm cursor-pointer"
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={(e) => handleRoleChange(u.id, r.id, e.target.checked)}
                                    className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                                  />
                                  <span className="text-gray-700">{r.name}</span>
                                </label>
                              )
                            })}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            disabled={!hasChanges || savingUserId === u.id}
                            onClick={() =>
                              setRolesMutation.mutate({
                                userId: u.id,
                                roleIds: getCurrentRoleIdsForUser(u),
                              })
                            }
                            className="px-3 py-1.5 text-sm font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {savingUserId === u.id ? "Saving…" : "Save roles"}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
