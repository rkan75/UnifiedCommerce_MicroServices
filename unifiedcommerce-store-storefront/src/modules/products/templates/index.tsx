import React, { Suspense } from "react"

import ProductImageColumn from "@modules/products/components/product-image-column"
import ProductOnboardingCta from "@modules/products/components/product-onboarding-cta"
import ProductTabs from "@modules/products/components/product-tabs"
import RelatedProducts from "@modules/products/components/related-products"
import ProductDetailHeading from "@modules/products/templates/product-detail-heading"
import SkeletonRelatedProducts from "@modules/skeletons/templates/skeleton-related-products"
import { notFound } from "next/navigation"
import { HttpTypes } from "@medusajs/types"

import ProductActions from "@modules/products/components/product-actions"

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
        className="content-container py-4 tablet:py-8"
        data-testid="product-container"
      >
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-10 xl:gap-12">
          <div className="w-full shrink-0 lg:sticky lg:top-28 lg:w-[min(46%,520px)]">
            <ProductImageColumn product={product} />
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-6 lg:max-w-xl xl:max-w-2xl">
            <ProductDetailHeading product={product} />
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

        <div className="mt-10 border-t border-ui-border-base pt-8 tablet:mt-14 tablet:pt-10">
          <ProductTabs product={product} />
        </div>
      </div>

      <div
        className="content-container my-10 tablet:my-16 small:my-24"
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
