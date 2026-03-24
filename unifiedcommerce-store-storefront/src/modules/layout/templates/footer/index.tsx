import { Text } from "@medusajs/ui"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { getLocale } from "@lib/data/locale-actions"
import {
  getWebsiteFooter,
  type FooterLink,
  type FooterSocialLink,
} from "@lib/data/contentful-footer"
import { getTranslation } from "@lib/i18n/translations"

export default async function Footer() {
  const localeCookie = await getLocale()
  const locale = localeCookie?.split("-")[0] || "en"
  const t = (key: string) => getTranslation(locale as "en" | "es", key)

  const contentfulFooter = await getWebsiteFooter(locale)

  // Debug: Log Contentful footer data (remove in production)
  if (process.env.NODE_ENV === "development") {
    console.log("[Footer] Contentful footer data:", {
      hasData: !!contentfulFooter,
      copyrightText: contentfulFooter?.copyrightText,
      hasSections: !!contentfulFooter?.sections?.length,
      hasBottomLinks: !!contentfulFooter?.bottomLinks?.length,
      locale,
    })
  }

  return (
    <footer className="border-t border-ui-border-base w-full bg-ui-bg-subtle">
      <div className="content-container flex flex-col w-full">
        {/* Main Footer Links: from Contentful or static translations */}
        <div className="py-8 tablet:py-12 grid grid-cols-2 tablet:grid-cols-3 small:grid-cols-5 gap-6 tablet:gap-8 small:gap-12">
          {contentfulFooter?.sections && contentfulFooter.sections.length > 0 ? (
            contentfulFooter.sections.map((section) => (
              <div key={section.title} className="flex flex-col gap-y-4">
                <h3 className="txt-small-plus txt-ui-fg-base font-semibold">
                  {section.title}
                </h3>
                <ul className="flex flex-col gap-3 text-ui-fg-subtle txt-small">
                  {section.links.map((link) => (
                    <li key={link.label + link.href}>
                      <FooterLinkOrLocalized link={link} />
                    </li>
                  ))}
                </ul>
              </div>
            ))
          ) : (
            <>
              <FooterSectionStatic title={t("footer.services")} t={t} links={[
                { label: t("footer.myAccount"), href: "/account" },
                { label: t("footer.orderHistory"), href: "/account/orders" },
                { label: t("footer.shoppingCart"), href: "/cart" },
                { label: t("footer.deliveryAddresses"), href: "/account/addresses" },
              ]} />
              <FooterSectionStatic title={t("footer.waysToSave")} t={t} links={[
                { label: t("footer.weeklyDeals"), href: "/weekly-ad" },
                { label: t("footer.digitalCoupons"), href: "/weekly-ad" },
                { label: t("footer.specialOffers"), href: "/weekly-ad" },
              ]} />
              <FooterSectionStatic title={t("footer.customerService")} t={t} links={[
                { label: t("footer.helpCenter"), href: "/account" },
                { label: t("footer.trackOrder"), href: "/account/orders" },
                { label: t("footer.contactUs"), href: "/contact" },
                { label: t("footer.faqs"), href: "/account" },
              ]} />
              <FooterSectionStatic title={t("footer.about")} t={t} links={[
                { label: t("footer.ourStory"), href: "/our-story" },
                { label: t("footer.careers"), href: "/careers" },
                { label: t("footer.storeLocator"), href: "/store" },
              ]} />
            </>
          )}

          {/* Follow Us / Social + Apps: from Contentful or static */}
          <div className="flex flex-col gap-y-4">
            <h3 className="txt-small-plus txt-ui-fg-base font-semibold">
              {contentfulFooter?.sections?.length
                ? contentfulFooter.sections[contentfulFooter.sections.length - 1]?.title ?? t("footer.followUs")
                : t("footer.followUs")}
            </h3>
            <div className="flex flex-col gap-4">
              <SocialAndAppsBlock
                contentfulFooter={contentfulFooter}
                t={t}
              />
            </div>
          </div>
        </div>

        {/* Bottom Bar: from Contentful or static */}
        <div className="border-t border-ui-border-base py-4 tablet:py-6 flex flex-col tablet:flex-row justify-between items-center gap-3 tablet:gap-4">
          <Text className="txt-compact-small text-ui-fg-muted">
            {(contentfulFooter?.copyrightText && typeof contentfulFooter.copyrightText === "string" && contentfulFooter.copyrightText.trim()) 
              ? contentfulFooter.copyrightText.trim()
              : `© ${new Date().getFullYear()} TCS UnifiedCommerce Store. ${t("footer.allRightsReserved")}`}
          </Text>
          <div className="flex flex-wrap gap-4 text-ui-fg-muted txt-compact-small">
            {contentfulFooter?.bottomLinks && contentfulFooter.bottomLinks.length > 0 ? (
              contentfulFooter.bottomLinks.map((link, i) => (
                <span key={link.label + link.href} className="flex items-center gap-4">
                  {i > 0 && <span>|</span>}
                  <FooterLinkOrLocalized link={link} />
                </span>
              ))
            ) : (
              <>
                <LocalizedClientLink href="/privacy" className="hover:text-ui-fg-base transition-colors">
                  {t("footer.privacyPolicy")}
                </LocalizedClientLink>
                <span>|</span>
                <LocalizedClientLink href="/terms" className="hover:text-ui-fg-base transition-colors">
                  {t("footer.termsOfService")}
                </LocalizedClientLink>
                <span>|</span>
                <LocalizedClientLink href="/cookies" className="hover:text-ui-fg-base transition-colors">
                  {t("footer.cookiePolicy")}
                </LocalizedClientLink>
              </>
            )}
          </div>
        </div>
      </div>
    </footer>
  )
}

function FooterLinkOrLocalized({ link }: { link: FooterLink }) {
  const isExternal = link.href.startsWith("http")
  if (isExternal) {
    return (
      <a
        href={link.href}
        target="_blank"
        rel="noopener noreferrer"
        className="hover:text-ui-fg-base transition-colors"
      >
        {link.label}
      </a>
    )
  }
  return (
    <LocalizedClientLink href={link.href} className="hover:text-ui-fg-base transition-colors">
      {link.label}
    </LocalizedClientLink>
  )
}

function FooterSectionStatic({
  title,
  t,
  links,
}: {
  title: string
  t: (key: string) => string
  links: { label: string; href: string }[]
}) {
  return (
    <div className="flex flex-col gap-y-4">
      <h3 className="txt-small-plus txt-ui-fg-base font-semibold">{title}</h3>
      <ul className="flex flex-col gap-3 text-ui-fg-subtle txt-small">
        {links.map((link) => (
          <li key={link.label}>
            <LocalizedClientLink href={link.href} className="hover:text-ui-fg-base transition-colors">
              {link.label}
            </LocalizedClientLink>
          </li>
        ))}
      </ul>
    </div>
  )
}

function SocialAndAppsBlock({
  contentfulFooter,
  t,
}: {
  contentfulFooter: import("@lib/data/contentful-footer").WebsiteFooterContent | null;
  t: (key: string) => string;
}) {
  const socialLinks = contentfulFooter?.socialLinks?.length
    ? contentfulFooter.socialLinks
    : ([
        { url: "https://www.facebook.com", ariaLabel: "Facebook", platform: "facebook" },
        { url: "https://www.instagram.com", ariaLabel: "Instagram", platform: "instagram" },
        { url: "https://www.twitter.com", ariaLabel: "X (Twitter)", platform: "twitter" },
        { url: "https://www.pinterest.com", ariaLabel: "Pinterest", platform: "pinterest" },
        { url: "https://www.youtube.com", ariaLabel: "YouTube", platform: "youtube" },
      ] as FooterSocialLink[])
  const appStoreUrl = contentfulFooter?.appStoreUrl || "https://apps.apple.com"
  const playStoreUrl = contentfulFooter?.playStoreUrl || "https://play.google.com"
  const downloadLabel = contentfulFooter?.downloadOurAppsLabel ?? t("footer.downloadOurApps")

  return (
    <>
      <div className="flex flex-wrap gap-3">
        {socialLinks.map((s) => (
          <a
            key={s.url}
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            className="w-8 h-8 flex items-center justify-center rounded-full bg-ui-bg-base hover:bg-ui-bg-subtle-hover transition-colors"
            aria-label={s.ariaLabel || s.platform || "Social"}
          >
            <SocialIcon platform={s.platform} />
          </a>
        ))}
      </div>
      <div className="flex flex-col gap-3">
        <p className="txt-small text-ui-fg-subtle font-medium">{downloadLabel}</p>
        <div className="flex flex-col gap-2">
          <a href={appStoreUrl} target="_blank" rel="noopener noreferrer" className="inline-block hover:opacity-80 transition-opacity" aria-label="Download on the App Store">
            <AppStoreSvg />
          </a>
          <a href={playStoreUrl} target="_blank" rel="noopener noreferrer" className="inline-block hover:opacity-80 transition-opacity" aria-label="Get it on Google Play">
            <GooglePlaySvg />
          </a>
        </div>
      </div>
    </>
  )
}

function SocialIcon({ platform }: { platform?: string }) {
  const p = (platform || "").toLowerCase()
  const path =
    p === "facebook" ? "M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" :
    p === "instagram" ? "M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.98-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.98-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162z" :
    p === "twitter" || p === "x" ? "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" :
    p === "youtube" ? "M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" :
    "M12 0C5.373 0 0 5.372 0 12s5.373 12 12 12c5.302 0 9.917-3.176 11.827-7.73-.105-.778-.199-1.97.041-2.81.22-.896 1.403-5.963 1.403-5.963s-.357-.715-.357-1.774c0-1.66.962-2.9 2.16-2.9 1.019 0 1.512.765 1.512 1.682 0 1.025-.653 2.557-.99 3.978-.281 1.19.597 2.16 1.77 2.16 2.123 0 3.756-2.24 3.756-5.472 0-2.86-2.058-4.86-5.001-4.86-3.404 0-5.404 2.555-5.404 5.19 0 1.027.395 2.13 1.088 2.495.12.056.186.031.214-.09l.17-.69c.054-.22.033-.298-.12-.493-.332-.394-.544-.9-.544-1.62 0-2.09 1.586-4.008 4.58-4.008 2.406 0 4.177 1.754 4.177 4.095 0 2.39-1.505 4.31-3.75 4.31-.732 0-1.42-.38-1.656-.844l-.448 1.705c-.162.629-.6 1.417-.893 1.9-.32.54.154 1.98.23 2.12.114.222.16.27.368.165 1.38-.64 1.94-2.64 1.94-4.25 0-3.44-2.52-6.6-7.28-6.6-4.95 0-7.9 3.68-7.9 7.68 0 1.39.54 2.88 1.21 3.78.13.16.15.3.11.46l-.45 1.75c-.08.31-.26.42-.6.31-1.58-.58-2.56-2.4-2.56-3.86 0-3.12 2.27-5.98 6.54-5.98 3.42 0 6.07 2.44 6.07 5.7 0 3.4-2.14 6.13-5.13 6.13-1 0-1.95-.52-2.27-1.21l-.62 2.37c-.23.88-.85 1.98-1.27 2.65C4.48 22.8 8.03 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"
  return (
    <svg className="w-5 h-5 text-ui-fg-subtle hover:text-ui-fg-base" fill="currentColor" viewBox="0 0 24 24">
      <path d={path} />
    </svg>
  )
}

function AppStoreSvg() {
  return (
    <svg width="120" height="40" viewBox="0 0 120 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-[120px] h-[40px]">
      <rect width="120" height="40" rx="6" fill="#000" />
      <path d="M26.5 12.5C27.3284 11.6716 28 10.3284 28 9C28 7.67157 27.3284 6.32843 26.5 5.5C25.6716 4.67157 24.3284 4 23 4C21.6716 4 20.3284 4.67157 19.5 5.5C18.6716 6.32843 18 7.67157 18 9C18 10.3284 18.6716 11.6716 19.5 12.5C20.3284 13.3284 21.6716 14 23 14C24.3284 14 25.6716 13.3284 26.5 12.5Z" fill="#fff" />
      <path d="M20 16V28H26V16H20Z" fill="#fff" />
      <text x="35" y="18" fill="#fff" fontSize="9" fontWeight="400" fontFamily="Arial, sans-serif">Download on the</text>
      <text x="35" y="30" fill="#fff" fontSize="13" fontWeight="600" fontFamily="Arial, sans-serif">App Store</text>
    </svg>
  )
}

function GooglePlaySvg() {
  return (
    <svg width="135" height="40" viewBox="0 0 135 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-[135px] h-[40px]">
      <rect width="135" height="40" rx="6" fill="#000" />
      <path d="M8 12L18 20L8 28V12Z" fill="#fff" />
      <path d="M18 20L28 12V28L18 20Z" fill="#fff" />
      <path d="M28 12L38 18L28 24V12Z" fill="#fff" />
      <text x="45" y="18" fill="#fff" fontSize="9" fontWeight="400" fontFamily="Arial, sans-serif">GET IT ON</text>
      <text x="45" y="30" fill="#fff" fontSize="13" fontWeight="600" fontFamily="Arial, sans-serif">Google Play</text>
    </svg>
  )
}
