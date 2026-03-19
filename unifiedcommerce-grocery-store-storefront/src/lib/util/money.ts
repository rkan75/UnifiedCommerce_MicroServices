import { isEmpty } from "./isEmpty"

/** Currencies that use 2 decimal places (USD 1000 = $10.00). */
const MINOR_UNIT_DIVISORS: Record<string, number> = {
  usd: 100,
  eur: 100,
  gbp: 100,
  cad: 100,
  aud: 100,
  chf: 100,
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
