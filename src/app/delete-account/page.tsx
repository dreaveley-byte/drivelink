import Link from 'next/link'
import Logo from '@/components/Logo'

export const metadata = {
  title: 'Delete Your Account — Drivflo',
}

export default function DeleteAccountPage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200 px-6 py-4">
        <Link href="/"><Logo height={22} /></Link>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-12 text-sm text-gray-700 leading-relaxed space-y-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Delete Your Account</h1>
          <p>
            If you'd like to delete your Drivflo account and associated personal data, you can request this at
            any time.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">How to request deletion</h2>
          <p>
            Email <a href="mailto:privacy@drivflo.ca?subject=Account%20Deletion%20Request" className="text-[#378ADD] underline font-medium">privacy@drivflo.ca</a> from
            the email address associated with your account, with the subject line "Account Deletion Request."
            Include your full name and the email or phone number your account is registered under so we can verify
            your identity before processing the request.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">What gets deleted</h2>
          <p>Once verified, we will delete or de-identify:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>Your name, contact information, and login credentials</li>
            <li>Profile photos and uploaded documents</li>
            <li>Driver compliance records not subject to legal retention requirements (see below)</li>
            <li>In-app messages and chat history</li>
          </ul>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">What we may need to retain</h2>
          <p>
            Some information can't be immediately deleted due to legal, tax, safety, or insurance obligations. This
            includes financial/payment records (retained for at least 6 years under Canadian tax law), and records
            related to any completed jobs, claims, or safety incidents, which we retain only as long as reasonably
            necessary. This is explained further in our{' '}
            <Link href="/privacy" className="text-[#378ADD] underline">Privacy Policy</Link>.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">How long it takes</h2>
          <p>
            We aim to complete deletion requests within 30 days of verifying your identity. You'll receive a
            confirmation email once it's done.
          </p>
        </div>

        <div>
          <p>
            Questions? See our <Link href="/support" className="text-[#378ADD] underline">Support</Link> page or
            our full <Link href="/privacy" className="text-[#378ADD] underline">Privacy Policy</Link>.
          </p>
        </div>
      </main>
    </div>
  )
}
