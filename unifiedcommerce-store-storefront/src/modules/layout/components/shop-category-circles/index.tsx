import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { clx } from "@medusajs/ui"

type CircleVariant = "red" | "black"

type MenuConfig = {
  id: string
  /** Lines shown under the circle (uppercase in UI) */
  lines: string[]
  /** Match root product categories by handle substring / alias */
  matchHandles: string[]
  /** Match normalized category name keywords */
  matchNameKeywords?: string[]
  /** If no API category matches */
  fallbackHref: string
  circle: CircleVariant
  icon: "pill" | "dumbbell" | "shaker" | "preworkout" | "cup" | "leafHeart" | "theDrop"
}

const MENU: MenuConfig[] = [
  {
    id: "multivitamins",
    lines: ["Multivitamins", "& Wellness"],
    matchHandles: [
      "multivitamins",
      "vitamins",
      "wellness",
      "multivitamins-wellness",
      "vitamins-wellness",
    ],
    matchNameKeywords: ["multivitamin", "vitamin", "wellness"],
    fallbackHref: "/store",
    circle: "red",
    icon: "pill",
  },
  {
    id: "creatine",
    lines: ["Creatine"],
    matchHandles: ["creatine"],
    matchNameKeywords: ["creatine"],
    fallbackHref: "/store",
    circle: "red",
    icon: "dumbbell",
  },
  {
    id: "protein",
    lines: ["Protein"],
    matchHandles: ["protein", "proteins", "whey"],
    matchNameKeywords: ["protein"],
    fallbackHref: "/store",
    circle: "red",
    icon: "shaker",
  },
  {
    id: "preworkout",
    lines: ["Pre-", "Workout"],
    matchHandles: ["pre-workout", "preworkout", "pre_workout", "energy"],
    matchNameKeywords: ["pre-workout", "preworkout", "workout"],
    fallbackHref: "/store",
    circle: "red",
    icon: "preworkout",
  },
  {
    id: "food-drink",
    lines: ["Food", "& Drink"],
    matchHandles: [
      "food-drink",
      "food-and-drink",
      "snacks",
      "beverages",
      "drinks",
    ],
    matchNameKeywords: ["food", "drink", "snack", "beverage"],
    fallbackHref: "/store",
    circle: "red",
    icon: "cup",
  },
  {
    id: "digestion",
    lines: ["Digestion", "& Gut Health"],
    matchHandles: [
      "digestion",
      "gut-health",
      "gut",
      "probiotic",
      "digestive",
    ],
    matchNameKeywords: ["digestion", "gut", "probiotic"],
    fallbackHref: "/store",
    circle: "red",
    icon: "leafHeart",
  },
  {
    id: "new-drop",
    lines: ["New"],
    matchHandles: ["new-arrivals", "new", "the-drop", "drop"],
    matchNameKeywords: ["new arrival"],
    fallbackHref: "/store?sortBy=created_at",
    circle: "black",
    icon: "theDrop",
  },
]

function normalizeKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

function resolveHref(
  item: MenuConfig,
  rootCategories: HttpTypes.StoreProductCategory[]
): string {
  const handleMatch = (cat: HttpTypes.StoreProductCategory): boolean => {
    const h = normalizeKey(cat.handle ?? "")
    const name = normalizeKey(cat.name ?? "")
    for (const alias of item.matchHandles) {
      const a = normalizeKey(alias)
      if (!a) continue
      if (h === a || h.includes(a) || a.includes(h)) return true
    }
    if (item.matchNameKeywords?.length) {
      for (const kw of item.matchNameKeywords) {
        const k = normalizeKey(kw)
        if (name.includes(k) || h.includes(k)) return true
      }
    }
    return false
  }

  const found = rootCategories.find(
    (c) => !c.parent_category && c.handle && handleMatch(c)
  )
  if (found?.handle) {
    return `/categories/${found.handle}`
  }
  return item.fallbackHref
}

function IconPill({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      aria-hidden
    >
      <rect x="5" y="8" width="14" height="8" rx="4" />
      <line x1="9" y1="12" x2="15" y2="12" />
    </svg>
  )
}

function IconDumbbell({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M6 10h2v4H6zM16 10h2v4h-2z" />
      <path d="M8 11h8M8 13h8" />
      <path d="M4 9v6M20 9v6" />
    </svg>
  )
}

function IconShaker({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M9 3h6l1 3H8l1-3z" />
      <path d="M8 6h8l-1 15H9L8 6z" />
      <path d="M10 10h4" />
    </svg>
  )
}

function IconPreworkout({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <rect
        x="5"
        y="6"
        width="14"
        height="12"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M9 7V5h6v2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M12.5 9 10 13h2.8l-1.2 4 3.2-5.2h-2.9l1.1-2.8z"
        fill="currentColor"
      />
    </svg>
  )
}

function IconCup({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M7 5h8v2l-1 12H8L7 7V5z" />
      <path d="M15 7h2a2 2 0 0 1 0 4h-2" />
      <path d="M9 9h4" />
    </svg>
  )
}

function IconLeafHeart({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 20s7-4.5 7-11a5 5 0 0 0-9-3 5 5 0 0 0-9 3c0 6.5 7 11 7 11z" />
      <path
        d="M12 11.5c.5-1.2 2-1.8 3-.5.8 1.2-.2 2.5-1.5 3.5L12 16l-1.5-1.5c-1.3-1-2.3-2.3-1.5-3.5 1-1.3 2.5-.7 3 .5z"
        fill="currentColor"
        stroke="none"
        opacity={0.35}
      />
    </svg>
  )
}

function IconTheDrop({ className }: { className?: string }) {
  return (
    <div
      className={clx(
        "flex flex-col items-center justify-center leading-none select-none",
        className
      )}
      aria-hidden
    >
      <span className="text-[7px] font-semibold text-header-red tracking-tight">
        the
      </span>
      <span className="text-[11px] font-black text-white tracking-tighter scale-y-125">
        DROP
      </span>
    </div>
  )
}

function CircleIcon({ icon }: { icon: MenuConfig["icon"] }) {
  const cls = "h-8 w-8 text-white shrink-0"
  switch (icon) {
    case "pill":
      return <IconPill className={cls} />
    case "dumbbell":
      return <IconDumbbell className={cls} />
    case "shaker":
      return <IconShaker className={cls} />
    case "preworkout":
      return <IconPreworkout className={cls} />
    case "cup":
      return <IconCup className={cls} />
    case "leafHeart":
      return <IconLeafHeart className={cls} />
    case "theDrop":
      return <IconTheDrop />
    default:
      return null
  }
}

type ShopCategoryCirclesProps = {
  categories: HttpTypes.StoreProductCategory[]
  className?: string
}

/**
 * GNC-style shop strip: red/black circles with white icons + bold labels.
 * Links resolve to matching root Medusa product categories when possible.
 */
export default function ShopCategoryCircles({
  categories,
  className,
}: ShopCategoryCirclesProps) {
  const roots = (categories ?? []).filter(
    (c) => !c.parent_category && c.handle
  )

  return (
    <nav
      className={clx(
        "border-b border-grey-20 bg-white py-4 small:py-5",
        className
      )}
      aria-label="Shop by category"
    >
      <div className="content-container">
        <ul className="flex w-full min-w-0 flex-nowrap justify-center gap-2 xsmall:gap-3 small:gap-4 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-grey-30 scrollbar-track-transparent">
          {MENU.map((item) => {
            const href = resolveHref(item, roots)
            return (
              <li
                key={item.id}
                className="shrink-0 w-[68px] xsmall:w-[72px] small:w-[76px] medium:w-[88px]"
              >
                <LocalizedClientLink
                  href={href}
                  className="flex flex-col items-center justify-center gap-2 group outline-none focus-visible:ring-2 focus-visible:ring-header-red focus-visible:ring-offset-2 rounded-lg px-0.5 py-1 w-full"
                >
                  <span
                    className={clx(
                      "flex h-[58px] w-[58px] small:h-16 small:w-16 items-center justify-center rounded-full shadow-sm transition-transform group-hover:scale-105 group-active:scale-95 mx-auto",
                      item.circle === "black"
                        ? "bg-grey-90 ring-2 ring-grey-90"
                        : "bg-header-red"
                    )}
                  >
                    <CircleIcon icon={item.icon} />
                  </span>
                  <span className="flex flex-col items-center text-center">
                    {item.lines.map((line) => (
                      <span
                        key={line}
                        className="block text-[9px] xsmall:text-[10px] font-bold uppercase tracking-wide text-grey-90 leading-tight"
                      >
                        {line}
                      </span>
                    ))}
                  </span>
                </LocalizedClientLink>
              </li>
            )
          })}
        </ul>
      </div>
    </nav>
  )
}
