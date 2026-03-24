/**
 * Create store user — form to create a new store user (email, password, name, store).
 * Access: admins or Store Admin User role. Store Admin Users can only create users for their own store.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"
import { useState, useMemo } from "react"
import { api, type StoreLocation, type RbacRole } from "@/lib/api"
import { useToast } from "@medusajs/ui"

const STORE_ROLE_NAMES = ["Store Order Pickup User", "Store Admin User"]

function filterStores(stores: StoreLocation[], query: string): StoreLocation[] {
  const q = query.trim().toLowerCase()
  if (!q) return stores
  return stores.filter(
    (s) =>
      s.name?.toLowerCase().includes(q) ||
      s.id?.toLowerCase().includes(q) ||
      s.address_1?.toLowerCase().includes(q) ||
      s.city?.toLowerCase().includes(q) ||
      s.state?.toLowerCase().includes(q) ||
      s.zip?.toLowerCase().includes(q)
  )
}

export default function CreateStoreUserPage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [storeSearch, setStoreSearch] = useState("")
  const [selectedStoreId, setSelectedStoreId] = useState("")
  const [manualStoreId, setManualStoreId] = useState("")
  const [selectedRoleId, setSelectedRoleId] = useState("")

  const { data: meData } = useQuery({
    queryKey: ["admin", "me"],
    queryFn: () => api.me(),
  })
  const user = meData?.user
  const isAdmin = user?.is_admin ?? false
  const canCreateStoreUser = user?.is_admin ?? user?.can_create_store_user ?? false
  /** Same as route/sidebar: allow when admin OR has create-store-user permission */
  const canAccessPage = !!(user && (user.is_admin || user.can_create_store_user))
  const isStoreAdminUser = !isAdmin && canCreateStoreUser && !!user?.store_id
  const storeId = isStoreAdminUser ? (user?.store_id ?? "") : (manualStoreId.trim() || selectedStoreId)

  const { data: storesData } = useQuery({
    queryKey: ["admin", "store-locations"],
    queryFn: () => api.storeLocations(),
    enabled: canCreateStoreUser,
  })
  const storeLocations: StoreLocation[] = storesData?.store_locations ?? []
  const filteredStores = useMemo(() => filterStores(storeLocations, storeSearch), [storeLocations, storeSearch])

  const { data: rolesData } = useQuery({
    queryKey: ["admin", "roles"],
    queryFn: () => api.roles.list(),
    enabled: canCreateStoreUser,
  })
  const allRoles: RbacRole[] = rolesData?.roles ?? []
  const storeRoles = useMemo(
    () => allRoles.filter((r) => STORE_ROLE_NAMES.includes(r.name)),
    [allRoles]
  )
  const defaultRoleId = storeRoles.find((r) => r.name === "Store Order Pickup User")?.id ?? storeRoles[0]?.id ?? ""

  const createMutation = useMutation({
    mutationFn: () =>
      api.storeUsers.create({
        email: email.trim(),
        password,
        first_name: firstName.trim() || undefined,
        last_name: lastName.trim() || undefined,
        store_id: storeId,
        role_id: selectedRoleId || defaultRoleId || undefined,
      }),
    onSuccess: () => {
      toast({ title: "Success", description: "Store user created. They can log in with the backoffice using this email and password." })
      setEmail("")
      setPassword("")
      setFirstName("")
      setLastName("")
      setStoreSearch("")
      setSelectedStoreId("")
      setManualStoreId("")
      setSelectedRoleId("")
      queryClient.invalidateQueries({ queryKey: ["admin", "me"] })
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] })
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "error" })
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password || !storeId) {
      toast({ title: "Error", description: "Email, password, and store are required.", variant: "error" })
      return
    }
    if (password.length < 8) {
      toast({ title: "Error", description: "Password must be at least 8 characters.", variant: "error" })
      return
    }
    createMutation.mutate()
  }

  if (user && !canAccessPage) {
    return (
      <div className="content-container py-8">
        <div className="card p-6 border-amber-200 bg-amber-50">
          <p className="text-amber-800">Only admins or Store Admin Users can create store users.</p>
          <button
            type="button"
            onClick={() => navigate("/orders")}
            className="mt-4 text-sm font-medium text-green-700 hover:text-green-800"
          >
            Back to orders
          </button>
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
            <span className="text-sm font-medium text-green-700">Create store user</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Create store user</h1>
          <p className="text-gray-600 mt-1">
            Add a user who can log in to the backoffice and see only orders for the selected store.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="card p-6 max-w-lg">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Store <span className="text-red-500">*</span>
              </label>
              {isStoreAdminUser ? (
                <p className="text-sm text-gray-700 py-2">
                  Your store: <strong>{storeLocations.find((s) => s.id === user?.store_id)?.name ?? user?.store_id}</strong>
                  {user?.store_id && <span className="block text-xs text-gray-500 mt-0.5">ID: {user.store_id}</span>}
                </p>
              ) : (
                <>
                  <p className="text-xs text-gray-500 mb-2">
                    Search from store locator or enter store ID below.
                  </p>
                  <input
                    type="text"
                    value={storeSearch}
                    onChange={(e) => setStoreSearch(e.target.value)}
                    placeholder="Search by name, address, city, state, zip, or ID"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 mb-2"
                    aria-label="Search stores"
                  />
                  <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50/50 mb-3">
                    {filteredStores.length === 0 ? (
                      <p className="px-3 py-4 text-sm text-gray-500 text-center">
                        {storeSearch.trim() ? "No stores match your search." : "No stores in store locator."}
                      </p>
                    ) : (
                      <ul className="py-1">
                        {filteredStores.map((s) => (
                          <li key={s.id}>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedStoreId(s.id)
                                setManualStoreId("")
                              }}
                              className={`w-full text-left px-3 py-2 text-sm hover:bg-green-50 ${selectedStoreId === s.id && !manualStoreId.trim() ? "bg-green-100 text-green-900 font-medium" : "text-gray-800"}`}
                            >
                              <span className="font-medium">{s.name}</span>
                              {(s.address_1 || s.city) && (
                                <span className="block text-gray-500 truncate">
                                  {[s.address_1, s.city, s.state, s.zip].filter(Boolean).join(", ")}
                                </span>
                              )}
                              <span className="text-xs text-gray-400 block">{s.id}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <label htmlFor="store_id_manual" className="block text-xs font-medium text-gray-600 mb-1">
                      Or enter store number / ID
                    </label>
                    <input
                      id="store_id_manual"
                      type="text"
                      value={manualStoreId}
                      onChange={(e) => {
                        setManualStoreId(e.target.value)
                        if (e.target.value.trim()) setSelectedStoreId("")
                      }}
                      placeholder="e.g. stloc_01ABC..."
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      aria-label="Store ID"
                    />
                  </div>
                  {storeId && (
                    <p className="mt-2 text-xs text-green-700">
                      Selected store: <code className="bg-green-50 px-1 rounded">{storeId}</code>
                    </p>
                  )}
                </>
              )}
            </div>
            <div>
              <label htmlFor="role-select" className="block text-sm font-medium text-gray-700 mb-1">
                Role
              </label>
              <select
                id="role-select"
                value={selectedRoleId || defaultRoleId}
                onChange={(e) => setSelectedRoleId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
              >
                {storeRoles.length === 0 ? (
                  <option value="">No store roles found (seed RBAC first)</option>
                ) : (
                  storeRoles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                      {r.description ? ` — ${r.description}` : ""}
                    </option>
                  ))
                )}
              </select>
              <p className="mt-1 text-xs text-gray-500">
                Store Order Pickup User: pick orders and adjust weights. Store Admin User: admin capabilities for the store.
              </p>
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@store.com"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password <span className="text-red-500">*</span>
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="first_name" className="block text-sm font-medium text-gray-700 mb-1">
                  First name
                </label>
                <input
                  id="first_name"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
              </div>
              <div>
                <label htmlFor="last_name" className="block text-sm font-medium text-gray-700 mb-1">
                  Last name
                </label>
                <input
                  id="last_name"
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
              </div>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 focus:ring-2 focus:ring-green-500 disabled:opacity-50"
            >
              {createMutation.isPending ? "Creating…" : "Create store user"}
            </button>
            <button
              type="button"
              onClick={() => navigate("/orders")}
              className="text-sm font-medium text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
