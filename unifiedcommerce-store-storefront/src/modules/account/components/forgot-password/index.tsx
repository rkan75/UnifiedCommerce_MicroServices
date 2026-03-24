"use client"

import { LOGIN_VIEW } from "@modules/account/templates/login-template"
import ErrorMessage from "@modules/checkout/components/error-message"
import { SubmitButton } from "@modules/checkout/components/submit-button"
import Input from "@modules/common/components/input"
import { useActionState } from "react"

type Props = {
  setCurrentView: (view: LOGIN_VIEW) => void
  requestPasswordResetAction: (prevState: unknown, formData: FormData) => Promise<string>
}

const ForgotPassword = ({ setCurrentView, requestPasswordResetAction }: Props) => {
  const [message, formAction] = useActionState(requestPasswordResetAction, null)

  const isSuccess = message === "success"

  return (
    <div
      className="max-w-sm w-full flex flex-col items-center"
      data-testid="forgot-password-page"
    >
      <h1 className="text-large-semi uppercase mb-6">Forgot password</h1>
      <p className="text-center text-base-regular text-ui-fg-base mb-8">
        Enter the email address associated with your account and we’ll send you a link to reset your password.
      </p>
      {isSuccess ? (
        <div className="w-full space-y-4">
          <p className="text-small-regular text-ui-fg-base">
            If an account exists with that email, you will receive instructions to reset your password. Please check your inbox and spam folder.
          </p>
          <button
            type="button"
            onClick={() => setCurrentView(LOGIN_VIEW.SIGN_IN)}
            className="w-full py-2.5 px-4 rounded-md bg-ui-button-neutral hover:bg-ui-button-neutral-hover text-ui-fg-base txt-small-medium transition-colors"
            data-testid="back-to-sign-in"
          >
            Back to sign in
          </button>
        </div>
      ) : (
        <form className="w-full" action={formAction}>
          <div className="flex flex-col w-full gap-y-2">
            <Input
              label="Email"
              name="email"
              type="email"
              title="Enter a valid email address."
              autoComplete="email"
              required
              data-testid="forgot-password-email-input"
            />
          </div>
          <ErrorMessage error={message === "success" ? null : message} data-testid="forgot-password-error-message" />
          <SubmitButton data-testid="forgot-password-submit-button" className="w-full mt-6">
            Send reset link
          </SubmitButton>
        </form>
      )}
      <span className="text-center text-ui-fg-base text-small-regular mt-6">
        Remember your password?{" "}
        <button
          type="button"
          onClick={() => setCurrentView(LOGIN_VIEW.SIGN_IN)}
          className="underline"
          data-testid="back-to-sign-in-link"
        >
          Sign in
        </button>
      </span>
    </div>
  )
}

export default ForgotPassword
