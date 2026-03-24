/**
 * Contentful Delivery API config for website content (e.g. website footer).
 * Set in .env.local: NEXT_PUBLIC_CONTENTFUL_SPACE_ID, NEXT_PUBLIC_CONTENTFUL_ACCESS_TOKEN
 */
export const CONTENTFUL_SPACE_ID =
  process.env.NEXT_PUBLIC_CONTENTFUL_SPACE_ID || "xurz88qk7d3f"
export const CONTENTFUL_ACCESS_TOKEN =
  process.env.NEXT_PUBLIC_CONTENTFUL_ACCESS_TOKEN || "qLWenEWxIs72ntOdM8fs6ph-o2qRSA7wuWWrPwrXUXw"
export const CONTENTFUL_ENVIRONMENT =
  process.env.NEXT_PUBLIC_CONTENTFUL_ENVIRONMENT || "master"

export const isContentfulConfigured = Boolean(
  CONTENTFUL_SPACE_ID && CONTENTFUL_ACCESS_TOKEN
)
