"use client"

import { resetPasswordWithToken } from "@lib/data/customer"
import ErrorMessage from "@modules/checkout/components/error-message"
import Input from "@modules/common/components/input"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { useParams } from "next/navigation"
import { useState } from "react"

type Props = {
  token: string
  email: string
}

export default function ResetPasswordForm({ token, email }: Props) {
  const { countryCode } = useParams()
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password !== confirm) {
      setError("Passwords do not match.")
      return
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.")
      return
    }
    setLoading(true)
    const result = await resetPasswordWithToken(token, email, password)
    setLoading(false)
    if (result.success) {
      setSuccess(true)
    } else {
      setError(result.error ?? "Could not reset password.")
    }
  }

  if (success) {
    return (
      <div className="max-w-sm w-full flex flex-col items-center" data-testid="reset-password-success">
        <h1 className="text-large-semi uppercase mb-6">Password reset</h1>
        <p className="text-center text-base-regular text-ui-fg-base mb-8">
          Your password has been updated. You can now sign in with your new password.
        </p>
        <LocalizedClientLink
          href="/account"
          className="w-full py-2.5 px-4 rounded-md bg-ui-button-neutral hover:bg-ui-button-neutral-hover text-ui-fg-base txt-small-medium text-center transition-colors"
          data-testid="reset-password-sign-in-link"
        >
          Sign in
        </LocalizedClientLink>
      </div>
    )
  }

  return (
    <div className="max-w-sm w-full flex flex-col items-center" data-testid="reset-password-page">
      <h1 className="text-large-semi uppercase mb-6">Set new password</h1>
      <p className="text-center text-base-regular text-ui-fg-base mb-8">
        Enter your new password below.
      </p>
      <form className="w-full" onSubmit={handleSubmit}>
        <div className="flex flex-col w-full gap-y-2">
          <Input
            label="New password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            data-testid="reset-password-input"
          />
          <Input
            label="Confirm password"
            name="confirm_password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            data-testid="reset-password-confirm-input"
          />
        </div>
        <ErrorMessage error={error} data-testid="reset-password-error-message" />
        <button
          type="submit"
          disabled={loading}
          className="w-full mt-6 py-2.5 px-4 rounded-md bg-ui-button-neutral hover:bg-ui-button-neutral-hover disabled:opacity-50 txt-small-medium transition-colors"
          data-testid="reset-password-submit-button"
        >
          {loading ? "Updating…" : "Reset password"}
        </button>
      </form>
      <span className="text-center text-ui-fg-base text-small-regular mt-6">
        <LocalizedClientLink href="/account" className="underline">
          Back to sign in
        </LocalizedClientLink>
      </span>
    </div>
  )
}
