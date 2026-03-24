"use client"

import { Listbox, Transition } from "@headlessui/react"
import { ChevronUpDown } from "@medusajs/icons"
import { Text, clx } from "@medusajs/ui"
import {
  departmentFacetEntries,
  findCategoryInTree,
} from "@lib/util/plp-department-categories"
import { HttpTypes } from "@medusajs/types"
import { Fragment } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"

export type PriceRangeOption = {
  value: string
  label: string
  priceMin?: number
  priceMax?: number
}

// Price ranges in dollars (Medusa Store API returns calculated_amount in major unit)
const PRICE_RANGE_OPTIONS: PriceRangeOption[] = [
  { value: "", label: "Any price" },
  { value: "0-5", label: "Under $5", priceMin: 0, priceMax: 5 },
  { value: "5-10", label: "$5 – $10", priceMin: 5, priceMax: 10 },
  { value: "10-25", label: "$10 – $25", priceMin: 10, priceMax: 25 },
  { value: "25-", label: "$25+", priceMin: 25, priceMax: undefined },
]

type ProductFacetsProps = {
  priceRange: string
  categoryId?: string
  categories: HttpTypes.StoreProductCategory[]
  collections?: HttpTypes.StoreCollection[]
  collectionId?: string
  setQueryParams: (updates: Record<string, string>) => void
  /** When on a category page, link "All Departments" to this path (e.g. /store) */
  allDepartmentsHref?: string
  "data-testid"?: string
}

function handlePriceRangeSelect(
  value: string,
  setQueryParams: (updates: Record<string, string>) => void
) {
  const opt = PRICE_RANGE_OPTIONS.find((o) => o.value === value)
  if (opt?.value === "") {
    setQueryParams({ priceMin: "", priceMax: "", page: "1" })
  } else if (opt) {
    const updates: Record<string, string> = {
      priceMin: opt.priceMin !== undefined ? String(opt.priceMin) : "",
      priceMax: opt.priceMax !== undefined ? String(opt.priceMax) : "",
      page: "1",
    }
    setQueryParams(updates)
  }
}

export default function ProductFacets({
  priceRange,
  categoryId,
  categories,
  collections = [],
  collectionId = "",
  setQueryParams,
  allDepartmentsHref,
  "data-testid": dataTestId,
}: ProductFacetsProps) {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const countryCode = (params?.countryCode as string) || "us"
  const facetEntries = departmentFacetEntries(categories || [])

  const selectedPriceOption =
    PRICE_RANGE_OPTIONS.find((o) => o.value === priceRange) ?? PRICE_RANGE_OPTIONS[0]

  const selectedDepartmentLabel = categoryId
    ? findCategoryInTree(categories || [], categoryId)?.name ?? "Department"
    : "All Departments"

  const selectedCollectionLabel = collectionId
    ? collections.find((c) => c.id === collectionId)?.title ?? "Collection"
    : "All collections"

  const handleCollectionSelect = (value: string) => {
    if (value === "") {
      setQueryParams({ collection_id: "", page: "1" })
    } else {
      setQueryParams({ collection_id: value, page: "1" })
    }
  }

  const handleDepartmentSelect = (value: string) => {
    if (value === "") {
      if (allDepartmentsHref) {
        const params = new URLSearchParams(searchParams)
        params.delete("category_id")
        params.delete("hw_categories")
        params.set("page", "1")
        const qs = params.toString()
        router.push(`/${countryCode}${allDepartmentsHref}${qs ? `?${qs}` : ""}`)
      } else {
        setQueryParams({ category_id: "", hw_categories: "", page: "1" })
      }
    } else {
      const cat = findCategoryInTree(categories || [], value)
      if (cat?.handle && allDepartmentsHref) {
        const qs = new URLSearchParams()
        if (collectionId) qs.set("collection_id", collectionId)
        const suffix = qs.toString()
        router.push(
          `/${countryCode}/categories/${cat.handle}${suffix ? `?${suffix}` : ""}`
        )
      } else if (cat?.id) {
        setQueryParams({ category_id: cat.id, brands: "", page: "1" })
      }
    }
  }

  return (
    <div className="flex flex-row flex-wrap items-center gap-3 tablet:gap-4" data-testid={dataTestId}>
      {/* Price Range dropdown */}
      <div className="flex flex-row items-center gap-2">
        <Text className="txt-compact-small-plus text-ui-fg-muted whitespace-nowrap text-xs tablet:text-sm">
          Price Range
        </Text>
        <Listbox
          value={priceRange}
          onChange={(value) => handlePriceRangeSelect(value, setQueryParams)}
        >
          <div className="relative min-w-[120px] xsmall:min-w-[140px]">
            <Listbox.Button
              className={clx(
                "relative w-full flex justify-between items-center px-3 py-2.5 tablet:py-2 text-left bg-white cursor-default focus:outline-none border border-ui-border-base rounded-md text-sm text-ui-fg-base hover:bg-ui-bg-subtle min-w-[120px] xsmall:min-w-[140px] min-h-[44px] tablet:min-h-0"
              )}
            >
              {({ open }) => (
                <>
                  <span className="block truncate">{selectedPriceOption.label}</span>
                  <ChevronUpDown
                    className={clx("ml-2 h-4 w-4 text-ui-fg-muted transition-transform shrink-0", {
                      "rotate-180": open,
                    })}
                  />
                </>
              )}
            </Listbox.Button>
            <Transition
              as={Fragment}
              leave="transition ease-in duration-100"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <Listbox.Options className="absolute z-50 mt-1 w-full min-w-[140px] overflow-auto bg-white border border-ui-border-base rounded-md shadow-lg max-h-60 focus:outline-none text-sm py-1">
                {PRICE_RANGE_OPTIONS.map((opt) => (
                  <Listbox.Option
                    key={opt.value || "any"}
                    value={opt.value}
                    className={({ active }) =>
                      clx("cursor-default select-none relative py-2 pl-3 pr-9", {
                        "bg-ui-bg-base-hover": active,
                        "bg-ui-bg-highlight": opt.value === priceRange,
                      })
                    }
                  >
                    {({ selected }) => (
                      <>
                        <span
                          className={clx("block truncate", {
                            "font-medium": selected,
                          })}
                        >
                          {opt.label}
                        </span>
                        {selected && (
                          <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-ui-fg-interactive">
                            ✓
                          </span>
                        )}
                      </>
                    )}
                  </Listbox.Option>
                ))}
              </Listbox.Options>
            </Transition>
          </div>
        </Listbox>
      </div>

      {/* Department dropdown */}
      <div className="flex flex-row items-center gap-2">
        <Text className="txt-compact-small-plus text-ui-fg-muted whitespace-nowrap text-xs tablet:text-sm">
          Department
        </Text>
        <Listbox value={categoryId || ""} onChange={handleDepartmentSelect}>
          <div className="relative min-w-[130px] xsmall:min-w-[160px]">
            <Listbox.Button
              className={clx(
                "relative w-full flex justify-between items-center px-3 py-2.5 tablet:py-2 text-left bg-white cursor-default focus:outline-none border border-ui-border-base rounded-md text-sm text-ui-fg-base hover:bg-ui-bg-subtle min-w-[130px] xsmall:min-w-[160px] min-h-[44px] tablet:min-h-0"
              )}
            >
              {({ open }) => (
                <>
                  <span className="block truncate">{selectedDepartmentLabel}</span>
                  <ChevronUpDown
                    className={clx("ml-2 h-4 w-4 text-ui-fg-muted transition-transform shrink-0", {
                      "rotate-180": open,
                    })}
                  />
                </>
              )}
            </Listbox.Button>
            <Transition
              as={Fragment}
              leave="transition ease-in duration-100"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <Listbox.Options className="absolute z-50 mt-1 w-full min-w-[160px] overflow-auto bg-white border border-ui-border-base rounded-md shadow-lg max-h-60 focus:outline-none text-sm py-1">
                <Listbox.Option
                  value=""
                  className={({ active }) =>
                    clx("cursor-default select-none relative py-2 pl-3 pr-9", {
                      "bg-ui-bg-base-hover": active,
                      "bg-ui-bg-highlight": !categoryId,
                    })
                  }
                >
                  {({ selected }) => (
                    <>
                      <span className={clx("block truncate", { "font-medium": selected })}>
                        All Departments
                      </span>
                      {selected && (
                        <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-ui-fg-interactive">
                          ✓
                        </span>
                      )}
                    </>
                  )}
                </Listbox.Option>
                {facetEntries.map(({ department, hwSubcategories }) => (
                  <Fragment key={department.id}>
                    <Listbox.Option
                      value={department.id}
                      className={({ active }) =>
                        clx("cursor-default select-none relative py-2 pl-3 pr-9", {
                          "bg-ui-bg-base-hover": active,
                          "bg-ui-bg-highlight": categoryId === department.id,
                        })
                      }
                    >
                      {({ selected }) => (
                        <>
                          <span
                            className={clx("block truncate", {
                              "font-medium": selected,
                            })}
                          >
                            {department.name}
                          </span>
                          {selected && (
                            <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-ui-fg-interactive">
                              ✓
                            </span>
                          )}
                        </>
                      )}
                    </Listbox.Option>
                    {hwSubcategories.map((sub) => (
                      <Listbox.Option
                        key={sub.id}
                        value={sub.id}
                        className={({ active }) =>
                          clx("cursor-default select-none relative py-2 pl-6 pr-9", {
                            "bg-ui-bg-base-hover": active,
                            "bg-ui-bg-highlight": categoryId === sub.id,
                          })
                        }
                      >
                        {({ selected }) => (
                          <>
                            <span
                              className={clx("block truncate text-ui-fg-subtle", {
                                "font-medium": selected,
                              })}
                            >
                              {sub.name}
                            </span>
                            {selected && (
                              <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-ui-fg-interactive">
                                ✓
                              </span>
                            )}
                          </>
                        )}
                      </Listbox.Option>
                    ))}
                  </Fragment>
                ))}
              </Listbox.Options>
            </Transition>
          </div>
        </Listbox>
      </div>

      {collections.length > 0 && (
        <div className="flex flex-row items-center gap-2">
          <Text className="txt-compact-small-plus text-ui-fg-muted whitespace-nowrap text-xs tablet:text-sm">
            Collection
          </Text>
          <Listbox value={collectionId || ""} onChange={handleCollectionSelect}>
            <div className="relative min-w-[130px] xsmall:min-w-[160px]">
              <Listbox.Button
                className={clx(
                  "relative w-full flex justify-between items-center px-3 py-2.5 tablet:py-2 text-left bg-white cursor-default focus:outline-none border border-ui-border-base rounded-md text-sm text-ui-fg-base hover:bg-ui-bg-subtle min-w-[130px] xsmall:min-w-[160px] min-h-[44px] tablet:min-h-0"
                )}
              >
                {({ open }) => (
                  <>
                    <span className="block truncate">{selectedCollectionLabel}</span>
                    <ChevronUpDown
                      className={clx("ml-2 h-4 w-4 text-ui-fg-muted transition-transform shrink-0", {
                        "rotate-180": open,
                      })}
                    />
                  </>
                )}
              </Listbox.Button>
              <Transition
                as={Fragment}
                leave="transition ease-in duration-100"
                leaveFrom="opacity-100"
                leaveTo="opacity-0"
              >
                <Listbox.Options className="absolute z-50 mt-1 w-full min-w-[160px] overflow-auto bg-white border border-ui-border-base rounded-md shadow-lg max-h-60 focus:outline-none text-sm py-1">
                  <Listbox.Option
                    value=""
                    className={({ active }) =>
                      clx("cursor-default select-none relative py-2 pl-3 pr-9", {
                        "bg-ui-bg-base-hover": active,
                        "bg-ui-bg-highlight": !collectionId,
                      })
                    }
                  >
                    {({ selected }) => (
                      <>
                        <span className={clx("block truncate", { "font-medium": selected })}>
                          All collections
                        </span>
                        {selected && (
                          <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-ui-fg-interactive">
                            ✓
                          </span>
                        )}
                      </>
                    )}
                  </Listbox.Option>
                  {collections.map((col) => (
                    <Listbox.Option
                      key={col.id}
                      value={col.id}
                      className={({ active }) =>
                        clx("cursor-default select-none relative py-2 pl-3 pr-9", {
                          "bg-ui-bg-base-hover": active,
                          "bg-ui-bg-highlight": collectionId === col.id,
                        })
                      }
                    >
                      {({ selected }) => (
                        <>
                          <span
                            className={clx("block truncate", {
                              "font-medium": selected,
                            })}
                          >
                            {col.title}
                          </span>
                          {selected && (
                            <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-ui-fg-interactive">
                              ✓
                            </span>
                          )}
                        </>
                      )}
                    </Listbox.Option>
                  ))}
                </Listbox.Options>
              </Transition>
            </div>
          </Listbox>
        </div>
      )}
    </div>
  )
}
