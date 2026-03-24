import { Metadata } from "next"
import { Text } from "@medusajs/ui"
import { getLocale } from "@lib/data/locale-actions"
import { getTranslation } from "@lib/i18n/translations"

export const metadata: Metadata = {
  title: "Privacy Policy | TCS UnifiedCommerce Store",
  description: "Privacy Policy for TCS UnifiedCommerce Store",
}

export default async function PrivacyPage() {
  const localeCookie = await getLocale()
  const locale = localeCookie?.split("-")[0] || "en"
  const t = (key: string) => getTranslation(locale as "en" | "es", key)

  return (
    <div className="content-container py-6 small:py-12">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl small:text-3xl font-bold mb-6 small:mb-8">
          Privacy Policy
        </h1>
        <div className="prose prose-sm small:prose-base max-w-none text-ui-fg-subtle">
          <p className="text-sm text-ui-fg-muted mb-6">
            Last updated: February 10, 2026
          </p>

          <section className="mb-8">
            <h2 className="text-xl small:text-2xl font-semibold mb-4 text-ui-fg-base">
              Introduction
            </h2>
            <p className="mb-4">
              Your privacy is important to us and we believe it is important for you to know what personal data we, 
              TCS UnifiedCommerce Store ("we", "us", or "our"), collect from you (and third parties), why we collect it, 
              how we use it and what rights you might be entitled to as a data subject or consumer.
            </p>
            <p className="mb-4">
              Please note: all information in this privacy notice is applicable to you unless otherwise indicated based on 
              your residency status. In this notice, the term "personal data" is used to represent any information relating 
              to an identified or identifiable person.
            </p>
            <p className="mb-4">
              We encourage you to read this notice, together with any additional and more specific information we may provide 
              to you on various occasions when we are collecting or processing personal data on our websites, products or 
              applications, events and initiatives so that you are aware of how and the purpose for which we are processing 
              your personal data.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl small:text-2xl font-semibold mb-4 text-ui-fg-base">
              How We Will Use Your Personal Data
            </h2>
            <p className="mb-4">
              We may collect different kinds of personal data in several different ways and use it for a number of different purposes:
            </p>

            <h3 className="text-lg small:text-xl font-semibold mb-3 mt-6 text-ui-fg-base">
              To Ensure Access to Our Website and Online Services
            </h3>
            <p className="mb-4">
              In general, you can visit our website on the World Wide Web without telling us who you are. Our web servers or 
              affiliates who provide analytics and performance enhancement services may collect:
            </p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>IP addresses</li>
              <li>Operating system details</li>
              <li>Browsing details</li>
              <li>Device and connectivity details</li>
              <li>Language settings</li>
            </ul>
            <p className="mb-4">
              This information is aggregated to measure the number of visits, average time spent on the site, pages viewed and 
              similar information. We use this information to measure the site usage, improve content and to ensure safety and 
              security as well as enhance performance and user experience of the website.
            </p>
            <p className="mb-4">
              We use cookies (small text files placed on your device) and similar technologies to facilitate proper functioning 
              of our websites and to help collect data. Please note that our websites may include links to websites of third parties 
              whose privacy practices differ from those of ours; if you provide personal data to any of those websites, your data 
              is governed by their privacy statements.
            </p>

            <h3 className="text-lg small:text-xl font-semibold mb-3 mt-6 text-ui-fg-base">
              To Answer Your Queries, Support and Contact Requests
            </h3>
            <p className="mb-4">
              If you contact us with queries, requests for more information about initiatives or products or other generic support 
              inquiries, we may need to process personal data about you such as:
            </p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>Personal and contact details, like full name, company and role, email and address</li>
              <li>Demographic data</li>
              <li>Qualifications and profession</li>
              <li>The content of your messages to us</li>
            </ul>

            <h3 className="text-lg small:text-xl font-semibold mb-3 mt-6 text-ui-fg-base">
              Subscriptions to Our Promotional Communications
            </h3>
            <p className="mb-4">
              If you sign up to receive marketing communications from us, we may send these by email, post, telephone or any other 
              means of communication. You can opt-out from receiving such communications at any time using the contact us form or 
              unsubscribe links included in our emails.
            </p>

            <h3 className="text-lg small:text-xl font-semibold mb-3 mt-6 text-ui-fg-base">
              To Administer Events and Initiatives
            </h3>
            <p className="mb-4">
              We frequently organize events and initiatives, either free to join or by invitation only. To allow participants to join 
              the events, we are required to collect and process a limited amount of information, such as:
            </p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>Full name</li>
              <li>Company, job title and business email address</li>
              <li>Telephone number</li>
              <li>Location</li>
              <li>Pictures and video of you (where events are recorded)</li>
            </ul>

            <h3 className="text-lg small:text-xl font-semibold mb-3 mt-6 text-ui-fg-base">
              To Promote Our Brand, Products, Initiatives and Values with Marketing Communications
            </h3>
            <p className="mb-4">
              We have a strong legitimate interest in promoting our brand, products, initiatives and values. In order to further such 
              goals, we process personal data about our business contacts including existing and potential clients, third parties and 
              intermediaries we interact with in the course of doing business.
            </p>
            <p className="mb-4">
              We may collect details about you including name, contact details and other information such as your job title, employer, 
              areas of business interest and other business details. We collect such data directly or indirectly from you, or from third 
              parties, such as business partners, data brokers, social networks, marketing companies, and publicly available sources 
              such as social media sites where lawful to do so.
            </p>

            <h3 className="text-lg small:text-xl font-semibold mb-3 mt-6 text-ui-fg-base">
              To Manage, Administer and Fulfill the Obligations Under Contracts and Regulations
            </h3>
            <p className="mb-4">
              Where we are in a contractual relationship with you, your employer or your company, or are taking steps to enter into 
              such a contractual relationship, we may need to process your personal data, usually limited to name, business contact details 
              and job title in order to enter into and/or fulfill the obligations arising from the same contract, such as providing you 
              or your employer or company with the services you have requested.
            </p>
            <p className="mb-4">
              We will also process such personal data for ancillary tasks related to our daily business activities, such as accounting, 
              auditing, reporting (to regulators and authorities) and to comply with applicable regulations.
            </p>
            <p className="mb-4">
              If you do not provide certain information when requested, it may delay or prevent us in replying to your queries and/or 
              in letting you join our initiatives.
            </p>
            <p className="mb-4">
              We will only use your personal data for the purposes for which we collected it, unless we reasonably consider that we need 
              to use it for another reason that is compatible with the original purpose and applicable law. If we need to use your personal 
              data for an unrelated purpose, we will notify you and we will explain the legal basis which allows us to do so.
            </p>
            <p className="mb-4">
              Please note that we may process your personal data without your knowledge or consent, in compliance with the above rules, 
              where this is required or permitted by law.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl small:text-2xl font-semibold mb-4 text-ui-fg-base">
              How We Will Share Your Personal Data
            </h2>
            <p className="mb-4">
              We may share your data with third parties, including third-party service providers and other entities in our group. Please 
              note, we have not in the past, nor do we currently, under any circumstances sell your personal data to any third party. 
              Further, we do not share your personal data with third parties for any additional purpose unless required to fulfill a 
              legal obligation or a legitimate business purpose where permitted by law.
            </p>

            <h3 className="text-lg small:text-xl font-semibold mb-3 mt-6 text-ui-fg-base">
              Why Might You Share My Personal Data with Third Parties?
            </h3>
            <p className="mb-4">
              We may share your personal data with third parties where required by law, where it is necessary for one of the activities 
              mentioned above or where we have another legitimate legal basis in doing so. We require third parties to respect the security 
              of your data and to treat it in accordance with the law. Where required by the law, we will request your consent before 
              transferring data to third parties which are not part of our group of companies.
            </p>

            <h3 className="text-lg small:text-xl font-semibold mb-3 mt-6 text-ui-fg-base">
              Which Third-Party Service Providers Process My Personal Data?
            </h3>
            <p className="mb-4">
              "Third parties" includes third-party service providers (including contractors and designated agents) and other entities within 
              our group. The following activities may be carried out by third-party service providers: hosting and other internet services, 
              data storage and analytics, marketing research and campaign management, event organizers and caterers.
            </p>
            <p className="mb-4">
              All our third-party service providers are required to take appropriate security measures to protect your personal data in line 
              with our policies. We do not allow our third-party service providers to use your personal data for their own purposes. We only 
              permit them to process your personal data for specified purposes and in accordance with our instructions and applicable law.
            </p>
            <p className="mb-4">
              We may also need to share your personal data with regulators or to otherwise comply with the law.
            </p>

            <h3 className="text-lg small:text-xl font-semibold mb-3 mt-6 text-ui-fg-base">
              Transferring Your Personal Data Outside of Your Country of Residence
            </h3>
            <p className="mb-4">
              We may transfer the personal data we collect about you to one or more countries outside of your country of residence or outside 
              of the country in which you access this website, including India, in order to perform one of the activities listed above. In 
              such cases, we have put in place the appropriate measures to ensure that your personal data will be secure according to the laws 
              of the country in which you reside. If you require further information about these protective measures, you can request it from 
              our Data Protection Officers (see contacts below).
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl small:text-2xl font-semibold mb-4 text-ui-fg-base">
              How We Will Keep Your Information Safe
            </h2>
            <p className="mb-4">
              We have put in place appropriate technical, organizational and security measures to prevent your personal data from being 
              accidentally lost, used or accessed in an unauthorized way, altered or disclosed. In addition, we limit access to your personal 
              data to those employees, agents, contractors and other third parties who have a business need to know. They will only process 
              your personal data on our instructions and they are subject to a duty of confidentiality.
            </p>
            <p className="mb-4">
              We have put in place procedures to deal with any suspected data security breach and will notify you and any applicable regulator 
              of a suspected breach where we are legally required to do so.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl small:text-2xl font-semibold mb-4 text-ui-fg-base">
              How Long We Will Keep Your Information
            </h2>
            <p className="mb-4">
              We will only retain your personal data for as long as necessary to fulfill the purposes we collected it for, including for the 
              purposes of satisfying any legal, accounting, or reporting requirements. To determine the appropriate retention period for 
              personal data, we consider the amount, nature and sensitivity of the personal data, the potential risk of harm from unauthorized 
              use or disclosure of your personal data, the purposes for which we process your personal data and whether we can achieve those 
              purposes through other means, and the applicable legal requirements.
            </p>
            <p className="mb-4">
              In some circumstances we may anonymize your personal data so that it can no longer be associated with you, in which case we may 
              use such information without further notice to you.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl small:text-2xl font-semibold mb-4 text-ui-fg-base">
              How to Contact Us
            </h2>
            <p className="mb-4">
              If you have a privacy concern, complaint or a question regarding this privacy statement, please direct it to our Data Protection 
              Officer or contact us through the "Contact us" form on our website indicating your concern in detail.
            </p>
            <p className="mb-4">
              For the purposes of the data processed under this statement, the controller or business/service provider for the data processing 
              of your personal data collected through our websites is TCS UnifiedCommerce Store.
            </p>
            <p className="mb-4">
              <strong>Data Protection Officer Contact:</strong>
            </p>
            <p className="mb-2">
              Email: privacy@unifiedomnichannel.com
            </p>
            <p className="mb-2">
              Address: TCS UnifiedCommerce Store<br />
              TCS House, 2nd Floor, Raveline Street<br />
              Fort Mumbai 400 001, India
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl small:text-2xl font-semibold mb-4 text-ui-fg-base">
              Right to Withdraw Consent
            </h2>
            <p className="mb-4">
              In the limited circumstances and based on your country of residence, where you may have provided your consent to the collection, 
              processing and transfer of your personal data for a specific purpose, you may have the right to withdraw your consent for that 
              specific processing at any time. To withdraw your consent, please contact our Data Protection Officer (see contacts above). Once 
              we have received notification that you have withdrawn your consent, we will no longer process your information for the purpose 
              or purposes you originally agreed to, unless we have another legal basis for doing so.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl small:text-2xl font-semibold mb-4 text-ui-fg-base">
              Changes to This Privacy Notice
            </h2>
            <p className="mb-4">
              We reserve the right to update this privacy notice at any time, and we will provide you with a new privacy notice when we make 
              any substantial updates. We may also notify you in other ways from time to time about the processing of your personal data.
            </p>
          </section>

          <div className="mt-12 pt-8 border-t border-ui-border-base">
            <p className="text-sm text-ui-fg-muted">
              This privacy policy is based on TCS Privacy Notice and adapted for TCS UnifiedCommerce Store.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
