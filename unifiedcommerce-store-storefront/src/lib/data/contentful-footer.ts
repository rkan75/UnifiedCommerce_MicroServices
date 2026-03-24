import {
  CONTENTFUL_ACCESS_TOKEN,
  CONTENTFUL_ENVIRONMENT,
  CONTENTFUL_SPACE_ID,
  isContentfulConfigured,
} from "@lib/contentful/config"

/** Link item for footer sections and bottom bar */
export type FooterLink = { label: string; href: string }

/** One column in the footer (e.g. Services, Customer Service) */
export type FooterSection = {
  title: string
  links: FooterLink[]
}

/** Social link with optional platform for icon */
export type FooterSocialLink = {
  platform?: string
  url: string
  ariaLabel: string
}

/** Normalized website footer content (from Contentful or fallback) */
export type WebsiteFooterContent = {
  sections: FooterSection[]
  copyrightText: string
  bottomLinks: FooterLink[]
  socialLinks: FooterSocialLink[]
  appStoreUrl: string | null
  playStoreUrl: string | null
  downloadOurAppsLabel: string | null
}

const CONTENT_TYPE_WEBSITE_FOOTER = "websiteFooter"

/** Raw Contentful entry fields (locale-specific values) */
type ContentfulEntryFields = {
  sections?: { [locale: string]: string }
  copyrightText?: { [locale: string]: string }
  bottomLinks?: { [locale: string]: string }
  socialLinks?: { [locale: string]: string }
  appStoreUrl?: { [locale: string]: string }
  playStoreUrl?: { [locale: string]: string }
  downloadOurAppsLabel?: { [locale: string]: string }
}

function parseJson<T>(raw: string | undefined, fallback: T): T {
  if (!raw || typeof raw !== "string") return fallback
  try {
    const parsed = JSON.parse(raw) as T
    return Array.isArray(parsed) ? parsed : fallback
  } catch {
    return fallback
  }
}

function getLocalizedValue(
  field: { [locale: string]: string } | undefined,
  locale: string
): string {
  if (!field || typeof field !== "object") return ""
  const normalizedLocale = locale.split("-")[0].toLowerCase()
  return (
    field[normalizedLocale] ??
    field[locale] ??
    field["en"] ??
    Object.values(field)[0] ??
    ""
  )
}

/**
 * Fetch website footer content from Contentful (content model: websiteFooter).
 * Returns null if Contentful is not configured or the request fails.
 */
export async function getWebsiteFooter(
  locale: string = "en"
): Promise<WebsiteFooterContent | null> {
  if (!isContentfulConfigured) return null

  const url = new URL(
    `https://cdn.contentful.com/spaces/${CONTENTFUL_SPACE_ID}/environments/${CONTENTFUL_ENVIRONMENT}/entries`
  )
  url.searchParams.set("access_token", CONTENTFUL_ACCESS_TOKEN)
  url.searchParams.set("content_type", CONTENT_TYPE_WEBSITE_FOOTER)
  url.searchParams.set("limit", "1")

  try {
    const res = await fetch(url.toString(), {
      next: { revalidate: 60 },
    })
    if (!res.ok) return null
    const data = (await res.json()) as {
      items?: Array<{ fields?: ContentfulEntryFields }>
    }
    const item = data.items?.[0]
    const fields = item?.fields as ContentfulEntryFields | undefined
    if (!fields) return null

    const sectionsRaw = getLocalizedValue(fields.sections, locale)
    const bottomLinksRaw = getLocalizedValue(fields.bottomLinks, locale)
    const socialLinksRaw = getLocalizedValue(fields.socialLinks, locale)

    const sectionsParsed = parseJson<FooterSection[]>(sectionsRaw, [])
    const bottomLinksParsed = parseJson<FooterLink[]>(bottomLinksRaw, [])
    const socialLinksParsed = parseJson<FooterSocialLink[]>(socialLinksRaw, [])

    return {
      sections: Array.isArray(sectionsParsed) ? sectionsParsed : [],
      copyrightText: getLocalizedValue(fields.copyrightText, locale) || "",
      bottomLinks: Array.isArray(bottomLinksParsed) ? bottomLinksParsed : [],
      socialLinks: Array.isArray(socialLinksParsed) ? socialLinksParsed : [],
      appStoreUrl:
        getLocalizedValue(fields.appStoreUrl, locale) || null,
      playStoreUrl:
        getLocalizedValue(fields.playStoreUrl, locale) || null,
      downloadOurAppsLabel:
        getLocalizedValue(fields.downloadOurAppsLabel, locale) || null,
    }
  } catch {
    return null
  }
}
