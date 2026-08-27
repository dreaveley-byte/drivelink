import Link from 'next/link'
import Logo from '@/components/Logo'

export const metadata = {
  title: 'Privacy Policy — Drivflo',
}

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200 px-6 py-4">
        <Link href="/"><Logo height={22} /></Link>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-12 text-sm text-gray-700 leading-relaxed space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 mb-1">Privacy Policy</h1>
          <p className="text-sm text-gray-400">Effective date: August 19, 2026</p>
        </div>

        <p>
          Drivflo Inc. (&quot;Drivflo&quot;, &quot;we&quot;, &quot;us&quot;, &quot;our&quot;) is committed to
          handling personal information responsibly and in accordance with applicable privacy law, including
          British Columbia&apos;s <em>Personal Information Protection Act</em> (&quot;PIPA&quot;) where applicable.
          This policy covers the Drivflo mobile app and web platform (drivflo.ca), used by:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Drivers</strong> — independent contractors who deliver vehicles, parts, and passengers on behalf of dealers</li>
          <li><strong>Dealers</strong> — automotive dealerships and their staff who post and manage jobs</li>
          <li><strong>Customers</strong> — people receiving a vehicle delivery, pickup, or ride, who interact with parts of the platform (tracking links, delivery sign-off) without necessarily creating an account</li>
        </ul>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">1. Privacy Officer</h2>
          <p>
            Drivflo designates a Privacy Officer responsible for privacy compliance. Our Privacy Officer can be
            reached at <a href="mailto:privacy@drivflo.ca" className="text-[#378ADD] underline">privacy@drivflo.ca</a>.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">2. Information we may collect</h2>

          <h3 className="text-sm font-semibold text-gray-900 mt-4 mb-1">Drivers</h3>
          <ul className="list-disc pl-5 space-y-1">
            <li>Contact and identity information</li>
            <li>Driver&apos;s licence class (self-reported and read automatically from the photo) and driving abstracts — we do not separately collect or store the licence number as text, though it may be visible within the uploaded photo itself</li>
            <li>Criminal/background screening and vulnerable-sector clearance where legally permitted/required for approved work</li>
            <li>Limited fitness-to-drive/fitness-for-duty information (e.g. medical fitness and drug/alcohol test results)</li>
            <li>Insurance and vehicle information (year, make, model, mileage, photo) if using their own vehicle</li>
            <li>WorkSafeBC/occupational-coverage information where applicable</li>
            <li>Tax/payment information, including void cheque / banking information for direct deposit of pay</li>
            <li>Electronic signatures (e.g. on the contractor agreement)</li>
            <li>GPS/location/timestamps while administering or performing an Assignment (a job posted through the platform)</li>
            <li>Inspection photos, VIN, odometer, vehicle and delivery records</li>
            <li>Complaints, incidents, safety and investigation records</li>
            <li>Which types of Assignments they&apos;re available for, and towing capability</li>
          </ul>
          <p className="mt-2">Drivflo will not require a complete private medical history merely because someone is a Driver.</p>

          <h3 className="text-sm font-semibold text-gray-900 mt-4 mb-1">Dealers/Business Users</h3>
          <ul className="list-disc pl-5 space-y-1">
            <li>Names, titles, contact and account information</li>
            <li>Billing/payment information — Drivflo does not process or store card numbers directly; payment toward an account is arranged outside the app (e.g. by e-transfer) and only tracked as paid/unpaid within the platform</li>
            <li>Vehicle/VIN/Assignment/customer data</li>
            <li>Communications, claims and support records</li>
            <li>Signatures and authorization records</li>
          </ul>

          <h3 className="text-sm font-semibold text-gray-900 mt-4 mb-1">Customers/Recipients</h3>
          <ul className="list-disc pl-5 space-y-1">
            <li>Name/contact/delivery address</li>
            <li>Pickup/delivery instructions</li>
            <li>Vehicle/VIN/odometer</li>
            <li>Delivery time/location</li>
            <li>Condition/proof-of-delivery photos</li>
            <li>Signatures</li>
            <li>Complaints/claims</li>
            <li>Optional promotional photos/video only under separate, explicit consent collected at the time — declining has no effect on the delivery</li>
          </ul>

          <h3 className="text-sm font-semibold text-gray-900 mt-4 mb-1">Website/App</h3>
          <ul className="list-disc pl-5 space-y-1">
            <li>IP/device/browser</li>
            <li>Login/security</li>
            <li>Diagnostic/activity</li>
            <li>Cookie/similar technology information</li>
          </ul>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">3. Sources</h2>
          <p>
            Information may come from the person directly, Dealers, Drivers, customers, background providers,
            insurers, WorkSafeBC/authorized sources, payment providers, service providers, public authorities or
            other lawful sources.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">4. Purposes</h2>
          <p>Drivflo may use personal information to:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Create/administer accounts</li>
            <li>Assess Driver eligibility, including keeping that eligibility current on an ongoing basis</li>
            <li>Offer and perform Assignments</li>
            <li>Identify vehicles/recipients</li>
            <li>Track active Assignments</li>
            <li>Document pickup/delivery</li>
            <li>Calculate compensation/fees/expenses</li>
            <li>Process payments</li>
            <li>Communicate/support (e.g. SMS and in-app notifications about job status, arrival alerts, chat messages)</li>
            <li>Investigate accidents, damage, theft, fraud or safety incidents</li>
            <li>Administer insurance</li>
            <li>Meet tax/accounting/transportation/employment/workplace/legal obligations</li>
            <li>Secure the platform</li>
            <li>Maintain records and enforce agreements</li>
            <li>Improve Services</li>
            <li>Conduct marketing where legally permitted and appropriately consented</li>
          </ul>
          <p className="mt-2">We do not sell personal information to advertisers or other third parties.</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">5. GPS/Location</h2>
          <p>
            Drivflo may collect location data reasonably necessary to confirm arrival/pickup/delivery, track active
            Assignment progress (shown live to the dealer and customer while a driver is working their job), calculate
            distance/wait time, protect people/vehicles/property, investigate incidents, provide support and prevent
            fraud. Drivflo does not intend to monitor a Driver&apos;s unrelated private activities when not
            performing/administering a Drivflo Assignment, except for a separately disclosed lawful security purpose.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">6. Photos/Video</h2>
          <p>
            Operational photos may document vehicle condition, VIN, odometer, keys, damage, walkarounds, and proof of
            delivery. Operational photos are not automatically authorized for marketing. Promotional use involving an
            identifiable customer/recipient is subject to separate, voluntary consent collected at the time of delivery.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">7. Sensitive Driver Screening</h2>
          <p>
            Criminal-record, vulnerable-sector, fitness-to-drive and similar sensitive information is restricted to
            authorized persons/service providers and used only for legitimate qualification, safety, legal or related
            purposes. This information is not shared with dealers or customers — it is visible only to authorized
            Drivflo personnel.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">8. Consent</h2>
          <p>
            Drivflo obtains consent where required by law. Consent may be express, implied or otherwise permitted
            depending on the circumstances, sensitivity and purpose. Consent may be withdrawn on reasonable notice,
            subject to legal/contractual restrictions and permitted retention/use.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">9. Disclosure</h2>
          <p>Drivflo may disclose personal information as reasonably necessary to:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>The Dealer requesting the Assignment</li>
            <li>The Driver performing it</li>
            <li>The authorized customer/recipient</li>
            <li>Insurer/adjuster/broker</li>
            <li>Payment/financial providers</li>
            <li>Background-screening providers</li>
            <li>Cloud/software/communications/mapping/security providers — currently including Supabase (database and file storage), our SMS carrier, Google Maps (mapping and address lookup), Duffel (flight search for driver return travel), and Anthropic (automated photo and receipt review)</li>
            <li>Tow/repair/transport providers</li>
            <li>Lawyers/accountants</li>
            <li>Police, courts, regulators or authorities where lawful</li>
            <li>A legitimate purchaser/investor/successor in a corporate transaction, subject to appropriate safeguards</li>
          </ul>
          <p className="mt-2">Drivflo does not sell personal information to advertisers.</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">10. Service Providers / Outside Canada</h2>
          <p>
            Service providers may store/process information outside B.C. or Canada. Information may therefore be
            subject to lawful access under the laws of another jurisdiction. Drivflo remains responsible for
            information under its control and uses reasonable contractual, technical and organizational safeguards.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">11. Security</h2>
          <p>
            Reasonable safeguards may include role-based access, authentication, access controls/logging, secure
            transmission/encryption where appropriate, vendor controls, confidentiality obligations, restricted access
            to sensitive records and incident-response procedures. No system can be guaranteed completely secure.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">12. Privacy Incidents</h2>
          <p>
            Drivflo will investigate suspected loss, unauthorized access/use/disclosure and will notify affected
            individuals or authorities where required by law or reasonably appropriate.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">13. Retention/Destruction</h2>
          <p>
            Drivflo retains information only as long as reasonably necessary for the original purpose or legitimate
            legal/business needs, including claims, insurance, tax/accounting, safety, regulatory or limitation-period
            requirements. For example, we generally retain profile information for up to 1 year after someone stops
            being an active driver, dealer, or account holder, and financial records related to payments for at least
            6 years as required under Canadian tax law. When no longer reasonably required, Drivflo will destroy,
            securely dispose of, or de-identify it.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">14. Access and Correction</h2>
          <p>
            Subject to law, individuals may request access to their personal information and correction of inaccurate
            information, including deletion of their account. Drivflo may verify identity before responding. Requests
            go to the Privacy Officer at{' '}
            <a href="mailto:privacy@drivflo.ca" className="text-[#378ADD] underline">privacy@drivflo.ca</a>.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">15. Complaints</h2>
          <p>
            Privacy complaints may be directed to the Privacy Officer. Nothing limits an individual&apos;s right to
            contact the Office of the Information and Privacy Commissioner for British Columbia or another lawful
            authority.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">16. Children</h2>
          <p>
            Driver/dealer platforms are not intended for children, and we do not knowingly collect information from
            anyone under 18. Information concerning a minor will be handled only where legitimately required for an
            authorized Service and in accordance with law.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">17. Changes</h2>
          <p>Drivflo may update this Policy on reasonable notice. The effective date above identifies the current version.</p>
        </div>
      </main>
    </div>
  )
}
