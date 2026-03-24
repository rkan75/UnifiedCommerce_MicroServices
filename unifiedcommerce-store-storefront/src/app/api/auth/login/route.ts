import { NextResponse } from "next/server"

const MEDUSA_BACKEND_URL =
  process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || ""
const COOKIE_NAME = "_medusa_jwt"
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7 // 7 days

/**
 * POST /api/auth/login
 * Form body: email, password, country_code
 * On success: sets auth cookie and redirects to /{country_code}/account
 * On failure: redirects to /{country_code}/account?login_error=1
 */
export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const email = (formData.get("email") as string)?.trim()
    const password = formData.get("password") as string
    const countryCode = (formData.get("country_code") as string)?.trim() || "us"

    if (!email || !password) {
      return redirectToAccount(request.url, countryCode, "missing")
    }

    const tryLogin = async (emailToTry: string) => {
      const res = await fetch(`${MEDUSA_BACKEND_URL}/auth/customer/emailpass`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(PUBLISHABLE_KEY
            ? { "x-publishable-api-key": PUBLISHABLE_KEY }
            : {}),
        },
        body: JSON.stringify({ email: emailToTry, password }),
      })
      const data = (await res.json().catch(() => ({}))) as { token?: string }
      return { ok: res.ok, token: data.token }
    }

    let result = await tryLogin(email)
    if (!result.ok && email !== email.toLowerCase()) {
      result = await tryLogin(email.toLowerCase())
    }
    if (!result.ok || !result.token) {
      return redirectToAccount(request.url, countryCode, "invalid")
    }

    const redirectUrl = new URL(`/${countryCode}/account`, request.url)
    const response = NextResponse.redirect(redirectUrl, 302)

    response.cookies.set(COOKIE_NAME, result.token, {
      path: "/",
      maxAge: COOKIE_MAX_AGE,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    })

    return response
  } catch {
    return redirectToAccount(request.url, "us", "error")
  }
}

function redirectToAccount(origin: string, countryCode: string, error: string) {
  const url = new URL(`/${countryCode}/account`, origin)
  url.searchParams.set("login_error", error)
  return NextResponse.redirect(url, 302)
}
