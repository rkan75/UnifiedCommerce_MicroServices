import { Metadata } from "next"
import { getLocale } from "@lib/data/locale-actions"
import { getTranslation } from "@lib/i18n/translations"

export const metadata: Metadata = {
  title: "Terms of Service | TCS UnifiedCommerce Store",
  description: "Terms of Service for TCS UnifiedCommerce Store",
}

export default async function TermsPage() {
  const localeCookie = await getLocale()
  const locale = localeCookie?.split("-")[0] || "en"
  const t = (key: string) => getTranslation(locale as "en" | "es", key)

  return (
    <div className="content-container py-6 small:py-12">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl small:text-3xl font-bold mb-6 small:mb-8">
          Terms of Service
        </h1>
        <div className="prose prose-sm small:prose-base max-w-none text-ui-fg-subtle">
          <p className="text-sm text-ui-fg-muted mb-6">
            Last updated: February 10, 2026
          </p>

          <section className="mb-8">
            <h2 className="text-xl small:text-2xl font-semibold mb-4 text-ui-fg-base">
              Overview
            </h2>
            <p className="mb-4">
              This Website and the information, tools and material contained in it (this "Site") are not directed to, 
              or intended for distribution to or use by, any person or entity who is a citizen or resident of or located 
              in any jurisdiction where such distribution, publication, availability or use would be contrary to law or 
              regulation or which would subject TCS UnifiedCommerce Store or its affiliates (collectively "we", "us", 
              or "our") to any registration or licensing requirement within such jurisdiction.
            </p>
            <p className="mb-4">
              This Site is subject to periodic update and revision. Materials should only be considered current as of the 
              date of initial publication appearing thereon, without regard to the date on which you may access the information. 
              We maintain the right to delete or modify information on this Site without prior notice.
            </p>
            <p className="mb-4">
              Past financial performance should not be taken as an indication or guarantee of future performance, and no 
              representation or warranty, express or implied is made regarding future performance.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl small:text-2xl font-semibold mb-4 text-ui-fg-base">
              Limited License
            </h2>
            <p className="mb-4">
              Subject to the terms and conditions set forth in this Agreement, we will grant a non-exclusive, non-transferable, 
              limited right to access this site and the materials thereon.
            </p>
            <p className="mb-4">
              You hereby agree and confirm that:
            </p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>
                Access to this site and the information contained herein is not unlawful under the applicable laws of the 
                jurisdiction where I am resident and from where I am accessing this site.
              </li>
              <li>
                Access to information on the site does not in any manner constitute an offer to sell or a solicitation of any 
                offer to buy any of the securities of TCS UnifiedCommerce Store or its parent company.
              </li>
              <li>
                The information on this site is not and is under no circumstances be construed as, an advertisement or a public 
                offering of the securities of TCS UnifiedCommerce Store or any other security that may be described herein.
              </li>
              <li>
                No securities regulatory body or similar authority in any jurisdiction has reviewed or in any way passed upon or 
                endorsed the information on this site or the merits of the securities that may be described herein and any 
                representation to the contrary may be construed as an offence under applicable laws.
              </li>
              <li>
                I shall not circulate copies of this information in any manner (including but not restricted to photocopying and 
                email) of the information and data on this site. I agree not to reproduce, retransmit, distribute, disseminate, 
                sell, publish, broadcast or circulate the contents to anyone.
              </li>
            </ul>
            <p className="mb-4">
              You agree not to:
            </p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>Interrupt or attempt to interrupt the operation of the site in any way.</li>
              <li>Intrude or attempt to intrude into the site in any way.</li>
              <li>Post any obscene, defamatory or annoying materials on the site.</li>
              <li>Obscure any materials, including this notice, already posted on the site.</li>
              <li>
                Use the site or any contents thereof to defame, intimidate, annoy or otherwise cause nuisance or breach the 
                rights of any person.
              </li>
            </ul>
            <p className="mb-4">
              We authorize you to view and download the information ("Materials") at this Web site ("Site") only for personal, 
              non-commercial use.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl small:text-2xl font-semibold mb-4 text-ui-fg-base">
              Restrictions
            </h2>
            <p className="mb-4">
              This authorization is not a transfer of title in the Materials and copies of the Materials and is subject to 
              the following restrictions:
            </p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>
                Retain, on all copies of the Materials downloaded, all copyright, trademarks and other proprietary notices 
                contained in the Materials.
              </li>
              <li>
                Not modify the Materials in any way nor reproduce or display, perform, or distribute or otherwise use them 
                for any public or commercial purpose.
              </li>
              <li>
                Not transfer the Materials to any other person unless you give them notice of, and they agree to accept, the 
                obligations arising under these terms and conditions of use.
              </li>
            </ul>
            <p className="mb-4">
              You agree to abide by all additional restrictions displayed on the Site as it may be updated from time to time. 
              This Site, including all Materials, is copyrighted and protected by worldwide copyright laws and treaty provisions. 
              You agree to comply with all copyright laws worldwide in your use of this Site and to prevent any unauthorized copying 
              of the Materials.
            </p>
            <p className="mb-4">
              Except as expressly provided herein, we do not grant any express or implied right to you under any patents, 
              trademarks, copyrights or trade secret information.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl small:text-2xl font-semibold mb-4 text-ui-fg-base">
              Disclaimer
            </h2>
            <p className="mb-4">
              The information, material or services included in or available through this site may include inaccuracies or 
              typographical errors. Changes are periodically made to the site/services and to the information therein. We and/or 
              our respective suppliers may make improvements and/or changes in the site/services at any time. Advice received via 
              this site should not be relied upon for personal, medical, legal or financial decisions and you should consult an 
              appropriate professional for specific advice tailored to your situation.
            </p>
            <p className="mb-4">
              You specifically agree that we shall not be responsible for unauthorized access to or alteration of your transmissions 
              or data, any material or data sent or received or not sent or received, or any transactions entered into through this 
              site. You specifically agree that we are not responsible or liable for any threatening, defamatory, obscene, offensive 
              or illegal content or conduct of any other party or any infringement of another's rights, including intellectual property 
              rights. You specifically agree that we are not responsible for any content sent using and/or included in this site by any 
              third party.
            </p>
            <p className="mb-4">
              In no event shall we and/or our suppliers be liable for any direct, indirect, punitive, incidental, special, consequential 
              damages or any damages whatsoever including, without limitation, damages for loss of use, data or profits, arising out 
              of or in any way connected with the use or performance of this site/services, with the delay or inability to use this 
              site/services or related services, the provision of or failure to provide services, or for any information, products, 
              services and material obtained through this site, or otherwise arising out of the use of this site/services, whether based 
              on contract, tort, negligence, strict liability or otherwise, even if we or any of our suppliers has been advised of the 
              possibility of damages.
            </p>
            <p className="mb-4">
              If you are dissatisfied with any portion of this site/services, or with any of these terms of use, your sole and exclusive 
              remedy is to discontinue using this site/services.
            </p>
            <p className="mb-4">
              The foregoing are subject to the laws of the Republic of India and the courts in Mumbai, India shall have the exclusive 
              jurisdiction on any dispute that may arise out of the use of this site.
            </p>
            <p className="mb-4">
              Please proceed only if you accept all the conditions enumerated herein above, out of your free will and consent.
            </p>
          </section>

          <div className="mt-12 pt-8 border-t border-ui-border-base">
            <p className="text-sm text-ui-fg-muted">
              These terms of service are based on TCS Legal Disclaimer and adapted for TCS UnifiedCommerce Store.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
