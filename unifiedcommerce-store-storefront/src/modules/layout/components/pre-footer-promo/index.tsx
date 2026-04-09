import { getLocale } from "@lib/data/locale-actions"
import { getTranslation, resolveTranslationLocale } from "@lib/i18n/translations"
import Link from "next/link"

type PreFooterPromoProps = {
  countryCode: string
}

/**
 * Two-column promotional strip (BOGO + subscription) directly above the site footer.
 */
export default async function PreFooterPromo({ countryCode }: PreFooterPromoProps) {
  const localeCookie = await getLocale()
  const t = (key: string) =>
    getTranslation(resolveTranslationLocale(localeCookie), key)
  const plpHref = `/${countryCode}/store`

  return (
    <section
      className="w-full border-t border-neutral-200 bg-[#F5F5F5]"
      aria-label={t("footer.preFooter.ariaLabel")}
    >
      <div className="content-container py-10 small:py-12 tablet:py-14">
        <div className="flex flex-col md:flex-row md:items-stretch md:justify-center">
          <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
            <h2 className="text-xl font-bold leading-tight text-[#111]">
              {t("footer.preFooter.bogoTitle")}
            </h2>
            <p className="mt-2 max-w-lg text-sm font-normal leading-snug text-[#111]">
              {t("footer.preFooter.bogoSubtext")}
            </p>
          </div>

          {/* Mobile: horizontal rule · Desktop: vertical divider */}
          <div
            className="mx-auto my-8 h-px w-full max-w-xs shrink-0 bg-neutral-800 md:mx-6 md:my-0 md:h-auto md:min-h-[5rem] md:w-px md:max-w-none md:self-stretch"
            role="presentation"
            aria-hidden
          />

          <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
            <Link
              href={plpHref}
              className="group max-w-lg rounded-md outline-none transition-colors hover:text-[#111] focus-visible:ring-2 focus-visible:ring-neutral-800 focus-visible:ring-offset-2"
              aria-label={t("footer.preFooter.subscriptionPromoLinkAria")}
            >
              <h2 className="text-xl font-bold leading-tight text-[#111] underline-offset-4 group-hover:underline">
                {t("footer.preFooter.subscriptionTitle")}
              </h2>
              <p className="mt-2 text-sm font-normal leading-snug text-[#111]">
                {t("footer.preFooter.subscriptionSubtext")}
              </p>
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
