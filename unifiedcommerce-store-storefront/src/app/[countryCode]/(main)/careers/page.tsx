import { Metadata } from "next"
import { Heading, Text, Button } from "@medusajs/ui"
import { getLocale } from "@lib/data/locale-actions"
import { getTranslation } from "@lib/i18n/translations"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { Buildings, Users, CheckCircleSolid, Sparkles } from "@medusajs/icons"

export const metadata: Metadata = {
  title: "Careers | TCS UnifiedCommerce Store",
  description: "Build a future you believe in - Join TCS UnifiedCommerce Store and shape the future of technology.",
}

export default async function CareersPage() {
  const localeCookie = await getLocale()
  const locale = localeCookie?.split("-")[0] || "en"
  const t = (key: string) => getTranslation(locale as "en" | "es", key)

  return (
    <div className="content-container py-6 small:py-12">
      <div className="max-w-4xl mx-auto">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-3xl small:text-4xl font-bold mb-6 text-ui-fg-base">
            Build a future you believe in
          </h1>
          <div className="flex justify-center gap-4 mb-8">
            <a 
              href="mailto:careers@unifiedomnichannel.com"
              className="inline-block px-8 py-3 bg-ui-fg-interactive text-ui-fg-inverse rounded-md hover:bg-ui-fg-interactive-hover transition-colors font-medium"
            >
              Apply now
            </a>
          </div>
        </div>

        {/* Join Us Section */}
        <section className="mb-12">
          <Heading level="h2" className="text-2xl small:text-3xl font-bold mb-6 text-center text-ui-fg-base">
            Join us
          </Heading>
          <div className="bg-ui-bg-subtle rounded-lg p-8 text-center">
            <Heading level="h3" className="text-xl font-semibold mb-4 text-ui-fg-base">
              Shape the future of technology
            </Heading>
            <Text className="text-lg text-ui-fg-subtle">
              As a global company with unparalleled scale, a track record of pioneering innovation, and a huge and influential 
              client base, we offer associates a chance to drive change and improve the lives of millions of people around the world.
            </Text>
          </div>
        </section>

        {/* The TCS Difference */}
        <section className="mb-12">
          <Heading level="h2" className="text-2xl small:text-3xl font-bold mb-8 text-center text-ui-fg-base">
            The TCS Difference
          </Heading>
          <div className="grid grid-cols-1 small:grid-cols-2 gap-6">
            <div className="border border-ui-border-base rounded-lg p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <Sparkles className="w-8 h-8 text-ui-fg-interactive" />
                </div>
                <div className="flex-1">
                  <Heading level="h3" className="text-xl font-semibold mb-2 text-ui-fg-base">
                    Our research and innovation
                  </Heading>
                  <Text className="text-ui-fg-subtle mb-4">
                    We believe in the power of collective knowledge
                  </Text>
                  <LocalizedClientLink href="/our-story">
                    <span className="text-ui-fg-interactive hover:text-ui-fg-interactive-hover font-medium">
                      Discover more →
                    </span>
                  </LocalizedClientLink>
                </div>
              </div>
            </div>

            <div className="border border-ui-border-base rounded-lg p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <Users className="w-8 h-8 text-ui-fg-interactive" />
                </div>
                <div className="flex-1">
                  <Heading level="h3" className="text-xl font-semibold mb-2 text-ui-fg-base">
                    Our inclusive workplaces
                  </Heading>
                  <Text className="text-ui-fg-subtle mb-4">
                    We believe in a world where we can be, belong, become
                  </Text>
                  <LocalizedClientLink href="/our-story">
                    <span className="text-ui-fg-interactive hover:text-ui-fg-interactive-hover font-medium">
                      Read More →
                    </span>
                  </LocalizedClientLink>
                </div>
              </div>
            </div>

            <div className="border border-ui-border-base rounded-lg p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <CheckCircleSolid className="w-8 h-8 text-ui-fg-interactive" />
                </div>
                <div className="flex-1">
                  <Heading level="h3" className="text-xl font-semibold mb-2 text-ui-fg-base">
                    Our investment in innovation
                  </Heading>
                  <Text className="text-ui-fg-subtle mb-4">
                    We believe in nurturing fresh talent
                  </Text>
                  <a 
                    href="mailto:careers@unifiedomnichannel.com"
                    className="text-ui-fg-interactive hover:text-ui-fg-interactive-hover font-medium"
                  >
                    About CodeVita →
                  </a>
                </div>
              </div>
            </div>

            <div className="border border-ui-border-base rounded-lg p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <Buildings className="w-8 h-8 text-ui-fg-interactive" />
                </div>
                <div className="flex-1">
                  <Heading level="h3" className="text-xl font-semibold mb-2 text-ui-fg-base">
                    Our design-thinking philosophy
                  </Heading>
                  <Text className="text-ui-fg-subtle mb-4">
                    We believe in trying, testing, and tenacity
                  </Text>
                  <LocalizedClientLink href="/our-story">
                    <span className="text-ui-fg-interactive hover:text-ui-fg-interactive-hover font-medium">
                      The TCS Way →
                    </span>
                  </LocalizedClientLink>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Why TCS */}
        <section className="mb-12">
          <Heading level="h2" className="text-2xl small:text-3xl font-bold mb-8 text-center text-ui-fg-base">
            Why TCS
          </Heading>
          <div className="space-y-8">
            <div className="border border-ui-border-base rounded-lg p-8">
              <div className="flex items-start gap-4 mb-4">
                <div className="flex-shrink-0">
                  <CheckCircleSolid className="w-10 h-10 text-ui-fg-interactive" />
                </div>
                <div className="flex-1">
                  <Heading level="h3" className="text-2xl font-semibold mb-3 text-ui-fg-base">
                    Impact
                  </Heading>
                  <Heading level="h3" className="text-xl font-semibold mb-2 text-ui-fg-base">
                    Leading with purpose
                  </Heading>
                  <Text className="text-lg text-ui-fg-subtle">
                    Through the application of innovation and our contextual knowledge, we give associates the opportunity to 
                    deliver transformative outcomes that benefit society at large and prove that anything is possible.
                  </Text>
                </div>
              </div>
            </div>

            <div className="border border-ui-border-base rounded-lg p-8">
              <div className="flex items-start gap-4 mb-4">
                <div className="flex-shrink-0">
                  <Sparkles className="w-10 h-10 text-ui-fg-interactive" />
                </div>
                <div className="flex-1">
                  <Heading level="h3" className="text-2xl font-semibold mb-3 text-ui-fg-base">
                    Development
                  </Heading>
                  <Heading level="h3" className="text-xl font-semibold mb-2 text-ui-fg-base">
                    Continuous learning
                  </Heading>
                  <Text className="text-lg text-ui-fg-subtle">
                    We equip our associates to deliver innovative solutions, by providing them with opportunities to access and 
                    learn from the vast collective experience that exists within TCS. We ensure they remain at the cutting edge 
                    of change.
                  </Text>
                </div>
              </div>
            </div>

            <div className="border border-ui-border-base rounded-lg p-8">
              <div className="flex items-start gap-4 mb-4">
                <div className="flex-shrink-0">
                  <Users className="w-10 h-10 text-ui-fg-interactive" />
                </div>
                <div className="flex-1">
                  <Heading level="h3" className="text-2xl font-semibold mb-3 text-ui-fg-base">
                    Support
                  </Heading>
                  <Text className="text-lg text-ui-fg-subtle">
                    Through upskilling and reskilling, and with opportunities to move across the business, our people, regardless 
                    of age or stage of their career, are supported to discover and become the professionals they were meant to be.
                  </Text>
                </div>
              </div>
            </div>

            <div className="border border-ui-border-base rounded-lg p-8">
              <div className="flex items-start gap-4 mb-4">
                <div className="flex-shrink-0">
                  <Buildings className="w-10 h-10 text-ui-fg-interactive" />
                </div>
                <div className="flex-1">
                  <Heading level="h3" className="text-2xl font-semibold mb-3 text-ui-fg-base">
                    Progress
                  </Heading>
                  <Text className="text-lg text-ui-fg-subtle">
                    We see our people as long-term relationships that we build together and from which we all grow. We invest in 
                    them across the duration of their career and encourage them to strive for perpetual progress.
                  </Text>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Quote Section */}
        <section className="mb-12">
          <div className="bg-ui-bg-subtle rounded-lg p-8 border-l-4 border-ui-fg-interactive">
            <Text className="text-xl italic mb-4 text-ui-fg-subtle">
              "We are on an exciting journey to be the world's leading AI-driven technology services organization, led by a bold 
              vision to unlock endless possibilities and empower talent. Our commitment to lead with empathy, resilience, and purpose 
              enables us to create positive impact for our employees, customers, partners, and communities we live in."
            </Text>
            <div className="mt-4">
              <Text className="font-semibold text-ui-fg-base">Sudeep Kunnumal</Text>
              <Text className="text-ui-fg-subtle">Vice President & CHRO, Tata Consultancy Services</Text>
            </div>
          </div>
        </section>

        {/* A belief in diversity */}
        <section className="mb-12">
          <div className="bg-ui-bg-subtle rounded-lg p-8">
            <Heading level="h2" className="text-2xl font-bold mb-4 text-ui-fg-base">
              A belief in diversity
            </Heading>
            <Text className="text-lg text-ui-fg-subtle mb-4">
              How do you create remarkable change? By hiring, celebrating and nurturing the best people—from all walks of life.
            </Text>
            <LocalizedClientLink href="/our-story">
              <span className="text-ui-fg-interactive hover:text-ui-fg-interactive-hover font-medium">
                Learn more about us →
              </span>
            </LocalizedClientLink>
          </div>
        </section>

        {/* Greater futures through innovation */}
        <section className="mb-12">
          <div className="text-center">
            <Heading level="h2" className="text-2xl small:text-3xl font-bold mb-4 text-ui-fg-base">
              Greater futures through innovation
            </Heading>
            <Text className="text-lg text-ui-fg-subtle mb-6">
              Watching the world of next-tech unfold? It's time to be part of it. Explore challenging and exciting opportunities 
              across the globe.
            </Text>
            <div className="flex flex-col small:flex-row gap-4 justify-center">
              <a 
                href="mailto:careers@unifiedomnichannel.com"
                className="inline-block px-8 py-3 bg-ui-fg-interactive text-ui-fg-inverse rounded-md hover:bg-ui-fg-interactive-hover transition-colors font-medium text-center"
              >
                Search open roles
              </a>
              <LocalizedClientLink href="/contact">
                <Button variant="secondary" size="large">
                  Contact Us
                </Button>
              </LocalizedClientLink>
            </div>
          </div>
        </section>

        {/* Additional Information */}
        <section className="pt-8 border-t border-ui-border-base">
          <div className="grid grid-cols-1 small:grid-cols-2 gap-6">
            <div>
              <Heading level="h3" className="text-xl font-semibold mb-3 text-ui-fg-base">
                Benefits & Perks
              </Heading>
              <ul className="space-y-2 text-ui-fg-subtle">
                <li>• Competitive compensation packages</li>
                <li>• Comprehensive health benefits</li>
                <li>• Retirement savings plans</li>
                <li>• Professional development opportunities</li>
                <li>• Work-life balance programs</li>
                <li>• Global career opportunities</li>
              </ul>
            </div>
            <div>
              <Heading level="h3" className="text-xl font-semibold mb-3 text-ui-fg-base">
                Application Process
              </Heading>
              <ul className="space-y-2 text-ui-fg-subtle">
                <li>• Submit your application online</li>
                <li>• Initial screening and assessment</li>
                <li>• Interview with hiring team</li>
                <li>• Final selection and offer</li>
                <li>• Onboarding and orientation</li>
              </ul>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
