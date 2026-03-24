"use client"

import { useState } from "react"

import ForgotPassword from "@modules/account/components/forgot-password"
import Register from "@modules/account/components/register"
import Login from "@modules/account/components/login"

export enum LOGIN_VIEW {
  SIGN_IN = "sign-in",
  REGISTER = "register",
  FORGOT_PASSWORD = "forgot-password",
}

type LoginTemplateProps = {
  loginAction: (prevState: unknown, formData: FormData) => Promise<string | unknown>
  signupAction: (prevState: unknown, formData: FormData) => Promise<unknown>
  requestPasswordResetAction: (prevState: unknown, formData: FormData) => Promise<string>
}

const LoginTemplate = ({
  loginAction,
  signupAction,
  requestPasswordResetAction,
}: LoginTemplateProps) => {
  const [currentView, setCurrentView] = useState<LOGIN_VIEW>("sign-in")

  return (
    <div className="w-full flex justify-start px-8 py-8">
      {currentView === "sign-in" && (
        <Login setCurrentView={setCurrentView} loginAction={loginAction} />
      )}
      {currentView === "register" && (
        <Register setCurrentView={setCurrentView} signupAction={signupAction} />
      )}
      {currentView === "forgot-password" && (
        <ForgotPassword
          setCurrentView={setCurrentView}
          requestPasswordResetAction={requestPasswordResetAction}
        />
      )}
    </div>
  )
}

export default LoginTemplate
