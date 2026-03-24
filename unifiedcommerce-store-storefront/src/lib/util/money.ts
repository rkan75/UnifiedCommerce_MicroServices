import { isEmpty } from "./isEmpty"

/**
 * Divisors to convert API minor units → major units for display.
 * Medusa store API returns money fields (order/cart totals, line items) in minor units
 * (e.g. USD cents: 1099 → $10.99).
 */
const MINOR_UNIT_DIVISORS: Record<string, number> = {
  usd: 100,
  eur: 100,
  gbp: 100,
  cad: 100,
  aud: 100,
  chf: 100,
  jpy: 1,
  krw: 1,
}

type ConvertToLocaleParams = {
  amount: number
  currency_code: string
  minimumFractionDigits?: number
  maximumFractionDigits?: number
  locale?: string
  /** When true, treats amount as minor unit (e.g. cents) and converts for display */
  fromMinorUnit?: boolean
}

export const convertToLocale = ({
  amount,
  currency_code,
  minimumFractionDigits,
  maximumFractionDigits,
  locale = "en-US",
  fromMinorUnit = false,
}: ConvertToLocaleParams) => {
  const displayAmount = fromMinorUnit
    ? amount /
      (MINOR_UNIT_DIVISORS[currency_code?.toLowerCase()] ?? 100)
    : amount
  return currency_code && !isEmpty(currency_code)
    ? new Intl.NumberFormat(locale, {
        style: "currency",
        currency: currency_code,
        minimumFractionDigits,
        maximumFractionDigits,
      }).format(displayAmount)
    : amount.toString()
}

/** Format a Medusa order/cart money field (always minor units) for display. */
export const formatMinorCurrency = (
  amount: number | null | undefined,
  currency_code: string | null | undefined,
  locale?: string
) => {
  if (amount == null || !currency_code || isEmpty(currency_code)) {
    return "—"
  }
  return convertToLocale({
    amount,
    currency_code,
    fromMinorUnit: true,
    locale,
  })
}
