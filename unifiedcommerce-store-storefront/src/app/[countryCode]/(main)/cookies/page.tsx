import { Metadata } from "next"
import { getLocale } from "@lib/data/locale-actions"
import { getTranslation, resolveTranslationLocale } from "@lib/i18n/translations"

export const metadata: Metadata = {
  title: "Cookie Policy | TCS UnifiedCommerce Store",
  description: "Cookie Policy for TCS UnifiedCommerce Store",
}

export default async function CookiePolicyPage() {
  const localeCookie = await getLocale()
  const t = (key: string) =>
    getTranslation(resolveTranslationLocale(localeCookie), key)

  return (
    <div className="content-container py-6 small:py-12">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl small:text-3xl font-bold mb-6 small:mb-8">
          Cookie Policy
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
              TCS UnifiedCommerce Store uses cookies (small text files placed on your device) and similar technologies to provide 
              our websites and to help collect data. The text in a cookie often consists of a string of numbers and letters that 
              uniquely identifies your computer, but it can contain other information as well.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl small:text-2xl font-semibold mb-4 text-ui-fg-base">
              Our Use of Cookies and Similar Technologies
            </h2>
            <p className="mb-4">
              We use cookies and similar technologies for several purposes, which may include:
            </p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>
                <strong>Storing your Preferences and Settings.</strong> Settings that enable our website to operate correctly or 
                that maintain your preferences over time may be stored on your device.
              </li>
              <li>
                <strong>Sign-in and Authentication.</strong> When you sign into our website using your credentials, we store a unique 
                ID number, and the time you signed in, in an encrypted cookie on your device. This cookie allows you to move from 
                page to page within the site without having to sign in again on each page. You can also save your sign-in information 
                so you do not have to sign in each time you return to the site.
              </li>
              <li>
                <strong>Security.</strong> We use cookies to detect fraud and abuse of our websites and services.
              </li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl small:text-2xl font-semibold mb-4 text-ui-fg-base">
              Does TCS UnifiedCommerce Store use cookies for analytics?
            </h2>
            <p className="mb-4">
              When we send you a targeted email, subject to your preferences, which includes web beacons, cookies or similar 
              technologies we will know whether you open, read, or delete the message.
            </p>
            <p className="mb-4">
              When you allow the Performance Cookies to be dropped on your browser, we can associate cookie information with an 
              identifiable individual. For example:
            </p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>
                When you click a link in a marketing e-mail you receive from us or fill up a form on our website, we will also 
                use a cookie to log what pages you view and what content you download from our websites.
              </li>
              <li>
                <strong>Combining and analyzing personal data</strong> – We may combine data collected from performance cookies 
                dropped on your browser. We use this information to improve and personalize your experience with our websites, 
                provide you with content that you may be interested in, create marketing insights, and to improve our business 
                and services.
              </li>
            </ul>
            <p className="mb-4">
              In addition to the cookies we set when you visit our websites, third parties may also set cookies when you visit our 
              sites. In some cases, that is because we have hired the third party to provide services on our behalf. We use cookies 
              from Google reCAPTCHA to prevent abuse of the website and enhance its security. Our website also uses the LinkedIn 
              Insight Tag & Conversion Pixel for website tracking and analytics. It gives us additional insights to retarget website 
              visitors with contextual messaging. It collects data regarding members' visits to our website, including the URL, 
              referrer, IP address, device and browser characteristics (User Agent), and timestamp. This enables us to understand 
              more about members interaction with our ads and how they engage with our website to take desirable actions like signing 
              up for a newsletter or making a purchase. This feature will be enabled only if you allow the Targeting Cookies from 
              LinkedIn to be dropped on your browser.
            </p>
            <p className="mb-4">
              We set cookies that are technical and necessary for the function of the website, for example, that allow you to browse 
              the website and use the different options included in this for the management of the website and enable its functions 
              and services, such as controlling data traffic and communication, identifying the session, managing payment, controlling 
              any fraud linked to service security, completing event sign up or participation requests, counting visits for the purposes 
              of invoicing the licenses for the software which allow the service to operate (website, platform or application), using 
              safety elements during browsing, storing contents for video or audio broadcasting, enabling dynamic contents (for example, 
              loading animation for a text or image) or share contents in social media.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl small:text-2xl font-semibold mb-4 text-ui-fg-base">
              Cookie Details
            </h2>
            <p className="mb-4">
              Some of the cookies we commonly use are listed below. This list is not exhaustive, but it is intended to illustrate 
              the main reasons we typically set cookies. If you visit one of our websites, the site may set some or all of the following 
              cookies:
            </p>
            <p className="mb-4">
              A cookie is a small piece of data (text file) that a website – when visited by a user – asks your browser to store on 
              your device in order to remember information about you, such as your language preference or login information. Those 
              cookies are set by us and called first-party cookies. We also use third-party cookies – which are cookies from a domain 
              different than the domain of the website you are visiting – for our advertising and marketing efforts. More specifically, 
              we use cookies and other tracking technologies for the following purposes:
            </p>

            <h3 className="text-lg small:text-xl font-semibold mb-3 mt-6 text-ui-fg-base">
              Strictly Necessary Cookies
            </h3>
            <p className="mb-4">
              These cookies are essential for the website to function properly. They enable core functionality such as security, 
              network management, and accessibility. You may disable these by changing your browser settings, but this may affect 
              how the website functions.
            </p>
            <div className="overflow-x-auto mb-6">
              <table className="min-w-full text-sm border border-ui-border-base">
                <thead className="bg-ui-bg-subtle">
                  <tr>
                    <th className="border border-ui-border-base px-4 py-2 text-left font-semibold">Name</th>
                    <th className="border border-ui-border-base px-4 py-2 text-left font-semibold">Description</th>
                    <th className="border border-ui-border-base px-4 py-2 text-left font-semibold">Category</th>
                    <th className="border border-ui-border-base px-4 py-2 text-left font-semibold">Domain</th>
                    <th className="border border-ui-border-base px-4 py-2 text-left font-semibold">Expiry</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-ui-border-base px-4 py-2">OptanonConsent</td>
                    <td className="border border-ui-border-base px-4 py-2">Stores information about cookie consent preferences</td>
                    <td className="border border-ui-border-base px-4 py-2">First Party - Strictly Necessary</td>
                    <td className="border border-ui-border-base px-4 py-2">unifiedomnichannel.com</td>
                    <td className="border border-ui-border-base px-4 py-2">PERSISTENT</td>
                  </tr>
                  <tr>
                    <td className="border border-ui-border-base px-4 py-2">PHPSESSID</td>
                    <td className="border border-ui-border-base px-4 py-2">Maintains user session variables</td>
                    <td className="border border-ui-border-base px-4 py-2">First Party - Strictly Necessary</td>
                    <td className="border border-ui-border-base px-4 py-2">unifiedomnichannel.com</td>
                    <td className="border border-ui-border-base px-4 py-2">SESSION</td>
                  </tr>
                  <tr>
                    <td className="border border-ui-border-base px-4 py-2">JSESSIONID</td>
                    <td className="border border-ui-border-base px-4 py-2">Maintains anonymous user session</td>
                    <td className="border border-ui-border-base px-4 py-2">First Party - Strictly Necessary</td>
                    <td className="border border-ui-border-base px-4 py-2">unifiedomnichannel.com</td>
                    <td className="border border-ui-border-base px-4 py-2">SESSION</td>
                  </tr>
                  <tr>
                    <td className="border border-ui-border-base px-4 py-2">_grecaptcha</td>
                    <td className="border border-ui-border-base px-4 py-2">Google reCAPTCHA for spam protection</td>
                    <td className="border border-ui-border-base px-4 py-2">Third Party - Strictly Necessary</td>
                    <td className="border border-ui-border-base px-4 py-2">google.com</td>
                    <td className="border border-ui-border-base px-4 py-2">PERSISTENT</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h3 className="text-lg small:text-xl font-semibold mb-3 mt-6 text-ui-fg-base">
              Performance Cookies
            </h3>
            <p className="mb-4">
              These cookies help us understand how visitors interact with our website by collecting and reporting information 
              anonymously. This helps us improve the way our website works.
            </p>
            <div className="overflow-x-auto mb-6">
              <table className="min-w-full text-sm border border-ui-border-base">
                <thead className="bg-ui-bg-subtle">
                  <tr>
                    <th className="border border-ui-border-base px-4 py-2 text-left font-semibold">Name</th>
                    <th className="border border-ui-border-base px-4 py-2 text-left font-semibold">Description</th>
                    <th className="border border-ui-border-base px-4 py-2 text-left font-semibold">Category</th>
                    <th className="border border-ui-border-base px-4 py-2 text-left font-semibold">Domain</th>
                    <th className="border border-ui-border-base px-4 py-2 text-left font-semibold">Expiry</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-ui-border-base px-4 py-2">_mkto_trk</td>
                    <td className="border border-ui-border-base px-4 py-2">Email marketing service tracking cookie</td>
                    <td className="border border-ui-border-base px-4 py-2">First Party - Performance</td>
                    <td className="border border-ui-border-base px-4 py-2">unifiedomnichannel.com</td>
                    <td className="border border-ui-border-base px-4 py-2">PERSISTENT</td>
                  </tr>
                  <tr>
                    <td className="border border-ui-border-base px-4 py-2">s_vi</td>
                    <td className="border border-ui-border-base px-4 py-2">Analytics cookie for unique visitor identification</td>
                    <td className="border border-ui-border-base px-4 py-2">First Party - Performance</td>
                    <td className="border border-ui-border-base px-4 py-2">unifiedomnichannel.com</td>
                    <td className="border border-ui-border-base px-4 py-2">PERSISTENT</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h3 className="text-lg small:text-xl font-semibold mb-3 mt-6 text-ui-fg-base">
              Functional Cookies
            </h3>
            <p className="mb-4">
              These cookies enable the website to provide enhanced functionality and personalization. They may be set by us or by 
              third-party providers whose services we have added to our pages.
            </p>
            <div className="overflow-x-auto mb-6">
              <table className="min-w-full text-sm border border-ui-border-base">
                <thead className="bg-ui-bg-subtle">
                  <tr>
                    <th className="border border-ui-border-base px-4 py-2 text-left font-semibold">Name</th>
                    <th className="border border-ui-border-base px-4 py-2 text-left font-semibold">Description</th>
                    <th className="border border-ui-border-base px-4 py-2 text-left font-semibold">Category</th>
                    <th className="border border-ui-border-base px-4 py-2 text-left font-semibold">Domain</th>
                    <th className="border border-ui-border-base px-4 py-2 text-left font-semibold">Expiry</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-ui-border-base px-4 py-2">category_id</td>
                    <td className="border border-ui-border-base px-4 py-2">Stores user preference and interest cluster information</td>
                    <td className="border border-ui-border-base px-4 py-2">First Party - Functional</td>
                    <td className="border border-ui-border-base px-4 py-2">unifiedomnichannel.com</td>
                    <td className="border border-ui-border-base px-4 py-2">PERSISTENT</td>
                  </tr>
                  <tr>
                    <td className="border border-ui-border-base px-4 py-2">UUID</td>
                    <td className="border border-ui-border-base px-4 py-2">Identifies repeat users on the website</td>
                    <td className="border border-ui-border-base px-4 py-2">First Party - Functional</td>
                    <td className="border border-ui-border-base px-4 py-2">unifiedomnichannel.com</td>
                    <td className="border border-ui-border-base px-4 py-2">PERSISTENT</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h3 className="text-lg small:text-xl font-semibold mb-3 mt-6 text-ui-fg-base">
              Targeting Cookies
            </h3>
            <p className="mb-4">
              These cookies may be set through our site by our advertising partners. They may be used by those companies to build 
              a profile of your interests and show you relevant adverts on other sites.
            </p>
            <div className="overflow-x-auto mb-6">
              <table className="min-w-full text-sm border border-ui-border-base">
                <thead className="bg-ui-bg-subtle">
                  <tr>
                    <th className="border border-ui-border-base px-4 py-2 text-left font-semibold">Name</th>
                    <th className="border border-ui-border-base px-4 py-2 text-left font-semibold">Description</th>
                    <th className="border border-ui-border-base px-4 py-2 text-left font-semibold">Category</th>
                    <th className="border border-ui-border-base px-4 py-2 text-left font-semibold">Domain</th>
                    <th className="border border-ui-border-base px-4 py-2 text-left font-semibold">Expiry</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-ui-border-base px-4 py-2">bcookie</td>
                    <td className="border border-ui-border-base px-4 py-2">LinkedIn browser identifier cookie</td>
                    <td className="border border-ui-border-base px-4 py-2">Third Party - Targeting</td>
                    <td className="border border-ui-border-base px-4 py-2">linkedin.com</td>
                    <td className="border border-ui-border-base px-4 py-2">PERSISTENT</td>
                  </tr>
                  <tr>
                    <td className="border border-ui-border-base px-4 py-2">lidc</td>
                    <td className="border border-ui-border-base px-4 py-2">LinkedIn data center routing cookie</td>
                    <td className="border border-ui-border-base px-4 py-2">Third Party - Targeting</td>
                    <td className="border border-ui-border-base px-4 py-2">linkedin.com</td>
                    <td className="border border-ui-border-base px-4 py-2">PERSISTENT</td>
                  </tr>
                  <tr>
                    <td className="border border-ui-border-base px-4 py-2">YSC</td>
                    <td className="border border-ui-border-base px-4 py-2">YouTube session cookie for video tracking</td>
                    <td className="border border-ui-border-base px-4 py-2">Third Party - Targeting</td>
                    <td className="border border-ui-border-base px-4 py-2">youtube.com</td>
                    <td className="border border-ui-border-base px-4 py-2">SESSION</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-xl small:text-2xl font-semibold mb-4 text-ui-fg-base">
              How to Control Cookies Manually
            </h2>
            <p className="mb-4">
              You can set your browser:
            </p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>To allow all cookies</li>
              <li>To allow only 'trusted' sites to send them</li>
              <li>To accept only those cookies from websites you are currently using.</li>
            </ul>
            <p className="mb-4">
              We recommend not to block all cookies because our website uses them to work properly.
            </p>

            <h3 className="text-lg small:text-xl font-semibold mb-3 mt-6 text-ui-fg-base">
              Google Chrome
            </h3>
            <p className="mb-4">
              Click on the "Menu" tab in the upper-right corner and then click on "Settings". To block cookies: Settings → Click 
              on "Advanced" to expand → Under Privacy and Security, Click on "Content Settings" → Click on "Cookies" → To block cookies, 
              Click on toggle button next to this line "Allow sites to save and read cookie data (recommended)" → This will block 
              the cookies. To check cookies: Settings → Click on "Advanced" to expand → Under Privacy and Security → Click on "Content 
              Settings" → Click on "Cookies" → See all cookies and site data → Click on the website and check the cookies used in that 
              particular site.
            </p>

            <h3 className="text-lg small:text-xl font-semibold mb-3 mt-6 text-ui-fg-base">
              Mozilla Firefox
            </h3>
            <p className="mb-4">
              Click on the Menu tab in the upper-right corner → Click on Options → In the left side navigation, Click on Privacy and 
              Security → Under History, Select "Use Custom setting for history" from the Drop down → Click on Show Cookies Buttons → 
              Select the file which you want to remove and then click on remove selected button.
            </p>

            <h3 className="text-lg small:text-xl font-semibold mb-3 mt-6 text-ui-fg-base">
              Internet Explorer
            </h3>
            <p className="mb-4">
              Open Internet Explorer → Click on Tools menu in the upper-right corner → Click on Internet Options → This will open a 
              window with many tab → Click on Privacy tab → Under Settings, move the slider to the top to block all cookies or to the 
              bottom to allow all cookies → Then click Apply. Open Internet Explorer → Click on Tools menu in the upper-right corner → 
              Click on Internet Options → This will open a window with many tabs → Click on Privacy tab → Click on Sites button → Enter 
              site name and then click Allow or Block button → If user clicks block button, that website is not allowed to use cookies 
              in IE → Then click Apply.
            </p>

            <h3 className="text-lg small:text-xl font-semibold mb-3 mt-6 text-ui-fg-base">
              Safari
            </h3>
            <p className="mb-4">
              Open Safari → Click on Preferences from Safari menu → Go to Privacy tab → Click on "Remove all Website data" to remove 
              all the stored data → Click Remove now button from the pop-up → Click on Details button under "Remove all Website data" 
              → Select the sites you want to remove the data → Click Remove → Click Done.
            </p>
            <p className="mb-4">
              To find information relating to other browsers, visit the browser developer's website.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl small:text-2xl font-semibold mb-4 text-ui-fg-base">
              Customize Cookies
            </h2>
            <p className="mb-4">
              We may periodically update this Cookie Policy to reflect changes in our practices. If needed, in such situations we 
              will prompt you to revisit your cookie settings and submit your preferences again.
            </p>
          </section>

          <div className="mt-12 pt-8 border-t border-ui-border-base">
            <p className="text-sm text-ui-fg-muted">
              This cookie policy is based on TCS Cookie Policy and adapted for TCS UnifiedCommerce Store.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
