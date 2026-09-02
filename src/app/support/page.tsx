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
          <p>Need help with the Drivflo app? We're happy to help.</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Call us</h2>
          <p>
            <a href="tel:18884993284" className="text-[#378ADD] underline text-base font-medium">1 888-499-3284</a>
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Common questions</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong>I can't log in.</strong> Try resetting your password from the login screen. If that doesn't work, call us and we'll help directly.</li>
            <li><strong>My driver documents were rejected or expired.</strong> Check the Compliance section of your driver settings for what's needed, or call us with questions about a specific document.</li>
            <li><strong>I have a question about a payment or job.</strong> Call us and reference the job or payment in question - we can look it up directly.</li>
            <li><strong>I want to delete my account.</strong> Visit our <Link href="/delete-account" className="text-[#378ADD] underline">account deletion page</Link> for instructions.</li>
          </ul>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Other links</h2>
          <p>
            <Link href="/privacy" className="text-[#378ADD] underline">Privacy Policy</Link>
            {' · '}
            <Link href="/delete-account" className="text-[#378ADD] underline">Delete Account</Link>
            {' · '}
            <Link href="/" className="text-[#378ADD] underline">Drivflo home</Link>
          </p>
        </div>
      </main>
    </div>
  )
}
