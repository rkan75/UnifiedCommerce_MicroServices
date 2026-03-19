"use client"

import { trackPageView } from "@lib/analytics/track"
import { usePathname } from "next/navigation"
import { useEffect, useRef } from "react"

/**
 * Tracks page views via our /api/analytics -> GA4 Measurement Protocol.
 * Ad-block resilient (no gtag or direct requests to Google in the browser).
 * Only runs when NEXT_PUBLIC_GA_MEASUREMENT_ID is set.
 */
export default function AnalyticsProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const prevPath = useRef<string | null>(null)

  useEffect(() => {
    if (!pathname) return
    // Avoid duplicate on first mount if layout also runs
    if (prevPath.current === pathname) return
    prevPath.current = pathname
    trackPageView(pathname, typeof document !== "undefined" ? document.title : "")
  }, [pathname])

  return <>{children}</>
}
