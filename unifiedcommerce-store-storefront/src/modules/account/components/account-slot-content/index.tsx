"use client"

import { useParams, usePathname } from "next/navigation"

type Props = {
  customer: boolean
  dashboard: React.ReactNode
  login: React.ReactNode
  children: React.ReactNode
}

/**
 * Renders dashboard (overview, profile, addresses, orders) or login.
 * When logged in, always show the dashboard slot – it resolves to the correct
 * sub-page (overview, profile, addresses, orders) from the URL. Only show
 * children for routes like reset-password that live outside the dashboard slot.
 */
export default function AccountSlotContent({
  customer,
  dashboard,
  login,
  children,
}: Props) {
  const pathname = usePathname()
  const { countryCode } = useParams()
  const accountRoot = `/${countryCode}/account`
  const isAccountRoot =
    pathname === accountRoot || pathname === `${accountRoot}/`
  const isResetPassword = pathname?.includes("/account/reset-password") ?? false

  if (!customer) {
    return isResetPassword ? <>{children}</> : <>{login}</>
  }
  if (isResetPassword) {
    return <>{children}</>
  }
  return <>{dashboard}</>
}
