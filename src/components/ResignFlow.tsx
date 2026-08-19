'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import LegalDocumentModal from './LegalDocumentModal'
import Logo from './Logo'

type OutstandingDoc = { slug: string; title: string; version: number }

// Blocks navigation for an already-approved driver/dealer until they've
// (re-)accepted every legal document that's changed since they last signed.
// Fetches the outstanding list, walks the user through each one via
// LegalDocumentModal, then redirects back to `redirectTo` once clear.
export default function ResignFlow({
  applicationType,
  redirectTo,
}: {
  applicationType: 'driver' | 'dealer'
  redirectTo: string
}) {
  const router = useRouter()
  const [outstanding, setOutstanding] = useState<OutstandingDoc[] | null>(null)
  const [error, setError] = useState('')
  const [openSlug, setOpenSlug] = useState<string | null>(null)

  async function loadOutstanding() {
    setError('')
    try {
      const res = await fetch(`/api/legal/outstanding?applicationType=${applicationType}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load outstanding documents.')
      setOutstanding(data.outstanding)
      if (data.outstanding.length === 0) {
        router.replace(redirectTo)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load outstanding documents.')
    }
  }

  useEffect(() => {
    loadOutstanding()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200 px-6 py-4">
        <div className="mb-2">
          <Logo height={18} />
        </div>
        <h1 className="text-lg font-semibold text-gray-900">Updated agreements & policies</h1>
      </header>

      <main className="max-w-lg mx-auto px-6 py-8">
        <p className="text-sm text-gray-600 mb-6">
          We&apos;ve updated our legal agreements and policies. Please review and agree to the documents below before
          continuing — you must scroll to the bottom of each one before you can agree.
        </p>

        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

        {outstanding == null && <p className="text-sm text-gray-400">Loading…</p>}

        {outstanding && outstanding.length > 0 && (
          <div className="space-y-2">
            {outstanding.map((doc) => (
              <div key={doc.slug} className="flex items-center justify-between gap-3 border border-gray-200 rounded-lg px-3 py-2.5">
                <span className="text-sm text-gray-700">{doc.title}</span>
                <button
                  type="button"
                  onClick={() => setOpenSlug(doc.slug)}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg border border-[#378ADD] text-[#378ADD] hover:bg-blue-50 whitespace-nowrap"
                >
                  Review & Agree
                </button>
              </div>
            ))}
          </div>
        )}

        <LegalDocumentModal
          slug={openSlug ?? ''}
          applicationType={applicationType}
          open={openSlug != null}
          onClose={() => setOpenSlug(null)}
          onAccepted={() => loadOutstanding()}
        />
      </main>
    </div>
  )
}
