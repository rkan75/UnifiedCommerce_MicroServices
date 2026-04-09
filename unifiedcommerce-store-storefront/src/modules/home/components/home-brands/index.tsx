"use client"

import Image from "next/image"
import { useEffect, useState } from "react"

import LocalizedClientLink from "@modules/common/components/localized-client-link"
import {
  type Locale,
  getTranslation,
  resolveTranslationLocale,
} from "@lib/i18n/translations"
import { clx } from "@medusajs/ui"
import { HttpTypes } from "@medusajs/types"

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null
  const value = `; ${document.cookie}`
  const parts = value.split(`; ${name}=`)
  if (parts.length === 2) return parts.pop()?.split(";").shift() || null
  return null
}

type HomeBrandsProps = {
  collections: HttpTypes.StoreCollection[]
  /** Extra classes for the outer section (e.g. flush under hero) */
  className?: string
}

const PREFERRED_BRAND_HANDLES = [
  "barebells",
  "ghost",
  "gnc",
  "alani-nu",
  "raw-nutrition",
  "nugenix",
  "bucked-up",
  "gorilla-mind",
]

function coerceImageUrl(value: unknown): string | null {
  if (typeof value === "string") {
    const t = value.trim()
    return t.length > 0 ? t : null
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const o = value as Record<string, unknown>
    const nested = o.url ?? o.src ?? o.href
    return coerceImageUrl(nested)
  }
  return null
}

function getMetadataImage(collection: HttpTypes.StoreCollection): string | null {
  const metadata = (collection.metadata ?? {}) as Record<string, unknown>
  return (
    coerceImageUrl(metadata.brand_image) ??
    coerceImageUrl(metadata.brandImage) ??
    coerceImageUrl(metadata.thumbnail) ??
    coerceImageUrl(metadata.image) ??
    null
  )
}

function shouldUseUnoptimizedImage(src: string) {
  try {
    const host = new URL(src).hostname.toLowerCase()
    return (
      host === "m.media-amazon.com" ||
      host.endsWith(".media-amazon.com") ||
      host.endsWith(".ssl-images-amazon.com")
    )
  } catch {
    return false
  }
}

/**
 * `next/image` needs a direct file URL. Collection metadata often mistakenly stores a brand *page* URL
 * (e.g. https://www.gnc.com/brands/barebells/) which is HTML, not an image.
 */
function isKnownImageCdnUrl(src: string): boolean {
  try {
    const u = new URL(src.trim())
    if (u.protocol !== "http:" && u.protocol !== "https:") return false
    const h = u.hostname.toLowerCase()
    const p = u.pathname
    if (p === "" || p.endsWith("/")) return false
    if (h.includes("cloudinary.com") && p.includes("/image/upload/")) return true
    if (h.endsWith(".imgix.net") || h === "imgix.com") return true
    if (h === "cdn.shopify.com" || h.endsWith(".cdn.shopify.com")) return true
    if (h.endsWith(".googleusercontent.com")) return true
    if (h.includes("media-amazon.com") || h.includes("ssl-images-amazon.com")) return true
    return false
  } catch {
    return false
  }
}

function isLikelyDirectImageUrl(src: string): boolean {
  const trimmed = src.trim()
  if (!trimmed) return false
  // Same-origin static files from /public
  if (trimmed.startsWith("/")) {
    const pathOnly = trimmed.split("?")[0] ?? ""
    return /\.(avif|bmp|gif|jpe?g|png|svg|webp)$/i.test(pathOnly)
  }
  try {
    const u = new URL(trimmed)
    if (u.protocol !== "http:" && u.protocol !== "https:") return false
    const path = u.pathname
    if (path.endsWith("/") || path === "") return false
    if (/\.(avif|bmp|gif|jpe?g|png|svg|webp)(\?.*)?$/i.test(path)) return true
    return isKnownImageCdnUrl(trimmed)
  } catch {
    return false
  }
}

export default function HomeBrands({ collections, className }: HomeBrandsProps) {
  const [locale, setLocale] = useState<Locale>(() => {
    if (typeof window !== "undefined") {
      return resolveTranslationLocale(getCookie("_medusa_locale"))
    }
    return "en"
  })

  useEffect(() => {
    if (typeof window === "undefined") return

    const updateLocale = () => {
      setLocale(resolveTranslationLocale(getCookie("_medusa_locale")))
    }

    updateLocale()

    const handleLocaleChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ locale: Locale }>
      if (customEvent.detail?.locale) {
        setLocale(customEvent.detail.locale)
      } else {
        updateLocale()
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        updateLocale()
      }
    }

    const interval = setInterval(updateLocale, 300)

    window.addEventListener("localechange", handleLocaleChange)
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      clearInterval(interval)
      window.removeEventListener("localechange", handleLocaleChange)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [])

  const t = (key: string) => getTranslation(locale, key)

  const valid = collections.filter(
    (c): c is HttpTypes.StoreCollection =>
      Boolean(c?.id && c?.handle && String(c.handle).length > 0)
  )

  const byHandle = new Map(valid.map((c) => [c.handle, c]))

  const preferred = PREFERRED_BRAND_HANDLES.map((handle) => byHandle.get(handle)).filter(
    Boolean
  ) as HttpTypes.StoreCollection[]

  const fallback = valid
    .filter((c) => !preferred.some((p) => p.id === c.id))
    .slice(0, Math.max(0, 8 - preferred.length))

  const brands = [...preferred, ...fallback].slice(0, 8)

  return (
    <section
      className={clx(
        "w-full bg-white pt-2 pb-8 small:pt-3 small:pb-10",
        className
      )}
    >
      <div className="content-container">
        <h2 className="mb-6 text-center text-2xl font-bold text-ui-fg-base small:text-3xl">
          {t("home.shopByBrand")}
        </h2>
        {brands.length === 0 ? (
          <p className="mx-auto max-w-xl text-center text-sm text-ui-fg-muted">
            {t("home.shopByBrandNoCollections")}
          </p>
        ) : (
          <div className="relative grid grid-cols-2 gap-4 small:grid-cols-3 medium:grid-cols-4">
            {brands.map((brand) => {
              const rawImage = getMetadataImage(brand)
              const imageSrc = rawImage && isLikelyDirectImageUrl(rawImage) ? rawImage : null
              const invalidImageUrl = Boolean(rawImage && !imageSrc)

              return (
                <LocalizedClientLink
                  key={brand.id}
                  href={`/collections/${brand.handle}`}
                  className="group relative z-0 rounded-xl bg-white p-3 shadow-sm ring-1 ring-black/5 transition-all duration-300 ease-out hover:z-10 hover:-translate-y-0.5 hover:shadow-xl hover:ring-2 hover:ring-header-red/35 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-header-red focus-visible:ring-offset-2"
                  data-testid="brand-tile"
                >
                  <div className="relative mb-3 h-[240px] w-full overflow-hidden rounded-lg bg-white p-2 small:h-[280px] small:p-3 ring-0 ring-transparent transition-[box-shadow,ring-color] duration-300 ease-out group-hover:shadow-md group-hover:ring-2 group-hover:ring-header-red">
                    {imageSrc ? (
                      <Image
                        src={imageSrc}
                        alt={brand.title}
                        fill
                        sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 22vw"
                        className="object-contain object-center transition-transform duration-300 ease-out will-change-transform group-hover:scale-110"
                        unoptimized={shouldUseUnoptimizedImage(imageSrc)}
                      />
                    ) : invalidImageUrl ? (
                      <div className="flex h-full w-full items-center justify-center px-2 text-center text-[11px] font-medium leading-snug text-amber-800">
                        {t("home.shopByBrandInvalidImageUrl")}
                      </div>
                    ) : (
                      <div className="flex h-full w-full items-center justify-center px-2 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
                        {t("home.shopByBrandPlaceholder")}
                      </div>
                    )}
                  </div>
                  <div className="text-center text-lg font-extrabold uppercase tracking-wide text-[#202124] transition-colors duration-300 group-hover:text-header-red">
                    {brand.title}
                  </div>
                </LocalizedClientLink>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
