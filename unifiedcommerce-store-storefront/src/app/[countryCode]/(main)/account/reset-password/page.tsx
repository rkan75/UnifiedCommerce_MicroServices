import { Metadata } from "next"

import ResetPasswordForm from "@modules/account/components/reset-password-form"

export const metadata: Metadata = {
  title: "Reset password",
  description: "Set a new password for your account.",
}

type Props = {
  searchParams: Promise<{ token?: string; email?: string }>
}

export default async function ResetPasswordPage({ searchParams }: Props) {
  const params = await searchParams
  const token = (params.token ?? "").trim()
  const email = (params.email ?? "").trim()

  if (!token) {
    return (
      <div className="max-w-sm w-full flex flex-col items-center px-8 py-8">
        <h1 className="text-large-semi uppercase mb-6">Invalid link</h1>
        <p className="text-center text-base-regular text-ui-fg-base mb-8">
          This reset link is invalid or has expired. Please request a new password reset from the sign in page.
        </p>
        <a
          href="/account"
          className="text-small-regular text-ui-fg-interactive hover:underline"
        >
          Back to sign in
        </a>
      </div>
    )
  }

  return (
    <div className="w-full flex justify-start px-8 py-8">
      <ResetPasswordForm token={token} email={email} />
    </div>
  )
}
