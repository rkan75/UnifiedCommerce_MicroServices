import { login, requestPasswordReset, signup } from "@lib/data/customer"
import LoginTemplate from "@modules/account/templates/login-template"

/**
 * Fallback when Next.js cannot recover the @login slot state (e.g. hard nav to /account).
 * Ensures the sign-in page is shown when navigating to account.
 */
export default function DefaultLoginSlot() {
  return (
    <LoginTemplate
      loginAction={login}
      signupAction={signup}
      requestPasswordResetAction={requestPasswordReset}
    />
  )
}
