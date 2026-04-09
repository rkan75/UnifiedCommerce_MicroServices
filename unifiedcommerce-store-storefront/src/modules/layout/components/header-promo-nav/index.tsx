import type { HeaderPromoDestinations } from "@lib/util/header-promo-destinations"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { getLocale } from "@lib/data/locale-actions"
import { getTranslation, resolveTranslationLocale } from "@lib/i18n/translations"

const GNC_BLOG_URL = "https://www.gnc.com/blog"

export default async function HeaderPromoNav({
  promo,
}: {
  promo: HeaderPromoDestinations
}) {
  const localeCookie = await getLocale()
  const t = (key: string) =>
    getTranslation(resolveTranslationLocale(localeCookie), key)

  const linkBase =
    "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap py-1 text-[11px] font-bold uppercase tracking-wide text-grey-90 transition-colors hover:text-header-red small:text-xs"
  const linkRed =
    "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap py-1 text-[11px] font-bold uppercase tracking-wide text-header-red transition-opacity hover:opacity-85 small:text-xs"

  return (
    <nav
      className="border-b border-grey-20 bg-white"
      aria-label={t("nav.headerMenuAria")}
    >
      <div className="content-container">
        <div className="flex min-h-[44px] items-center gap-x-3 overflow-x-auto py-2 small:gap-x-5 tablet:gap-x-7 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <LocalizedClientLink href="/store" className={linkBase}>
            <IconGrid className="h-4 w-4 text-grey-90" aria-hidden />
            {t("nav.headerMenuShop")}
          </LocalizedClientLink>

          <span className="h-4 w-px shrink-0 bg-grey-30" aria-hidden />

          <a
            href={GNC_BLOG_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={linkBase}
          >
            <IconNewspaper className="h-4 w-4 text-grey-90" aria-hidden />
            {t("nav.headerMenuBlog")}
          </a>

          <LocalizedClientLink href={promo.liveWellSale} className={linkRed}>
            <IconDollarCircle className="h-4 w-4 text-header-red" aria-hidden />
            {t("nav.headerMenuLiveWellSale")}
          </LocalizedClientLink>

          <LocalizedClientLink href={promo.bestSellers} className={linkBase}>
            {t("nav.headerMenuBestSellers")}
          </LocalizedClientLink>

          <LocalizedClientLink href={promo.newOnTheDrop} className={linkBase}>
            {t("nav.headerMenuNewOnTheDrop")}
          </LocalizedClientLink>

          <LocalizedClientLink href={promo.creatine} className={linkBase}>
            {t("nav.headerMenuCreatine")}
          </LocalizedClientLink>

          <LocalizedClientLink href={promo.ghostCollection} className={linkRed}>
            {t("nav.headerMenuGhostPromo")}
          </LocalizedClientLink>
        </div>
      </div>
    </nav>
  )
}

function IconGrid({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden
    >
      <rect x="1" y="1" width="6" height="6" rx="0.5" />
      <rect x="9" y="1" width="6" height="6" rx="0.5" />
      <rect x="1" y="9" width="6" height="6" rx="0.5" />
      <rect x="9" y="9" width="6" height="6" rx="0.5" />
    </svg>
  )
}

function IconNewspaper({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 2.5h10a.5.5 0 01.5.5v10l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5-2 1.5V3a.5.5 0 01.5-.5z"
      />
      <path strokeLinecap="round" d="M5 5h6M5 7.5h4" />
    </svg>
  )
}

function IconDollarCircle({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle
        cx="8"
        cy="8"
        r="6.25"
        stroke="currentColor"
        strokeWidth="1.15"
      />
      <text
        x="8"
        y="11.25"
        textAnchor="middle"
        className="fill-current font-bold"
        style={{ fontSize: "8px", fontFamily: "system-ui, sans-serif" }}
      >
        $
      </text>
    </svg>
  )
}
