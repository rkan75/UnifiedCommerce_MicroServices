"use client"

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react"

import type { HttpTypes } from "@medusajs/types"
import { parseSubscribeSaveOptOutKeys } from "@lib/config/subscribe-save-metadata"

const SubscribeSaveBlockContext = createContext<Set<string>>(new Set())

export function SubscribeSaveBlockProvider({
  customer,
  children,
}: {
  customer: HttpTypes.StoreCustomer | null
  children: ReactNode
}) {
  const keys = useMemo(
    () =>
      parseSubscribeSaveOptOutKeys(
        customer?.metadata as Record<string, unknown> | null | undefined
      ),
    [customer?.metadata]
  )

  return (
    <SubscribeSaveBlockContext.Provider value={keys}>
      {children}
    </SubscribeSaveBlockContext.Provider>
  )
}

export function useSubscribeSaveOptOutKeys(): Set<string> {
  return useContext(SubscribeSaveBlockContext)
}
