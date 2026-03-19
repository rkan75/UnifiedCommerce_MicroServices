import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
  Container,
  Heading,
  Button,
  Input,
  Label,
  Table,
  toast,
  Badge,
} from "@medusajs/ui"
import { CurrencyDollar, MagnifyingGlass } from "@medusajs/icons"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState, useCallback } from "react"

const getBackendUrl = () => {
  if (typeof window === "undefined") return ""
  const winUrl = (window as any).__MEDUSA_BACKEND_URL__
  const origin = (winUrl || window.location.origin).replace(/\/$/, "")
  return origin
}

const api = {
  async fetch<T>(path: string, options?: RequestInit): Promise<T> {
    const base = getBackendUrl()
    const url = `${base}${path.startsWith("/") ? path : `/${path}`}`
    const res = await fetch(url, {
      ...options,
      credentials: "include",
      headers: { "Content-Type": "application/json", ...options?.headers },
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }))
      throw new Error((err as { message?: string }).message || "Request failed")
    }
    return res.json()
  },
  priceUpdate: {
    search: (q: string) =>
      api.fetch<{ products: ProductWithVariants[] }>(`/admin/price-update/search?q=${encodeURIComponent(q)}`),
    updatePrices: (variantPrices: VariantPricePayload[]) =>
      api.fetch<{ success: boolean; updated: number }>("/admin/price-update/variants/prices", {
        method: "POST",
        body: JSON.stringify({ variantPrices }),
      }),
  },
}

type Price = { id?: string; amount: number; currency_code: string }
type Variant = {
  id: string
  title: string
  sku?: string | null
  prices?: Price[]
}
type ProductWithVariants = {
  id: string
  title: string
  variants?: Variant[]
}
type VariantPricePayload = { variant_id: string; product_id: string; prices: { id?: string; amount: number; currency_code: string }[] }

function amountToDisplay(amount: number): string {
  if (amount == null || typeof amount !== "number") return ""
  return (amount / 100).toFixed(2)
}

function displayToAmount(value: string): number {
  const n = parseFloat(value)
  if (Number.isNaN(n) || n < 0) return 0
  return Math.round(n * 100)
}

const USD = "usd"

/** Get the USD price from a variant's prices, or undefined if none. */
function getUsdPrice(variant: Variant): Price | undefined {
  return variant.prices?.find((p) => (p.currency_code ?? "").toLowerCase() === USD)
}

/** Variants that have a USD price (show only these in the table). */
function variantsWithUsd(product: ProductWithVariants): Variant[] {
  return (product.variants ?? []).filter((v) => getUsdPrice(v) !== undefined)
}

const PriceUpdatePage = () => {
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<ProductWithVariants[]>([])
  const [selectedProduct, setSelectedProduct] = useState<ProductWithVariants | null>(null)
  const [variantPrices, setVariantPrices] = useState<Record<string, string>>({}) // variantId -> display price string per first price
  const [searching, setSearching] = useState(false)

  const searchProducts = useCallback(async () => {
    const q = searchQuery.trim()
    if (!q) {
      toast.error("Enter a product ID or name to search.")
      return
    }
    setSearching(true)
    try {
      const { products } = await api.priceUpdate.search(q)
      setSearchResults(products ?? [])
      setSelectedProduct(null)
      setVariantPrices({})
      if (!products?.length) toast.info("No products found.")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Search failed")
    } finally {
      setSearching(false)
    }
  }, [searchQuery])

  const selectProduct = useCallback((product: ProductWithVariants) => {
    setSelectedProduct(product)
    const next: Record<string, string> = {}
    for (const v of variantsWithUsd(product)) {
      const usdPrice = getUsdPrice(v)
      if (usdPrice != null) {
        next[v.id] = amountToDisplay(usdPrice.amount)
      } else {
        next[v.id] = ""
      }
    }
    setVariantPrices(next)
  }, [])

  const updatePricesMutation = useMutation({
    mutationFn: (payload: VariantPricePayload[]) => api.priceUpdate.updatePrices(payload),
    onSuccess: async (_, variables) => {
      toast.success(`Updated prices for ${variables.length} variant(s).`)
      queryClient.invalidateQueries({ queryKey: ["admin", "price-update"] })
      const productId = variables[0]?.product_id
      if (!productId) return
      try {
        await new Promise((r) => setTimeout(r, 150))
        const { products } = await api.priceUpdate.search(productId)
        const updated = products?.[0]
        if (updated) {
          setSelectedProduct(updated)
          setSearchResults((prev) =>
            prev.map((p) => (p.id === updated.id ? updated : p))
          )
          const next: Record<string, string> = {}
          for (const v of variantsWithUsd(updated)) {
            const usdPrice = getUsdPrice(v)
            if (usdPrice != null) next[v.id] = amountToDisplay(usdPrice.amount)
          }
          setVariantPrices(next)
        }
      } catch {
        // keep current selection; user already saw success toast
      }
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const handleSave = useCallback(() => {
    if (!selectedProduct) return
    const variants = variantsWithUsd(selectedProduct)
    const payload: VariantPricePayload[] = []
    for (const v of variants) {
      const displayVal = variantPrices[v.id] ?? ""
      const amount = displayToAmount(displayVal)
      const usdPrice = getUsdPrice(v)
      payload.push({
        variant_id: v.id,
        product_id: selectedProduct.id,
        prices: [{ id: usdPrice?.id, amount, currency_code: USD }],
      })
    }
    if (payload.length === 0) {
      toast.error("No variants to update.")
      return
    }
    updatePricesMutation.mutate(payload)
  }, [selectedProduct, variantPrices, updatePricesMutation])

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h1">Price Update</Heading>
      </div>

      <div className="px-6 py-4">
        <Heading level="h2" className="mb-3">
          Search product
        </Heading>
        <p className="text-ui-fg-subtle text-sm mb-3">
          Search by product ID (e.g. prod_01...) or by product name.
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="price-update-search">Product ID or name</Label>
            <Input
              id="price-update-search"
              type="text"
              placeholder="e.g. prod_01... or Swiss Chard"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && searchProducts()}
              className="w-80"
            />
          </div>
          <Button onClick={searchProducts} disabled={searching}>
            <MagnifyingGlass /> Search
          </Button>
        </div>
      </div>

      {searchResults.length > 0 && (
        <div className="px-6 py-4">
          <Heading level="h2" className="mb-3">
            Results
          </Heading>
          <div className="flex flex-wrap gap-2">
            {searchResults.map((p) => (
              <Button
                key={p.id}
                variant={selectedProduct?.id === p.id ? "primary" : "secondary"}
                size="small"
                onClick={() => selectProduct(p)}
              >
                {p.title}
                <Badge className="ml-1" size="small">
                  {(p.variants ?? []).length} variant(s)
                </Badge>
              </Button>
            ))}
          </div>
        </div>
      )}

      {selectedProduct && (
        <div className="px-6 py-4">
          <Heading level="h2" className="mb-3">
            Variants — {selectedProduct.title}
          </Heading>
          <p className="text-ui-fg-subtle text-sm mb-3">
            Only variants with USD pricing are listed. Current price reflects the saved USD amount; after saving, the table refreshes with updated prices.
          </p>
          {variantsWithUsd(selectedProduct).length === 0 ? (
            <p className="text-ui-fg-muted">No variants with USD pricing for this product.</p>
          ) : (
            <Table>
              <Table.Header>
                <Table.Row>
                  <Table.HeaderCell>Variant</Table.HeaderCell>
                  <Table.HeaderCell>SKU</Table.HeaderCell>
                  <Table.HeaderCell>Currency</Table.HeaderCell>
                  <Table.HeaderCell>Current price</Table.HeaderCell>
                  <Table.HeaderCell>New price</Table.HeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {variantsWithUsd(selectedProduct).map((v) => {
                  const usdPrice = getUsdPrice(v)
                  return (
                    <Table.Row key={v.id}>
                      <Table.Cell className="font-medium">{v.title || v.id}</Table.Cell>
                      <Table.Cell className="text-ui-fg-subtle">{v.sku ?? "—"}</Table.Cell>
                      <Table.Cell>USD</Table.Cell>
                      <Table.Cell>
                        {usdPrice != null ? `${amountToDisplay(usdPrice.amount)} USD` : "—"}
                      </Table.Cell>
                      <Table.Cell>
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          placeholder="0.00"
                          value={variantPrices[v.id] ?? ""}
                          onChange={(e) => setVariantPrices((prev) => ({ ...prev, [v.id]: e.target.value }))}
                          className="w-28"
                        />
                      </Table.Cell>
                    </Table.Row>
                  )
                })}
              </Table.Body>
            </Table>
          )}
          <div className="mt-4 flex gap-2">
            <Button
              onClick={handleSave}
              disabled={updatePricesMutation.isPending || variantsWithUsd(selectedProduct).length === 0}
            >
              <CurrencyDollar /> Save prices
            </Button>
            <Button variant="secondary" onClick={() => setSelectedProduct(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Price Update",
  icon: CurrencyDollar,
})

export const handle = {
  breadcrumb: () => "Price Update",
}

export default PriceUpdatePage
