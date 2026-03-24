/**
 * Store associate auth: token stored in localStorage.
 * Login via POST /auth/user/emailpass returns { token }; we store it and send Authorization: Bearer on API calls.
 */

const TOKEN_KEY = "medusa_backoffice_token"

export function getToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

export function isAuthenticated(): boolean {
  return !!getToken()
}
