import { Container, clx } from "@medusajs/ui"
import Image from "next/image"
import React from "react"

import PlaceholderImage from "@modules/common/icons/placeholder-image"

type ThumbnailProps = {
  thumbnail?: string | null
  // TODO: Fix image typings
  images?: any[] | null
  size?: "small" | "medium" | "large" | "full" | "square"
  isFeatured?: boolean
  /** `contain` keeps the full product in frame (e.g. related products on PDP); default `cover` fills the box. */
  imageFit?: "cover" | "contain"
  className?: string
  "data-testid"?: string
}

const Thumbnail: React.FC<ThumbnailProps> = ({
  thumbnail,
  images,
  size = "small",
  isFeatured,
  imageFit = "cover",
  className,
  "data-testid": dataTestid,
}) => {
  const initialImage = thumbnail || images?.[0]?.url

  return (
    <Container
      className={clx(
        "relative w-full overflow-hidden shadow-elevation-card-rest rounded-large group-hover:shadow-elevation-card-hover transition-shadow ease-in-out duration-150",
        imageFit === "contain"
          ? "bg-white p-3 ring-1 ring-inset ring-ui-border-base"
          : "bg-ui-bg-subtle p-4",
        className,
        {
          "aspect-[11/14]": isFeatured,
          "aspect-[3/4]": !isFeatured && size !== "square",
          "aspect-[1/1]": size === "square",
          "w-[180px]": size === "small",
          "w-[290px]": size === "medium",
          "w-[440px]": size === "large",
          "w-full": size === "full",
        }
      )}
      data-testid={dataTestid}
    >
      <ImageOrPlaceholder image={initialImage} size={size} imageFit={imageFit} />
    </Container>
  )
}

/** Amazon CDNs often block or error when Next's image optimizer fetches server-side → 500 on /_next/image. */
export function shouldUseUnoptimizedProductImage(src: string) {
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

const ImageOrPlaceholder = ({
  image,
  size,
  imageFit = "cover",
}: Pick<ThumbnailProps, "size" | "imageFit"> & { image?: string }) => {
  return image ? (
    <Image
      src={image}
      alt="Thumbnail"
      className={clx(
        "absolute inset-0 object-center",
        imageFit === "contain" ? "object-contain p-1" : "object-cover"
      )}
      draggable={false}
      quality={50}
      unoptimized={shouldUseUnoptimizedProductImage(image)}
      sizes="(max-width: 576px) 280px, (max-width: 768px) 360px, (max-width: 992px) 480px, 800px"
      fill
    />
  ) : (
    <div className="w-full h-full absolute inset-0 flex items-center justify-center">
      <PlaceholderImage size={size === "small" ? 16 : 24} />
    </div>
  )
}

export default Thumbnail
