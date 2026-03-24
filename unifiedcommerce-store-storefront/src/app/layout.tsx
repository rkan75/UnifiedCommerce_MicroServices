import { getBaseURL } from "@lib/util/env"
import AnalyticsProvider from "@modules/common/components/analytics-provider"
import { Metadata, Viewport } from "next"
import "styles/globals.css"

export const metadata: Metadata = {
  metadataBase: new URL(getBaseURL()),
  title: {
    default: "GNC Store",
    template: "%s | GNC Store",
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
}

export default function RootLayout(props: { children: React.ReactNode }) {
  return (
    <html lang="en" data-mode="light">
      <body>
        <AnalyticsProvider>
          <main className="relative">{props.children}</main>
        </AnalyticsProvider>
      </body>
    </html>
  )
}
