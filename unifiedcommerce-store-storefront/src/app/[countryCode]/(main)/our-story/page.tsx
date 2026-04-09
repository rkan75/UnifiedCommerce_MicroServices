import { Metadata } from "next"
import { Heading, Text } from "@medusajs/ui"
import { getLocale } from "@lib/data/locale-actions"
import { getTranslation, resolveTranslationLocale } from "@lib/i18n/translations"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { Buildings, Users, MapPin, CheckCircleSolid } from "@medusajs/icons"

export const metadata: Metadata = {
  title: "Our Story | TCS UnifiedCommerce Store",
  description: "Learn about TCS UnifiedCommerce Store - Building greater futures through innovation and collective knowledge.",
}

export default async function OurStoryPage() {
  const localeCookie = await getLocale()
  const t = (key: string) =>
    getTranslation(resolveTranslationLocale(localeCookie), key)

  return (
    <div className="content-container py-6 small:py-12">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-3xl small:text-4xl font-bold mb-4 text-ui-fg-base">
            About Us
          </h1>
          <p className="text-xl text-ui-fg-subtle max-w-3xl mx-auto">
            We deliver excellence and create value for customers and communities - everyday. With the best talent and the latest technology we help customers turn complexity into opportunities and create meaningful change.
          </p>
        </div>

        {/* Main Introduction */}
        <section className="mb-12">
          <div className="prose prose-lg max-w-none text-ui-fg-subtle">
            <p className="text-lg mb-4">
              TCS UnifiedCommerce Store is the technology partner of choice for industry-leading organizations worldwide. 
              Since its inception, we have upheld the highest standards of innovation, engineering excellence and customer service.
            </p>
            <p className="mb-4">
              We have set an aspiration to become the world's largest AI-led technology services company and are enabling 
              our clients to transform themselves across the full AI stack, from infrastructure to intelligence.
            </p>
            <p className="mb-4">
              Rooted in the heritage of the Tata Group, we are focused on creating long term value for our clients, our 
              investors, our employees, and the community at large. With a highly skilled workforce spread across 55 countries 
              and 202 service delivery centers across the world, we have been recognized as a top employer in six continents.
            </p>
            <p className="mb-4">
              With the ability to rapidly apply and scale new technologies, we have built long term partnerships with our 
              clients – helping them emerge as perpetually adaptive enterprises. Many of these relationships have endured into 
              decades and navigated every technology cycle, from mainframes in the 1970s to artificial intelligence today.
            </p>
            <p className="mb-4">
              We sponsor 14 of the world's most prestigious marathons and endurance events, including the TCS New York City 
              Marathon, TCS London Marathon and TCS Sydney Marathon with a focus on promoting health, sustainability, and 
              community empowerment.
            </p>
            <p className="mb-4 font-semibold text-ui-fg-base">
              We generated consolidated revenues of over US $30 billion in the fiscal year ended March 31, 2025.
            </p>
          </div>
        </section>

        {/* Key Statistics */}
        <section className="mb-12">
          <Heading level="h2" className="text-2xl small:text-3xl font-bold mb-8 text-center text-ui-fg-base">
            Numbers You Should Know
          </Heading>
          <div className="grid grid-cols-1 small:grid-cols-2 gap-6">
            <div className="border border-ui-border-base rounded-lg p-6 text-center hover:shadow-lg transition-shadow">
              <div className="flex justify-center mb-4">
                <Users className="w-12 h-12 text-ui-fg-interactive" />
              </div>
              <div className="text-4xl font-bold mb-2 text-ui-fg-base">593K+</div>
              <Heading level="h3" className="text-lg font-semibold mb-2 text-ui-fg-base">
                Our Employees
              </Heading>
              <Text className="text-ui-fg-subtle">
                Workforce globally distributed and highly localized
              </Text>
            </div>

            <div className="border border-ui-border-base rounded-lg p-6 text-center hover:shadow-lg transition-shadow">
              <div className="flex justify-center mb-4">
                <MapPin className="w-12 h-12 text-ui-fg-interactive" />
              </div>
              <div className="text-4xl font-bold mb-2 text-ui-fg-base">149</div>
              <Heading level="h3" className="text-lg font-semibold mb-2 text-ui-fg-base">
                Nationalities
              </Heading>
              <Text className="text-ui-fg-subtle">
                Nationalities represented from across the globe
              </Text>
            </div>

            <div className="border border-ui-border-base rounded-lg p-6 text-center hover:shadow-lg transition-shadow">
              <div className="flex justify-center mb-4">
                <CheckCircleSolid className="w-12 h-12 text-ui-fg-interactive" />
              </div>
              <div className="text-4xl font-bold mb-2 text-ui-fg-base">35.2%</div>
              <Heading level="h3" className="text-lg font-semibold mb-2 text-ui-fg-base">
                Diversity
              </Heading>
              <Text className="text-ui-fg-subtle">
                Women workforce out of the total employee strength
              </Text>
            </div>

            <div className="border border-ui-border-base rounded-lg p-6 text-center hover:shadow-lg transition-shadow">
              <div className="flex justify-center mb-4">
                <Buildings className="w-12 h-12 text-ui-fg-interactive" />
              </div>
              <div className="text-4xl font-bold mb-2 text-ui-fg-base">2.6Mn</div>
              <Heading level="h3" className="text-lg font-semibold mb-2 text-ui-fg-base">
                Development
              </Heading>
              <Text className="text-ui-fg-subtle">
                High demand competencies acquired with 33.4Mn hours of learning
              </Text>
            </div>
          </div>
        </section>

        {/* Our People */}
        <section className="mb-12">
          <Heading level="h2" className="text-2xl small:text-3xl font-bold mb-6 text-ui-fg-base">
            Our People
          </Heading>
          <div className="bg-ui-bg-subtle rounded-lg p-8">
            <p className="text-xl font-semibold mb-4 text-ui-fg-base">
              How do you create a remarkable change?
            </p>
            <p className="text-lg text-ui-fg-subtle mb-4">
              At TCS UnifiedCommerce Store, we believe exceptional work begins with hiring, celebrating and nurturing the 
              best people — from all walks of life.
            </p>
            <LocalizedClientLink href="/contact">
              <span className="text-ui-fg-interactive hover:text-ui-fg-interactive-hover font-medium">
                Join us →
              </span>
            </LocalizedClientLink>
          </div>
        </section>

        {/* Get to Know Us Better */}
        <section className="mb-12">
          <Heading level="h2" className="text-2xl small:text-3xl font-bold mb-6 text-ui-fg-base">
            Get to Know Us Better
          </Heading>
          <div className="grid grid-cols-1 small:grid-cols-2 gap-6">
            <div className="border border-ui-border-base rounded-lg p-6 hover:bg-ui-bg-subtle-hover transition-colors">
              <Heading level="h3" className="text-xl font-semibold mb-2 text-ui-fg-base">
                Newsroom
              </Heading>
              <Text className="text-ui-fg-subtle mb-4">
                Stay connected and up to date with our events and announcements
              </Text>
              <LocalizedClientLink href="/contact">
                <span className="text-ui-fg-interactive hover:text-ui-fg-interactive-hover font-medium">
                  Read more →
                </span>
              </LocalizedClientLink>
            </div>

            <div className="border border-ui-border-base rounded-lg p-6 hover:bg-ui-bg-subtle-hover transition-colors">
              <Heading level="h3" className="text-xl font-semibold mb-2 text-ui-fg-base">
                CSR
              </Heading>
              <Text className="text-ui-fg-subtle mb-4">
                Our efforts are directed toward education, skilling, employment and entrepreneurship
              </Text>
              <LocalizedClientLink href="/contact">
                <span className="text-ui-fg-interactive hover:text-ui-fg-interactive-hover font-medium">
                  Read more →
                </span>
              </LocalizedClientLink>
            </div>

            <div className="border border-ui-border-base rounded-lg p-6 hover:bg-ui-bg-subtle-hover transition-colors">
              <Heading level="h3" className="text-xl font-semibold mb-2 text-ui-fg-base">
                Diversity, Equality, Inclusion
              </Heading>
              <Text className="text-ui-fg-subtle mb-4">
                A world where we can be, belong, become
              </Text>
              <LocalizedClientLink href="/contact">
                <span className="text-ui-fg-interactive hover:text-ui-fg-interactive-hover font-medium">
                  Read more →
                </span>
              </LocalizedClientLink>
            </div>

            <div className="border border-ui-border-base rounded-lg p-6 hover:bg-ui-bg-subtle-hover transition-colors">
              <Heading level="h3" className="text-xl font-semibold mb-2 text-ui-fg-base">
                Sports Sponsorships
              </Heading>
              <Text className="text-ui-fg-subtle mb-4">
                Official partners of passion and purpose
              </Text>
              <LocalizedClientLink href="/contact">
                <span className="text-ui-fg-interactive hover:text-ui-fg-interactive-hover font-medium">
                  Read more →
                </span>
              </LocalizedClientLink>
            </div>

            <div className="border border-ui-border-base rounded-lg p-6 hover:bg-ui-bg-subtle-hover transition-colors">
              <Heading level="h3" className="text-xl font-semibold mb-2 text-ui-fg-base">
                Corporate Sustainability
              </Heading>
              <Text className="text-ui-fg-subtle mb-4">
                A regenerative approach to business
              </Text>
              <LocalizedClientLink href="/contact">
                <span className="text-ui-fg-interactive hover:text-ui-fg-interactive-hover font-medium">
                  Read more →
                </span>
              </LocalizedClientLink>
            </div>

            <div className="border border-ui-border-base rounded-lg p-6 hover:bg-ui-bg-subtle-hover transition-colors">
              <Heading level="h3" className="text-xl font-semibold mb-2 text-ui-fg-base">
                The TCS Way
              </Heading>
              <Text className="text-ui-fg-subtle mb-4">
                We master it ourselves, so we can do it for you
              </Text>
              <LocalizedClientLink href="/contact">
                <span className="text-ui-fg-interactive hover:text-ui-fg-interactive-hover font-medium">
                  Read more →
                </span>
              </LocalizedClientLink>
            </div>
          </div>
        </section>

        {/* Timeline */}
        <section className="mb-12">
          <Heading level="h2" className="text-2xl small:text-3xl font-bold mb-8 text-center text-ui-fg-base">
            Our History
          </Heading>
          <div className="space-y-6">
            <div className="border-l-4 border-ui-fg-interactive pl-6 pb-6">
              <div className="text-2xl font-bold mb-2 text-ui-fg-base">1968</div>
              <Text className="text-ui-fg-subtle">
                Mr. Fakir Chand Kohli, fondly known as the Father of Indian IT, brings together a young team of enthusiastic 
                US returned IT professionals to create demand for downstream computer services.
              </Text>
            </div>

            <div className="border-l-4 border-ui-fg-interactive pl-6 pb-6">
              <div className="text-2xl font-bold mb-2 text-ui-fg-base">1971</div>
              <Text className="text-ui-fg-subtle">
                TCS wins its first external contract - power companies were being set up in Iran as part of an infrastructure 
                building program and TCS wins projects to build inventory and stock control systems for these stations.
              </Text>
            </div>

            <div className="border-l-4 border-ui-fg-interactive pl-6 pb-6">
              <div className="text-2xl font-bold mb-2 text-ui-fg-base">1973</div>
              <Text className="text-ui-fg-subtle">
                When TCS wins a project to convert a hospital accounting project written in Burroughs Medium systems COBOL 
                to Burroughs Small systems COBOL, we do not have a Burroughs computer! An in-house tool was built to write 
                this code and then shipped to the US - the first offshore delivery project.
              </Text>
            </div>

            <div className="border-l-4 border-ui-fg-interactive pl-6 pb-6">
              <div className="text-2xl font-bold mb-2 text-ui-fg-base">1979</div>
              <Text className="text-ui-fg-subtle">
                TCS establishes its first sales office in New York, headed by S Ramadorai. One of our first major clients 
                was the Institutional Group Information Corporation (IGIC).
              </Text>
            </div>

            <div className="border-l-4 border-ui-fg-interactive pl-6 pb-6">
              <div className="text-2xl font-bold mb-2 text-ui-fg-base">1981</div>
              <Text className="text-ui-fg-subtle">
                JRD Tata's vision comes to fruition when TCS sets up India's first software research center, the Tata 
                Research Development and Design Centre (TRDDC) in Pune.
              </Text>
            </div>

            <div className="border-l-4 border-ui-fg-interactive pl-6 pb-6">
              <div className="text-2xl font-bold mb-2 text-ui-fg-base">2002</div>
              <Text className="text-ui-fg-subtle">
                TCS debuts at the National Stock Exchange (NSE) and Bombay Stock Exchange, with the largest IPO by a private 
                sector company at an astounding US$ 1 billion dollars.
              </Text>
            </div>

            <div className="border-l-4 border-ui-fg-interactive pl-6 pb-6">
              <div className="text-2xl font-bold mb-2 text-ui-fg-base">2011</div>
              <Text className="text-ui-fg-subtle">
                Crosses $10 billion in annual revenue
              </Text>
            </div>

            <div className="border-l-4 border-ui-fg-interactive pl-6 pb-6">
              <div className="text-2xl font-bold mb-2 text-ui-fg-base">2012</div>
              <Text className="text-ui-fg-subtle">
                Becomes the title sponsor of the New York Marathon, the world's largest marathon
              </Text>
            </div>

            <div className="border-l-4 border-ui-fg-interactive pl-6 pb-6">
              <div className="text-2xl font-bold mb-2 text-ui-fg-base">2020</div>
              <Text className="text-ui-fg-subtle">
                TCS is the largest agile workforce in the world with over 545,000+ agile ready associates.
              </Text>
            </div>

            <div className="border-l-4 border-ui-fg-interactive pl-6 pb-6">
              <div className="text-2xl font-bold mb-2 text-ui-fg-base">2022</div>
              <Text className="text-ui-fg-subtle">
                TCS clock US$ 25.7 billion in revenue and an all-time high incremental revenue addition of US$ 3.5 billion.
              </Text>
            </div>

            <div className="border-l-4 border-ui-fg-interactive pl-6 pb-6">
              <div className="text-2xl font-bold mb-2 text-ui-fg-base">2023</div>
              <Text className="text-ui-fg-subtle">
                TCS sees leadership change as K Krithivasan takes over as CEO and Managing Director
              </Text>
            </div>

            <div className="border-l-4 border-ui-fg-interactive pl-6 pb-6">
              <div className="text-2xl font-bold mb-2 text-ui-fg-base">2024</div>
              <Text className="text-ui-fg-subtle">
                To help enterprises adapt to the rapidly evolving opportunity in Generative AI, Launches WisdomNext™, an 
                industry-first GenAI Aggregation Platform
              </Text>
            </div>

            <div className="border-l-4 border-ui-fg-interactive pl-6">
              <div className="text-2xl font-bold mb-2 text-ui-fg-base">2025</div>
              <Text className="text-ui-fg-subtle">
                TCS tops Asia's IT Services & India's Tech Brand rankings; launches HyperVault to lead AI-driven tech globally
              </Text>
            </div>
          </div>
        </section>

        {/* Investors Section */}
        <section className="mb-12">
          <div className="bg-ui-bg-subtle rounded-lg p-8">
            <Heading level="h2" className="text-2xl font-bold mb-4 text-ui-fg-base">
              Investors
            </Heading>
            <Text className="text-lg text-ui-fg-subtle mb-4">
              Positioned for long-term sustainable growth
            </Text>
            <Text className="text-ui-fg-subtle mb-4">
              TCS UnifiedCommerce Store is seen as a benchmark in its outreach to investors, in its transparency and disclosures, 
              publicly communicating its strategy, risks and opportunities, reducing information asymmetries and enabling fair 
              valuation of the stock.
            </Text>
            <LocalizedClientLink href="/contact">
              <span className="text-ui-fg-interactive hover:text-ui-fg-interactive-hover font-medium">
                Read more about Positioned for long-term sustainable growth →
              </span>
            </LocalizedClientLink>
          </div>
        </section>

        {/* Call to Action */}
        <section className="text-center pt-8 border-t border-ui-border-base">
          <Heading level="h2" className="text-2xl font-bold mb-4 text-ui-fg-base">
            Together Beyond Borders
          </Heading>
          <Text className="text-lg text-ui-fg-subtle mb-6">
            Empowering global connections.
          </Text>
          <LocalizedClientLink href="/contact">
            <span className="inline-block px-6 py-3 bg-ui-fg-interactive text-ui-fg-inverse rounded-md hover:bg-ui-fg-interactive-hover transition-colors font-medium">
              Connect with us
            </span>
          </LocalizedClientLink>
        </section>
      </div>
    </div>
  )
}
