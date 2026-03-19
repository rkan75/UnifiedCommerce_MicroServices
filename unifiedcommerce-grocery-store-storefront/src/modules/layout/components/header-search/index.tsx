"use client"

import { Component, ReactNode } from "react"
import { clx } from "@medusajs/ui"
import { isAlgoliaConfigured } from "@lib/algolia/config"
import AlgoliaSearch from "@modules/search/components/algolia-search"
import FallbackSearch from "./fallback-search"

interface ErrorBoundaryState {
  hasError: boolean
}

class AlgoliaErrorBoundary extends Component<
  { children: ReactNode; className?: string },
  ErrorBoundaryState
> {
  constructor(props: { children: ReactNode; className?: string }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: any): ErrorBoundaryState {
    // Check if it's an Algolia referer/API error
    if (
      error?.message?.includes("referer") ||
      error?.message?.includes("Method not allowed") ||
      error?.message?.includes("403") ||
      error?.message?.includes("401")
    ) {
      if (process.env.NODE_ENV === "development") {
        console.error(
          "[Algolia] API Error - Referer restrictions detected.",
          "\nTo fix:",
          "\n1. Go to Algolia Dashboard → Settings → API Keys",
          "\n2. Find your Search-Only API Key",
          "\n3. Click 'Edit' or 'Restrict sources'",
          "\n4. Add allowed referers:",
          `   - http://localhost:8000 (development)`,
          `   - https://yourdomain.com (production)`,
          "\n5. Or remove referer restrictions for testing"
        )
      }
      return { hasError: true }
    }
    // Re-throw if it's not an Algolia error
    throw error
  }

  componentDidCatch(error: Error, errorInfo: any) {
    // Log error for debugging
    if (process.env.NODE_ENV === "development") {
      console.error("[Algolia Error Boundary]", error, errorInfo)
    }
  }

  render() {
    if (this.state.hasError) {
      return <FallbackSearch className={this.props.className} />
    }

    return this.props.children
  }
}

export default function HeaderSearch({ className }: { className?: string }) {
  // Use Algolia if configured, otherwise fall back to basic search
  if (!isAlgoliaConfigured) {
    return <FallbackSearch className={className} />
  }

  // Wrap AlgoliaSearch in error boundary to catch API errors and fall back gracefully
  return (
    <AlgoliaErrorBoundary className={className}>
      <AlgoliaSearch className={className} />
    </AlgoliaErrorBoundary>
  )
}
