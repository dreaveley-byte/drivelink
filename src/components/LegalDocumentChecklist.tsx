'use client'

import { useState } from 'react'
import LegalDocumentModal from './LegalDocumentModal'

export type LegalDocListItem = {
  slug: string
  label: string
}

// Renders a list of "Review & Agree" rows for a set of required legal documents,
// each opening LegalDocumentModal. Reports back the set of accepted slugs (and the
// version accepted) via onChange so the parent form can gate its own submit button.
export default function LegalDocumentChecklist({
  applicationType,
  docs,
  accepted,
  onChange,
}: {
  applicationType: 'driver' | 'dealer'
  docs: LegalDocListItem[]
  accepted: Record<string, number>
  onChange: (slug: string, version: number) => void
}) {
  const [openSlug, setOpenSlug] = useState<string | null>(null)

  return (
    <div className="space-y-2">
      {docs.map((doc) => {
        const isAccepted = accepted[doc.slug] != null
        return (
          <div
            key={doc.slug}
            className="flex items-center justify-between gap-3 border border-gray-200 rounded-lg px-3 py-2.5"
          >
            <div className="flex items-center gap-2">
              <span className={`text-xs ${isAccepted ? 'text-green-600' : 'text-gray-300'}`}>{isAccepted ? '✓' : '○'}</span>
              <span className="text-sm text-gray-700">{doc.label}</span>
            </div>
            <button
              type="button"
              onClick={() => setOpenSlug(doc.slug)}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg border whitespace-nowrap ${
                isAccepted ? 'border-gray-200 text-gray-400' : 'border-[#378ADD] text-[#378ADD] hover:bg-blue-50'
              }`}
            >
              {isAccepted ? 'Reviewed' : 'Review & Agree'}
            </button>
          </div>
        )
      })}

      <LegalDocumentModal
        slug={openSlug ?? ''}
        applicationType={applicationType}
        open={openSlug != null}
        onClose={() => setOpenSlug(null)}
        onAccepted={(version) => {
          if (openSlug) onChange(openSlug, version)
        }}
        // The apply forms that use this checklist already capture the applicant's
        // signature for the main contract once, at the bottom of the form — don't
        // also ask for it inside this per-document review modal.
        captureSignature={false}
      />
    </div>
  )
}
