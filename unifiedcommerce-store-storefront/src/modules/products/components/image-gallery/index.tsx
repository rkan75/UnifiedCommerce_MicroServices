"use client"

import { HttpTypes } from "@medusajs/types"
import { Container, clx } from "@medusajs/ui"
import Image from "next/image"
import { useState, useEffect } from "react"

type ImageGalleryProps = {
  images: (HttpTypes.StoreProductImage | { id: string; url: string })[]
  /** PDP-style pack shots often look better with contain */
  objectFit?: "cover" | "contain"
}

const ImageGallery = ({
  images,
  objectFit = "cover",
}: ImageGalleryProps) => {
  const [selectedIndex, setSelectedIndex] = useState(0)

  // When variant changes (new images array), show first image
  useEffect(() => {
    setSelectedIndex(0)
  }, [images])

  // Keep selected index in bounds if list shortens
  useEffect(() => {
    if (images.length > 0 && selectedIndex >= images.length) {
      setSelectedIndex(Math.max(0, images.length - 1))
    }
  }, [images.length, selectedIndex])

  if (!images.length) {
    return null
  }

  const mainImage = images[selectedIndex]
  const hasMultiple = images.length > 1

  return (
    <div className="flex flex-col items-center relative w-full max-w-[600px] mx-auto tablet:mx-0">
      {/* Main image - larger size, centered between description and price */}
      <Container
        key={mainImage.id}
        className="relative aspect-[29/34] w-full max-h-[min(48vh,420px)] tablet:max-h-[min(55vh,480px)] small:max-h-[min(58vh,540px)] overflow-hidden rounded-rounded bg-white shrink-0 ring-1 ring-inset ring-ui-border-base"
        id={mainImage.id}
      >
        {!!mainImage.url && (
          <Image
            src={mainImage.url}
            priority={selectedIndex <= 2}
            className="absolute inset-0 rounded-rounded"
            alt={`Product image ${selectedIndex + 1}`}
            fill
            sizes="(max-width: 576px) 280px, (max-width: 768px) 360px, (max-width: 992px) 480px, 800px"
            style={{
              objectFit,
            }}
          />
        )}
      </Container>

      {/* Thumbnail carousel - horizontal scroll, always visible below main image */}
      {hasMultiple && (
        <div className="flex flex-col w-full mt-2 tablet:mt-3 shrink-0">
          <div
            className="flex gap-1.5 tablet:gap-2 overflow-x-auto overflow-y-hidden py-1 scrollbar-thin scrollbar-thumb-ui-fg-muted scrollbar-track-transparent"
            style={{ scrollbarGutter: "stable" }}
          >
            {images.map((image, index) => (
              <button
                key={image.id}
                type="button"
                onClick={() => setSelectedIndex(index)}
                className={clx(
                  "relative flex-shrink-0 w-14 h-14 tablet:w-16 tablet:h-16 small:w-20 small:h-20 rounded-rounded overflow-hidden border-2 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ui-fg-interactive aspect-square",
                  selectedIndex === index
                    ? "border-ui-fg-interactive ring-2 ring-ui-fg-interactive"
                    : "border-transparent hover:border-ui-border-strong"
                )}
                aria-label={`View image ${index + 1}`}
                aria-pressed={selectedIndex === index}
              >
                {!!image.url && (
                  <Image
                    src={image.url}
                    alt={`Thumbnail ${index + 1}`}
                    fill
                    className="object-cover"
                    sizes="80px"
                  />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default ImageGallery
