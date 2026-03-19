import { LOGIN_VIEW } from "@modules/account/templates/login-template"
import ErrorMessage from "@modules/checkout/components/error-message"
import { SubmitButton } from "@modules/checkout/components/submit-button"
import Input from "@modules/common/components/input"
import { useParams, useSearchParams } from "next/navigation"

const LOGIN_ERROR_MESSAGES: Record<string, string> = {
  missing: "Please enter your email and password.",
  invalid: "Invalid email or password.",
  error: "Something went wrong. Please try again.",
}

type Props = {
  setCurrentView: (view: LOGIN_VIEW) => void
  loginAction?: (prevState: unknown, formData: FormData) => Promise<string | unknown>
}

const Login = ({ setCurrentView }: Props) => {
  const params = useParams()
  const searchParams = useSearchParams()
  const countryCode = (params?.countryCode as string) || "us"
  const loginError = searchParams.get("login_error")
  const errorMessage = loginError ? LOGIN_ERROR_MESSAGES[loginError] ?? "Sign in failed." : null

  return (
    <div
      className="max-w-sm w-full flex flex-col items-center"
      data-testid="login-page"
    >
      <h1 className="text-large-semi uppercase mb-6">Welcome back</h1>
      <p className="text-center text-base-regular text-ui-fg-base mb-8">
        Sign in to access an enhanced shopping experience.
      </p>
      <form className="w-full" action="/api/auth/login" method="POST">
        <input type="hidden" name="country_code" value={countryCode} />
        <div className="flex flex-col w-full gap-y-2">
          <Input
            label="Email"
            name="email"
            type="email"
            title="Enter a valid email address."
            autoComplete="email"
            required
            data-testid="email-input"
          />
          <Input
            label="Password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            data-testid="password-input"
          />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setCurrentView(LOGIN_VIEW.FORGOT_PASSWORD)}
              className="text-small-regular text-ui-fg-interactive hover:underline"
              data-testid="forgot-password-button"
            >
              Forgot password?
            </button>
          </div>
        </div>
        <ErrorMessage error={errorMessage} data-testid="login-error-message" />
        <SubmitButton data-testid="sign-in-button" className="w-full mt-6">
          Sign in
        </SubmitButton>
      </form>
      <span className="text-center text-ui-fg-base text-small-regular mt-6">
        Not a member?{" "}
        <button
          onClick={() => setCurrentView(LOGIN_VIEW.REGISTER)}
          className="underline"
          data-testid="register-button"
        >
          Join us
        </button>
        .
      </span>
    </div>
  )
}

export default Login
