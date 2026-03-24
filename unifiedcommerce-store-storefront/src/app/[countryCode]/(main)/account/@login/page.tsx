import { login, requestPasswordReset, signup } from "@lib/data/customer"
import { Metadata } from "next"

import LoginTemplate from "@modules/account/templates/login-template"

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your TCS UnifiedCommerce Store account.",
}

export default function LoginPage() {
  return (
    <LoginTemplate
      loginAction={login}
      signupAction={signup}
      requestPasswordResetAction={requestPasswordReset}
    />
  )
}
