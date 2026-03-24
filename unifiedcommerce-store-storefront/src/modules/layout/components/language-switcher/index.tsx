"use client"

import { useRouter } from "next/navigation"
import { useTransition, useEffect, useState, useRef } from "react"
import { Listbox, Transition } from "@headlessui/react"
import { ChevronUpDown } from "@medusajs/icons"
import { clx } from "@medusajs/ui"
import { Fragment } from "react"
import { updateLocale } from "@lib/data/locale-actions"

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null
  const value = `; ${document.cookie}`
  const parts = value.split(`; ${name}=`)
  if (parts.length === 2) return parts.pop()?.split(";").shift() || null
  return null
}

function setCookie(name: string, value: string, days: number = 365) {
  if (typeof document === "undefined") return
  const expires = new Date()
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000)
  document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/;SameSite=Strict`
}

type LanguageOption = {
  value: "en" | "es" | ""
  label: string
}

const languageOptions: LanguageOption[] = [
  { value: "", label: "Select Language" },
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
]

export default function LanguageSwitcher() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  // Always initialize to empty string to match server render
  const [currentLocale, setCurrentLocale] = useState<string>("")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // Set mounted to true after hydration
    setMounted(true)
    
    // Then read cookie and update locale
    const cookieLocale = getCookie("_medusa_locale")
    if (cookieLocale) {
      const lang = cookieLocale.split("-")[0].toLowerCase()
      const newLocale = lang === "es" ? "es" : "en"
      setCurrentLocale(newLocale)
    } else {
      setCurrentLocale("")
    }
  }, [])

  const handleLanguageChange = (value: string) => {
    if (value === "" || value === currentLocale) return

    const locale = value as "en" | "es"
    // Set cookie immediately on client side
    const localeCode = locale === "en" ? "en-US" : "es-ES"
    setCookie("_medusa_locale", localeCode)
    setCurrentLocale(locale)

    // Dispatch custom event immediately for instant UI update
    if (typeof window !== "undefined") {
      const event = new CustomEvent("localechange", { 
        detail: { locale },
        bubbles: true 
      })
      window.dispatchEvent(event)
    }

    // Then sync with server
    startTransition(async () => {
      try {
        await updateLocale(localeCode)
      } catch (e) {
        // Stale server action ID (e.g. after dev server restart) — refresh to get new action IDs
        const msg = e instanceof Error ? e.message : String(e)
        if (msg.includes("was not found") || msg.includes("UnrecognizedActionError")) {
          router.refresh()
          return
        }
        throw e
      }
      router.refresh()
    })
  }

  const selectedOption = languageOptions.find(
    (opt) => opt.value === currentLocale
  ) || languageOptions[0]

  return (
    <div className="relative">
      <Listbox
        value={currentLocale}
        onChange={handleLanguageChange}
        disabled={isPending}
      >
        <Listbox.Button
          className={clx(
            "relative w-full flex justify-between items-center px-3 py-2 text-left bg-white cursor-default focus:outline-none border rounded-md focus-visible:ring-2 focus-visible:ring-opacity-75 focus-visible:ring-white focus-visible:ring-offset-gray-300 focus-visible:ring-offset-2 focus-visible:border-gray-300 text-sm",
            {
              "opacity-50 cursor-not-allowed": isPending,
            }
          )}
        >
          {({ open }) => (
            <>
              <span className="block truncate">{selectedOption.label}</span>
              <ChevronUpDown
                className={clx("ml-2 h-4 w-4 text-gray-400 transition-transform duration-200", {
                  "transform rotate-180": open,
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
          <Listbox.Options className="absolute z-50 mt-1 w-full overflow-auto bg-white border rounded-md shadow-lg max-h-60 focus:outline-none text-sm">
            {languageOptions.map((option) => (
              <Listbox.Option
                key={option.value}
                value={option.value}
                className={({ active }) =>
                  clx(
                    "cursor-default select-none relative py-2 px-4",
                    {
                      "bg-gray-100": active,
                      "bg-gray-50": option.value === currentLocale,
                      "text-gray-400": option.value === "",
                    }
                  )
                }
                disabled={option.value === ""}
              >
                {({ selected }) => (
                  <div className="flex items-center">
                    <span
                      className={clx("block truncate", {
                        "font-medium": selected,
                        "font-normal": !selected,
                      })}
                    >
                      {option.label}
                    </span>
                    {selected && option.value !== "" && (
                      <span className="absolute inset-y-0 right-0 flex items-center pr-4 text-gray-600">
                        ✓
                      </span>
                    )}
                  </div>
                )}
              </Listbox.Option>
            ))}
          </Listbox.Options>
        </Transition>
      </Listbox>
    </div>
  )
}
