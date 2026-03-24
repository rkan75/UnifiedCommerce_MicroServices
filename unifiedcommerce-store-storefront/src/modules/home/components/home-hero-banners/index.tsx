"use client"

import Image from "next/image"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

/**
 * Full-bleed hero + white gap + OnlineOnly strip (no Shop by Brand — that lives in page.tsx as RSC).
 */
type HomeHeroBannersProps = {
  heroHref?: string
  onlineOnlyHref?: string
}

export default function HomeHeroBanners({
  heroHref = "/categories/hw_bogo50%25off",
  onlineOnlyHref = "/store",
}: HomeHeroBannersProps) {
  return (
    <div className="flex w-full flex-col">
      <div className="flex h-[min(70vh,42rem)] w-full max-w-[100vw] flex-col overflow-hidden">
        <LocalizedClientLink
          href={heroHref}
          className="relative min-h-0 w-full flex-[450] basis-0"
          aria-label="Shop buy 1 get 1 50% off category"
        >
          <Image
            src="/HeroImage.png"
            alt="Live Well Sale — Buy 1 Get 1 50% off hero banner"
            fill
            sizes="100vw"
            className="object-cover object-center"
            priority
          />
        </LocalizedClientLink>
        <div className="h-2 w-full shrink-0 bg-white small:h-3" aria-hidden />
        <LocalizedClientLink
          href={onlineOnlyHref}
          className="relative min-h-0 w-full flex-[175] basis-0"
          aria-label="Shop online only category"
        >
          <Image
            src="/OnlineOnly.avif"
            alt="Online only promotion"
            fill
            sizes="100vw"
            className="object-cover object-center"
            priority
          />
        </LocalizedClientLink>
      </div>
    </div>
  )
}
