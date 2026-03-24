import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

type Meta = Record<string, unknown> | null | undefined

function metaString(meta: Meta, key: string): string | null {
  const v = meta?.[key]
  return typeof v === "string" && v.trim() ? v.trim() : null
}

type ProductDetailHeadingProps = {
  product: HttpTypes.StoreProduct
}

/**
 * PDP title stack: brand (metadata.brand, subtitle, or collection) + title + optional social line (metadata.monthly_purchases_label).
 */
export default function ProductDetailHeading({ product }: ProductDetailHeadingProps) {
  const meta = product.metadata as Meta
  const brand =
    metaString(meta, "brand") ??
    (product.subtitle?.trim() ? product.subtitle.trim() : null) ??
    product.collection?.title ??
    null

  const socialLine = metaString(meta, "monthly_purchases_label")
  const itemNumber =
    metaString(meta, "item_number") ??
    metaString(meta, "item_number_label") ??
    null

  return (
    <header className="flex flex-col gap-2">
      {brand ? (
        <p className="text-sm font-bold uppercase tracking-wide text-ui-fg-base">
          {brand}
        </p>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h1
          className="min-w-0 flex-1 text-2xl font-bold leading-tight text-ui-fg-base tablet:text-3xl small:text-[2rem] small:leading-tight"
          data-testid="product-title"
        >
          {product.title}
        </h1>
        {itemNumber ? (
          <span className="shrink-0 text-sm text-ui-fg-muted">Item # {itemNumber}</span>
        ) : null}
      </div>
      {product.collection?.handle && product.collection.title ? (
        <LocalizedClientLink
          href={`/collections/${product.collection.handle}`}
          className="text-sm text-ui-fg-interactive hover:underline"
        >
          {product.collection.title}
        </LocalizedClientLink>
      ) : null}
      {socialLine ? (
        <p className="text-sm text-ui-fg-subtle">{socialLine}</p>
      ) : null}
    </header>
  )
}
