import Link from 'next/link'

// Blocking warning pop-up shown on the driver/dealer dashboard when a new or
// updated legal document is outstanding. Unlike the old behavior (silently
// redirecting straight to /driver/resign or /dashboard/resign), this makes
// the gate visible as an explicit warning with a "Click to review" action —
// the page behind it renders without any job data (see driver/page.tsx and
// dashboard/page.tsx), so there's nothing to interact with besides this
// pop-up. There's deliberately no dismiss/close button: the only way past it
// is to follow the link into the resign flow (ResignFlow / LegalDocumentModal)
// and accept the outstanding document(s).
export default function LegalGateModal({
  applicationType,
  resignHref,
  documentCount,
}: {
  applicationType: 'driver' | 'dealer'
  resignHref: string
  documentCount: number
}) {
  const actionNoun = applicationType === 'driver' ? 'getting jobs' : 'posting jobs'

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-6">
      <div className="bg-white w-full sm:max-w-sm sm:rounded-xl rounded-t-xl p-6 text-center">
        <div className="mx-auto mb-3 w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 text-lg">
          ⚠️
        </div>
        <h2 className="text-sm font-semibold text-gray-900 mb-1">A new agreement needs to be signed</h2>
        <p className="text-sm text-gray-500 mb-6">
          We&apos;ve updated {documentCount === 1 ? 'a document' : 'our agreements and policies'} you need to review and
          agree to before {actionNoun} again.
        </p>
        <Link
          href={resignHref}
          className="block w-full bg-[#378ADD] text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-[#2d6ead]"
        >
          Click to review
        </Link>
      </div>
    </div>
  )
}
