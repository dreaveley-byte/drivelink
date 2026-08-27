import Link from 'next/link'
import Logo from '@/components/Logo'

export const metadata = {
  title: 'Support — Drivflo',
}

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200 px-6 py-4">
        <Link href="/"><Logo height={22} /></Link>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-12 text-sm text-gray-700 leading-relaxed space-y-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Support</h1>
          <p>Need help with the Drivflo app, your account, or a delivery job? Here's how to reach us.</p>
        </div>

        <div className="border border-gray-200 rounded-xl p-5 space-y-4">
          <div>
            <p className="text-xs text-gray-400 mb-1">Call us</p>
            <a href="tel:18884993284" className="text-lg font-medium text-gray-900 hover:text-[#378ADD]">
              1 888-499-3284
            </a>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Email us</p>
            <a href="mailto:support@drivflo.ca" className="text-lg font-medium text-gray-900 hover:text-[#378ADD]">
              support@drivflo.ca
            </a>
          </div>
        </div>

        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-2">Common questions</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong>Can&apos;t log in?</strong> Try resetting your password from the login screen. If you&apos;re
              still stuck, contact us using the details above.
            </li>
            <li>
              <strong>Question about a job or payment?</strong> Include the job details or delivery date when you
              reach out so we can look into it quickly.
            </li>
            <li>
              <strong>Applying as a driver or dealer?</strong> Visit{' '}
              <a href="https://www.drivflo.ca" className="text-[#378ADD] underline">drivflo.ca</a> to get started.
            </li>
          </ul>
        </div>

        <p className="text-xs text-gray-400">
          For privacy questions or to request deletion of your account and data, see our{' '}
          <Link href="/privacy" className="text-[#378ADD] underline">Privacy Policy</Link>.
        </p>
      </main>
    </div>
  )
}
