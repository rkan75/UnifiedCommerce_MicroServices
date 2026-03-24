import { Metadata } from "next"
import { Heading, Text, Button } from "@medusajs/ui"
import { getLocale } from "@lib/data/locale-actions"
import { getTranslation } from "@lib/i18n/translations"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { Envelope, Phone, MapPin, Buildings } from "@medusajs/icons"

export const metadata: Metadata = {
  title: "Contact Us | TCS UnifiedCommerce Store",
  description: "Contact TCS UnifiedCommerce Store - We're here to help!",
}

export default async function ContactPage() {
  const localeCookie = await getLocale()
  const locale = localeCookie?.split("-")[0] || "en"
  const t = (key: string) => getTranslation(locale as "en" | "es", key)

  return (
    <div className="content-container py-6 small:py-12">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-3xl small:text-4xl font-bold mb-4 text-ui-fg-base">
            What's on your mind?
          </h1>
          <p className="text-lg text-ui-fg-subtle">
            We're here to help! Tell us what you're looking for and we'll get you connected to the right people.
          </p>
        </div>

        <div className="grid grid-cols-1 small:grid-cols-2 gap-6 mb-12">
          {/* Request for Services */}
          <div className="border border-ui-border-base rounded-lg p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <Buildings className="w-8 h-8 text-ui-fg-interactive" />
              </div>
              <div className="flex-1">
                <Heading level="h3" className="text-xl font-semibold mb-2 text-ui-fg-base">
                  Request for Services
                </Heading>
                <Text className="text-ui-fg-subtle mb-4">
                  Interested in our services? Get in touch with our team to discuss how we can help your business.
                </Text>
                <a 
                  href="mailto:services@unifiedomnichannel.com"
                  className="text-ui-fg-interactive hover:text-ui-fg-interactive-hover font-medium"
                >
                  Contact Services Team →
                </a>
              </div>
            </div>
          </div>

          {/* Investor Information */}
          <div className="border border-ui-border-base rounded-lg p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <Buildings className="w-8 h-8 text-ui-fg-interactive" />
              </div>
              <div className="flex-1">
                <Heading level="h3" className="text-xl font-semibold mb-2 text-ui-fg-base">
                  Investor Information
                </Heading>
                <Text className="text-ui-fg-subtle mb-4">
                  Looking for investor relations information? Connect with our investor relations team.
                </Text>
                <a 
                  href="mailto:investors@unifiedomnichannel.com"
                  className="text-ui-fg-interactive hover:text-ui-fg-interactive-hover font-medium"
                >
                  Contact Investor Relations →
                </a>
              </div>
            </div>
          </div>

          {/* Media Contacts */}
          <div className="border border-ui-border-base rounded-lg p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <Envelope className="w-8 h-8 text-ui-fg-interactive" />
              </div>
              <div className="flex-1">
                <Heading level="h3" className="text-xl font-semibold mb-2 text-ui-fg-base">
                  Media Contacts
                </Heading>
                <Text className="text-ui-fg-subtle mb-4">
                  Press inquiries, media requests, or need information for a story? Reach out to our media team.
                </Text>
                <a 
                  href="mailto:media@unifiedomnichannel.com"
                  className="text-ui-fg-interactive hover:text-ui-fg-interactive-hover font-medium"
                >
                  Contact Media Team →
                </a>
              </div>
            </div>
          </div>

          {/* General Contact */}
          <div className="border border-ui-border-base rounded-lg p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <Phone className="w-8 h-8 text-ui-fg-interactive" />
              </div>
              <div className="flex-1">
                <Heading level="h3" className="text-xl font-semibold mb-2 text-ui-fg-base">
                  General Inquiry
                </Heading>
                <Text className="text-ui-fg-subtle mb-4">
                  Have a general question or need assistance? Our customer service team is ready to help.
                </Text>
                <a 
                  href="mailto:contact@unifiedomnichannel.com"
                  className="text-ui-fg-interactive hover:text-ui-fg-interactive-hover font-medium"
                >
                  Contact Customer Service →
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Looking for something else? */}
        <div className="mb-12">
          <Heading level="h2" className="text-2xl font-semibold mb-6 text-ui-fg-base">
            Looking for something else?
          </Heading>
          <div className="grid grid-cols-1 small:grid-cols-2 gap-4">
            <div className="border border-ui-border-base rounded-lg p-4 hover:bg-ui-bg-subtle-hover transition-colors">
              <a 
                href="mailto:analyst@unifiedomnichannel.com"
                className="block"
              >
                <Heading level="h4" className="text-lg font-medium mb-1 text-ui-fg-base">
                  Analyst Relations
                </Heading>
                <Text className="text-sm text-ui-fg-subtle">
                  Connect with our analyst relations team
                </Text>
              </a>
            </div>
            <div className="border border-ui-border-base rounded-lg p-4 hover:bg-ui-bg-subtle-hover transition-colors">
              <a 
                href="mailto:csr@unifiedomnichannel.com"
                className="block"
              >
                <Heading level="h4" className="text-lg font-medium mb-1 text-ui-fg-base">
                  CSR
                </Heading>
                <Text className="text-sm text-ui-fg-subtle">
                  Corporate Social Responsibility inquiries
                </Text>
              </a>
            </div>
            <div className="border border-ui-border-base rounded-lg p-4 hover:bg-ui-bg-subtle-hover transition-colors">
              <a 
                href="mailto:partnerships@unifiedomnichannel.com"
                className="block"
              >
                <Heading level="h4" className="text-lg font-medium mb-1 text-ui-fg-base">
                  Partnerships
                </Heading>
                <Text className="text-sm text-ui-fg-subtle">
                  Partnership and collaboration opportunities
                </Text>
              </a>
            </div>
            <div className="border border-ui-border-base rounded-lg p-4 hover:bg-ui-bg-subtle-hover transition-colors">
              <a 
                href="mailto:feedback@unifiedomnichannel.com"
                className="block"
              >
                <Heading level="h4" className="text-lg font-medium mb-1 text-ui-fg-base">
                  Website Feedback
                </Heading>
                <Text className="text-sm text-ui-fg-subtle">
                  Share your feedback about our website
                </Text>
              </a>
            </div>
          </div>
        </div>

        {/* Contact Information */}
        <div className="border-t border-ui-border-base pt-8">
          <Heading level="h2" className="text-2xl font-semibold mb-6 text-ui-fg-base">
            Contact Information
          </Heading>
          <div className="grid grid-cols-1 small:grid-cols-2 gap-6">
            <div className="flex items-start gap-4">
              <MapPin className="w-6 h-6 text-ui-fg-interactive flex-shrink-0 mt-1" />
              <div>
                <Heading level="h4" className="text-lg font-semibold mb-2 text-ui-fg-base">
                  Address
                </Heading>
                <Text className="text-ui-fg-subtle">
                  TCS UnifiedCommerce Store<br />
                  TCS House, 2nd Floor, Raveline Street<br />
                  Fort Mumbai 400 001, India
                </Text>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <Envelope className="w-6 h-6 text-ui-fg-interactive flex-shrink-0 mt-1" />
              <div>
                <Heading level="h4" className="text-lg font-semibold mb-2 text-ui-fg-base">
                  Email
                </Heading>
                <Text className="text-ui-fg-subtle">
                  <a 
                    href="mailto:contact@unifiedomnichannel.com"
                    className="text-ui-fg-interactive hover:text-ui-fg-interactive-hover"
                  >
                    contact@unifiedomnichannel.com
                  </a>
                </Text>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <Phone className="w-6 h-6 text-ui-fg-interactive flex-shrink-0 mt-1" />
              <div>
                <Heading level="h4" className="text-lg font-semibold mb-2 text-ui-fg-base">
                  Phone
                </Heading>
                <Text className="text-ui-fg-subtle">
                  <a 
                    href="tel:+912266666666"
                    className="text-ui-fg-interactive hover:text-ui-fg-interactive-hover"
                  >
                    +91 22 6666 6666
                  </a>
                </Text>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <Buildings className="w-6 h-6 text-ui-fg-interactive flex-shrink-0 mt-1" />
              <div>
                <Heading level="h4" className="text-lg font-semibold mb-2 text-ui-fg-base">
                  Global Presence
                </Heading>
                <Text className="text-ui-fg-subtle">
                  55 countries, 6 continents, 500,000+ associates
                </Text>
              </div>
            </div>
          </div>
        </div>

        {/* Additional Help */}
        <div className="mt-12 pt-8 border-t border-ui-border-base">
          <div className="bg-ui-bg-subtle rounded-lg p-6">
            <Heading level="h3" className="text-xl font-semibold mb-3 text-ui-fg-base">
              Need More Help?
            </Heading>
            <Text className="text-ui-fg-subtle mb-4">
              Visit our help center for frequently asked questions, order tracking, returns, and more.
            </Text>
            <div className="flex flex-wrap gap-4">
              <LocalizedClientLink href="/account">
                <Button variant="secondary" size="small">
                  My Account
                </Button>
              </LocalizedClientLink>
              <LocalizedClientLink href="/account/orders">
                <Button variant="secondary" size="small">
                  Order History
                </Button>
              </LocalizedClientLink>
              <LocalizedClientLink href="/store">
                <Button variant="secondary" size="small">
                  Browse Products
                </Button>
              </LocalizedClientLink>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
