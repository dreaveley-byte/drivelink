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
          <p className="text-sm text-gray-400">Last updated: {new Date().toLocaleDateString('en-CA', { dateStyle: 'long' })}</p>
        </div>

        <p>
          This policy covers the Drivflo mobile app and web platform (drivflo.ca), operated by Drivflo Inc.
          (British Columbia, Canada), used by:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Drivers</strong> — independent contractors who deliver vehicles, parts, and passengers on behalf of dealers</li>
          <li><strong>Dealers</strong> — automotive dealerships and their staff who post and manage jobs</li>
          <li><strong>Customers</strong> — people receiving a vehicle delivery, pickup, or ride, who interact with parts of the platform (tracking links, delivery sign-off) without necessarily creating an account</li>
        </ul>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Information we collect</h2>

          <h3 className="text-sm font-semibold text-gray-900 mt-4 mb-1">From drivers (at application and ongoing)</h3>
          <ul className="list-disc pl-5 space-y-1">
            <li>Name, email, phone number, home address</li>
            <li>Profile photo</li>
            <li>Driver&apos;s license class (self-reported and read automatically from the photo) — we do not separately collect or store the license number as text, though it may be visible within the uploaded photo itself</li>
            <li>Vehicle information (year, make, model, mileage, photo) if using their own vehicle</li>
            <li>Void cheque / banking information, for direct deposit of pay</li>
            <li>Criminal background check and vulnerable sector check results</li>
            <li>Drug and alcohol test results</li>
            <li>Medical fitness test results</li>
            <li>Driver&apos;s abstract (driving record)</li>
            <li>Signed contractor agreement and related policies</li>
            <li>Which types of jobs they&apos;re available for, and towing capability</li>
          </ul>

          <h3 className="text-sm font-semibold text-gray-900 mt-4 mb-1">During a job</h3>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Real-time GPS location</strong> — while a driver is actively working a job, for live tracking shown to the dealer and customer, proximity alerts, and idle-time detection</li>
            <li>Photographs of the vehicle (condition report at pickup and delivery, walkaround video, odometer)</li>
            <li>Photographs of receipts submitted for expense reimbursement</li>
            <li>In-app messages between driver, dealer, and customer</li>
          </ul>

          <h3 className="text-sm font-semibold text-gray-900 mt-4 mb-1">Identity verification</h3>
          <p>
            For certain vehicle deliveries, a photo of the recipient&apos;s face and a photo of their ID may be collected to
            verify they&apos;re the correct person receiving the vehicle. These photos are reviewed automatically and are
            not published or shared outside this verification purpose.
          </p>

          <h3 className="text-sm font-semibold text-gray-900 mt-4 mb-1">From dealers</h3>
          <ul className="list-disc pl-5 space-y-1">
            <li>Business name, address, phone number</li>
            <li>Staff names, emails, phone numbers</li>
            <li>Signed dealer agreement</li>
            <li>Records of invoices and payments toward their account (Drivflo does not process or store card numbers directly — payment is arranged outside the app, e.g. by e-transfer, and only tracked as paid/unpaid within the platform)</li>
          </ul>

          <h3 className="text-sm font-semibold text-gray-900 mt-4 mb-1">From customers (people receiving a delivery/ride)</h3>
          <ul className="list-disc pl-5 space-y-1">
            <li>Name, phone number, delivery address</li>
            <li>Signature on the delivery acknowledgment</li>
            <li>With separate, explicit consent: photos/video taken during delivery, which may be used for marketing (this consent is optional and collected at the time, not assumed)</li>
          </ul>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">How we use this information</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>To operate the core service: matching drivers to jobs, tracking deliveries, processing driver pay and dealer billing</li>
            <li>To verify driver eligibility (background check, drug/alcohol test, license class) before approving them to work, and to keep that eligibility current on an ongoing basis</li>
            <li>To communicate: SMS and in-app notifications about job status, arrival alerts, chat messages</li>
            <li>To improve safety and accountability: vehicle condition photos, delivery signatures, identity verification</li>
          </ul>
          <p className="mt-2">We do not sell personal information to third parties.</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Who we share it with</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Dealers</strong> see the driver&apos;s name, photo, phone number, and live location while that driver is working their job.</li>
            <li><strong>Customers</strong> see the driver&apos;s name, photo, rating, and live location during their delivery/ride.</li>
            <li>
              <strong>Service providers</strong> we rely on to run the platform: Supabase (database and file storage),
              a telecom carrier (SMS delivery), Google Maps (mapping and address lookup), Duffel (flight search for
              driver return travel), and Anthropic (automated photo and receipt review). Each only receives the data
              needed for their specific function.
            </li>
            <li>We do not share driver background check, drug/alcohol test, or medical fitness results with dealers or customers — these are visible only to Drivflo admin.</li>
            <li>We may disclose information if required by law.</li>
          </ul>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Data retention</h2>
          <p>
            We generally keep personal information for as long as someone is an active driver, dealer, or has an
            account, and for up to <strong>1 year</strong> after that relationship ends. Financial records related to
            payments may be retained longer where required by law (Canadian tax law requires business records to be
            kept for at least 6 years). We aim not to keep sensitive documents (background checks, drug tests, medical
            records) any longer than necessary for these purposes.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Your choices</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Drivers and dealers can update their profile information within the app.</li>
            <li>You can request that we delete your account and associated personal information by contacting us below — we&apos;ll process this within a reasonable time, subject to the retention needs described above (e.g. financial records we&apos;re legally required to keep).</li>
            <li>Customers can decline the optional photo/video marketing consent with no effect on their delivery.</li>
          </ul>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Children&apos;s privacy</h2>
          <p>Drivflo is not directed at children, and we do not knowingly collect information from anyone under 18.</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Changes to this policy</h2>
          <p>We&apos;ll update this page when our practices change, and update the &quot;last updated&quot; date above.</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Contact us</h2>
          <p>
            For privacy questions or to request deletion of your account and data, email{' '}
            <a href="mailto:privacy@drivflo.ca" className="text-[#378ADD] underline">privacy@drivflo.ca</a>.
          </p>
        </div>
      </main>
    </div>
  )
}
