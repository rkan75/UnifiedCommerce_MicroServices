import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
  Container,
  Heading,
  Button,
  Input,
  Label,
  Select,
  Table,
  Badge,
  toast,
  Drawer,
  Prompt,
} from "@medusajs/ui"
import { Users, Envelope, PencilSquare, Trash } from "@medusajs/icons"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useState, useCallback, useEffect } from "react"

// On GCP, admin and backend may be different origins. Set MEDUSA_BACKEND_URL at build time
// (e.g. in .env: MEDUSA_BACKEND_URL=https://api.yourproject.run.app) or inject window.__MEDUSA_BACKEND_URL__ at runtime.
const getBackendUrl = () => {
  if (typeof window === "undefined") return ""
  const winUrl = (window as any).__MEDUSA_BACKEND_URL__
  return (winUrl || window.location.origin).replace(/\/$/, "")
}

const api = {
  async fetch<T>(path: string, options?: RequestInit): Promise<T> {
    const base = getBackendUrl()
    const url = `${base}${path.startsWith("/") ? path : `/${path}`}`
    const res = await fetch(url, {
      ...options,
      credentials: "include",
      headers: { "Content-Type": "application/json", ...options?.headers },
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }))
      const msg = (err as { message?: string }).message || res.statusText || "Request failed"
      const hint =
        res.status === 0
          ? " Request failed (no response). Check CORS, backend URL (MEDUSA_BACKEND_URL), and that the backend is running."
          : res.status >= 500
            ? " Check backend logs for details."
            : ""
      throw new Error(msg + hint)
    }
    return res.json()
  },
  users: {
    list: async () => {
      const response = await api.fetch<any>("/admin/users?fields=id,email,first_name,last_name,*rbac_roles")
      console.log("Users API response:", response)
      // Medusa Admin API can return { users: [...] } or paginated { users: [...], count: N }
      const users = Array.isArray(response) ? response : (response?.users || [])
      console.log("Extracted users:", users)
      return { users }
    },
    update: (id: string, body: { first_name?: string; last_name?: string }) =>
      api.fetch(`/admin/users/${id}`, { method: "POST", body: JSON.stringify(body) }),
    delete: (id: string) =>
      api.fetch(`/admin/users/${id}`, { method: "DELETE" }),
    setRoles: (id: string, roleIds: string[]) =>
      api.fetch<{ user_id: string; role_ids: string[] }>(`/admin/users/${id}/roles`, {
        method: "POST",
        body: JSON.stringify({ role_ids: roleIds }),
      }),
  },
  roles: {
    list: async () => {
      const response = await api.fetch<any>("/admin/rbac/roles?fields=id,name,description")
      console.log("Roles API response:", response)
      // Medusa Admin API can return { roles: [...] } or paginated { roles: [...], count: N }
      const roles = Array.isArray(response) ? response : (response?.roles || [])
      console.log("Extracted roles:", roles)
      return { roles }
    },
  },
  invites: {
    list: async () => {
      const response = await api.fetch<any>("/admin/invites")
      console.log("Invites API response:", response)
      // Medusa Admin API can return { invites: [...] } or paginated { invites: [...], count: N }
      const invites = Array.isArray(response) ? response : (response?.invites || [])
      console.log("Extracted invites:", invites)
      return { invites }
    },
    create: (email: string) =>
      api.fetch("/admin/invites", { method: "POST", body: JSON.stringify({ email }) }),
  },
}

type AdminUser = {
  id: string
  email: string
  first_name?: string | null
  last_name?: string | null
  rbac_roles?: { id: string; name: string }[]
}

const UserManagementPage = () => {
  const queryClient = useQueryClient()
  const [inviteEmail, setInviteEmail] = useState("")
  const [editUser, setEditUser] = useState<AdminUser | null>(null)
  const [deleteUser, setDeleteUser] = useState<AdminUser | null>(null)

  const { data: usersData, isLoading: usersLoading, error: usersError } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => api.users.list(),
  })
  const { data: rolesData, isLoading: rolesLoading, error: rolesError } = useQuery({
    queryKey: ["admin", "rbac", "roles"],
    queryFn: () => api.roles.list(),
  })
  const { data: invitesData, isLoading: invitesLoading, error: invitesError } = useQuery({
    queryKey: ["admin", "invites"],
    queryFn: () => api.invites.list(),
  })

  useEffect(() => {
    if (usersError) {
      console.error("Failed to fetch users:", usersError)
      toast.error(`Failed to load users: ${usersError instanceof Error ? usersError.message : String(usersError)}`)
    }
  }, [usersError])
  useEffect(() => {
    if (rolesError) {
      console.error("Failed to fetch roles:", rolesError)
      toast.error(`Failed to load roles: ${rolesError instanceof Error ? rolesError.message : String(rolesError)}`)
    }
  }, [rolesError])
  useEffect(() => {
    if (invitesError) {
      console.error("Failed to fetch invites:", invitesError)
      toast.error(`Failed to load invites: ${invitesError instanceof Error ? invitesError.message : String(invitesError)}`)
    }
  }, [invitesError])

  const inviteMutation = useMutation({
    mutationFn: (email: string) => api.invites.create(email),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "invites"] })
      setInviteEmail("")
      toast.success("Invite sent")
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const updateUserMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: { first_name?: string; last_name?: string } }) =>
      api.users.update(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] })
      setEditUser(null)
      toast.success("User updated")
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const setRolesMutation = useMutation({
    mutationFn: ({ userId, roleIds }: { userId: string; roleIds: string[] }) =>
      api.users.setRoles(userId, roleIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] })
      setEditUser(null)
      toast.success("Role updated")
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const deleteUserMutation = useMutation({
    mutationFn: (id: string) => api.users.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] })
      setDeleteUser(null)
      toast.success("User removed")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  // Extract data from response objects
  const users = usersData?.users ?? []
  const roles = rolesData?.roles ?? []
  const invites = invitesData?.invites ?? []
  const pendingInvites = invites.filter((i) => !i.accepted)

  const handleInvite = useCallback(() => {
    const email = inviteEmail.trim()
    if (!email) return
    inviteMutation.mutate(email)
  }, [inviteEmail, inviteMutation])

  const handleRoleChange = useCallback(
    (user: AdminUser, roleId: string) => {
      // Use "__none__" as special value to represent "no role"
      const newRoleIds = roleId && roleId !== "__none__" ? [roleId] : []
      setRolesMutation.mutate({ userId: user.id, roleIds: newRoleIds })
    },
    [setRolesMutation]
  )

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h1">User & Role Management</Heading>
      </div>

      {/* Invite */}
      <div className="px-6 py-4">
        <Heading level="h2" className="mb-3">
          Invite user
        </Heading>
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              placeholder="user@example.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="w-64"
            />
          </div>
          <Button
            onClick={handleInvite}
            disabled={!inviteEmail.trim() || inviteMutation.isPending}
          >
            <Envelope /> Send invite
          </Button>
        </div>
        {pendingInvites.length > 0 && (
          <div className="mt-4">
            <Label className="text-ui-fg-subtle">Pending invites</Label>
            <ul className="mt-1 flex flex-wrap gap-2">
              {pendingInvites.map((inv) => (
                <Badge key={inv.id} color="grey" size="small">
                  {inv.email}
                </Badge>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Users table */}
      <div className="px-6 py-4">
        <Heading level="h2" className="mb-3">
          Users
        </Heading>
        {usersError && (
          <p className="text-ui-fg-error text-sm mb-2">
            Error loading users: {usersError instanceof Error ? usersError.message : String(usersError)}
          </p>
        )}
        {rolesError && (
          <p className="text-ui-fg-error text-sm mb-2">
            Error loading roles: {rolesError instanceof Error ? rolesError.message : String(rolesError)}
          </p>
        )}
        {usersLoading ? (
          <p className="text-ui-fg-subtle">Loading users…</p>
        ) : (
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>User</Table.HeaderCell>
                <Table.HeaderCell>Role</Table.HeaderCell>
                <Table.HeaderCell className="w-[100px]">Actions</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {users.map((user) => (
                <Table.Row key={user.id}>
                  <Table.Cell>
                    <div>
                      <span className="font-medium">
                        {[user.first_name, user.last_name].filter(Boolean).join(" ") || "—"}
                      </span>
                      <span className="text-ui-fg-subtle ml-1">({user.email})</span>
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <Select
                      value={user.rbac_roles?.[0]?.id ?? "__none__"}
                      onValueChange={(value) => handleRoleChange(user, value)}
                      disabled={rolesLoading || roles.length === 0}
                    >
                      <Select.Trigger className="w-[200px]">
                        <Select.Value placeholder="Select role" />
                      </Select.Trigger>
                      <Select.Content>
                        <Select.Item value="__none__">
                          No role
                        </Select.Item>
                        {roles.map((role) => (
                          <Select.Item key={role.id} value={role.id}>
                            {role.name}
                          </Select.Item>
                        ))}
                      </Select.Content>
                    </Select>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex gap-1">
                      <Button
                        size="small"
                        variant="transparent"
                        onClick={() => setEditUser(user)}
                      >
                        <PencilSquare />
                      </Button>
                      <Button
                        size="small"
                        variant="transparent"
                        onClick={() => setDeleteUser(user)}
                      >
                        <Trash />
                      </Button>
                    </div>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        )}
        {!usersLoading && users.length === 0 && (
          <p className="text-ui-fg-subtle">No users yet. Invite someone above.</p>
        )}
        {!rolesLoading && roles.length === 0 && (
          <p className="text-ui-fg-muted mt-2 text-sm">
            No roles found. Enable RBAC (MEDUSA_FF_RBAC=true) and create roles via Admin API or seed.
          </p>
        )}
      </div>

      {/* Edit user drawer */}
      <Drawer open={!!editUser} onOpenChange={(open) => !open && setEditUser(null)}>
        <Drawer.Content>
          <Drawer.Header>
            <Heading level="h2">Edit user</Heading>
          </Drawer.Header>
          {editUser && (
            <div className="flex flex-col gap-4 px-6 pb-6">
              <div className="flex flex-col gap-2">
                <Label>Email</Label>
                <Input value={editUser.email} disabled />
              </div>
              <div className="flex flex-col gap-2">
                <Label>First name</Label>
                <Input
                  defaultValue={editUser.first_name ?? ""}
                  onBlur={(e) => {
                    const v = e.target.value.trim()
                    if (v !== (editUser.first_name ?? ""))
                      updateUserMutation.mutate({
                        id: editUser.id,
                        body: { first_name: v || undefined },
                      })
                  }}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Last name</Label>
                <Input
                  defaultValue={editUser.last_name ?? ""}
                  onBlur={(e) => {
                    const v = e.target.value.trim()
                    if (v !== (editUser.last_name ?? ""))
                      updateUserMutation.mutate({
                        id: editUser.id,
                        body: { last_name: v || undefined },
                      })
                  }}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Role</Label>
                <Select
                  value={editUser.rbac_roles?.[0]?.id ?? "__none__"}
                  onValueChange={(value) => handleRoleChange(editUser, value)}
                >
                  <Select.Trigger>
                    <Select.Value placeholder="Select role" />
                  </Select.Trigger>
                  <Select.Content>
                    <Select.Item value="__none__">No role</Select.Item>
                    {roles.map((role) => (
                      <Select.Item key={role.id} value={role.id}>
                        {role.name}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select>
              </div>
            </div>
          )}
        </Drawer.Content>
      </Drawer>

      {/* Delete user prompt */}
      <Prompt open={!!deleteUser} onOpenChange={(open) => !open && setDeleteUser(null)}>
        <Prompt.Content>
          <Prompt.Header>
            <Prompt.Title>Delete user</Prompt.Title>
            <Prompt.Description>
              Remove {deleteUser?.email}? This cannot be undone.
            </Prompt.Description>
          </Prompt.Header>
          <Prompt.Footer>
            <Prompt.Cancel onClick={() => setDeleteUser(null)}>Cancel</Prompt.Cancel>
            <Prompt.Action
              onClick={() => deleteUser && deleteUserMutation.mutate(deleteUser.id)}
              className="bg-ui-tag-red-bg text-ui-tag-red-text hover:bg-ui-tag-red-bg-hover"
            >
              Delete
            </Prompt.Action>
          </Prompt.Footer>
        </Prompt.Content>
      </Prompt>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "User & Role Management",
  icon: Users,
})

export const handle = {
  breadcrumb: () => "User & Role Management",
}

export default UserManagementPage
