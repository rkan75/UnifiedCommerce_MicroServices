import React, { Suspense } from "react"

import ProductImageGallery from "@modules/products/components/image-gallery/product-image-gallery"
import ProductActions from "@modules/products/components/product-actions"
import ProductOnboardingCta from "@modules/products/components/product-onboarding-cta"
import ProductTabs from "@modules/products/components/product-tabs"
import RelatedProducts from "@modules/products/components/related-products"
import ProductInfo from "@modules/products/templates/product-info"
import SkeletonRelatedProducts from "@modules/skeletons/templates/skeleton-related-products"
import { notFound } from "next/navigation"
import { HttpTypes } from "@medusajs/types"

import ProductActionsWrapper from "./product-actions-wrapper"

type ProductTemplateProps = {
  product: HttpTypes.StoreProduct
  region: HttpTypes.StoreRegion
  countryCode: string
  images?: HttpTypes.StoreProductImage[]
}

const ProductTemplate: React.FC<ProductTemplateProps> = ({
  product,
  region,
  countryCode,
}) => {
  if (!product || !product.id) {
    return notFound()
  }

  return (
    <>
      <div
        className="content-container flex flex-col tablet:flex-row tablet:items-center py-4 tablet:py-6 gap-4 tablet:gap-8 relative"
        data-testid="product-container"
      >
        <div className="flex flex-col tablet:sticky tablet:top-32 small:top-48 tablet:py-0 tablet:max-w-[280px] small:max-w-[300px] w-full order-2 tablet:order-1 py-4 tablet:py-0 gap-4 tablet:gap-y-6">
          <ProductInfo product={product} />
          <ProductTabs product={product} />
        </div>
        <div className="block w-full relative order-1 tablet:order-2 flex-1 flex justify-center items-start">
          <ProductImageGallery product={product} />
        </div>
        <div className="flex flex-col tablet:sticky tablet:top-32 small:top-48 tablet:py-0 tablet:max-w-[280px] small:max-w-[300px] w-full order-3 py-4 tablet:py-0 gap-6 tablet:gap-y-12">
          <ProductOnboardingCta />
          <Suspense
            fallback={
              <ProductActions
                disabled={true}
                product={product}
                region={region}
              />
            }
          >
            <ProductActionsWrapper id={product.id} region={region} />
          </Suspense>
        </div>
      </div>
      <div
        className="content-container my-10 tablet:my-16 small:my-32"
        data-testid="related-products-container"
      >
        <Suspense fallback={<SkeletonRelatedProducts />}>
          <RelatedProducts product={product} countryCode={countryCode} />
        </Suspense>
      </div>
    </>
  )
}

export default ProductTemplate
