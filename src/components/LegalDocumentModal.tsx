'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { documentRequiresSignature } from '@/lib/legalDocuments'
import ChecklistSignaturePad from './ChecklistSignaturePad'

type LegalDocument = {
  slug: string
  version: number
  title: string
  body: string
  audience: string
  effective_date: string
}

// The seeded legal text for the two main contract documents (driver_contractor_agreement,
// dealer_master_services_agreement) embeds its acknowledgement checklist and signature line
// as plain characters ("☐ I agree...", "Electronic Signature: ____") inside the document
// body — those are legal-text glyphs, not interactive controls. This pulls them out so we
// can render real checkboxes and a real signature pad for them, and strips them (plus the
// trailing signature-blank lines) from the text that's actually displayed so they aren't
// shown twice.
function parseDocumentBody(body: string, slug: string): { displayBody: string; ackItems: string[] } {
  if (!documentRequiresSignature(slug)) {
    return { displayBody: body, ackItems: ['I have read and agree to this document.'] }
  }

  const ackItems: string[] = []
  const keptLines: string[] = []
  for (const line of body.split('\n')) {
    const trimmed = line.trim()
    if (/^Required .+ Acknowledgements$/i.test(trimmed)) continue
    if (trimmed.startsWith('☐')) {
      ackItems.push(trimmed.replace(/^☐\s*/, ''))
      continue
    }
    // Signature-block blank lines, e.g. "Electronic Signature: ____________________"
    if (/:\s*_{3,}\s*$/.test(trimmed)) continue
    keptLines.push(line)
  }
  while (keptLines.length && keptLines[keptLines.length - 1].trim() === '') keptLines.pop()

  return { displayBody: keptLines.join('\n'), ackItems }
}

export default function LegalDocumentModal({
  slug,
  applicationType,
  jobId,
  open,
  onClose,
  onAccepted,
  captureSignature = true,
}: {
  slug: string
  applicationType: 'driver' | 'dealer' | 'customer'
  jobId?: string
  open: boolean
  onClose: () => void
  onAccepted: (version: number) => void
  // Some callers (the driver/dealer apply forms) already capture the main contract
  // signature separately, once, at the bottom of the whole application form — set this
  // to false there so the modal doesn't ask the applicant to sign twice. Everywhere else
  // (e.g. the re-sign flow, which has no other signature step) this defaults to on.
  captureSignature?: boolean
}) {
  const [doc, setDoc] = useState<LegalDocument | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [scrolledToBottom, setScrolledToBottom] = useState(false)
  const [saving, setSaving] = useState(false)
  const [ackChecks, setAckChecks] = useState<boolean[]>([])
  const [signaturePath, setSignaturePath] = useState<string | null>(null)
  const [uploadingSignature, setUploadingSignature] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const requiresSignature = documentRequiresSignature(slug) && captureSignature
  const { displayBody, ackItems } = useMemo(
    () => (doc ? parseDocumentBody(doc.body, doc.slug) : { displayBody: '', ackItems: [] as string[] }),
    [doc]
  )

  useEffect(() => {
    if (!open) return
    setDoc(null)
    setError('')
    setScrolledToBottom(false)
    setAckChecks([])
    setSignaturePath(null)
    setLoading(true)
    fetch(`/api/legal/document?slug=${encodeURIComponent(slug)}`)
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to load document.')
        setDoc(data.document)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [open, slug])

  // Size the checkbox state once we know how many acknowledgement items this document has.
  useEffect(() => {
    setAckChecks(new Array(ackItems.length).fill(false))
  }, [ackItems.length, doc?.slug])

  function handleScroll() {
    const el = scrollRef.current
    if (!el) return
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 24
    if (nearBottom) setScrolledToBottom(true)
  }

  // Short documents that don't need scrolling shouldn't trap the user — if the
  // content already fits without a scrollbar, treat it as "read".
  useEffect(() => {
    if (!doc) return
    const el = scrollRef.current
    if (el && el.scrollHeight <= el.clientHeight + 4) setScrolledToBottom(true)
  }, [doc])

  function toggleAck(index: number, checked: boolean) {
    if (!scrolledToBottom) return
    setAckChecks((prev) => {
      const next = [...prev]
      next[index] = checked
      return next
    })
  }

  const allAcked = ackChecks.length === ackItems.length && ackChecks.every(Boolean)
  const canSign = scrolledToBottom && allAcked
  const canAgree = scrolledToBottom && allAcked && (!requiresSignature || !!signaturePath) && !saving && !!doc

  async function handleSignatureSave(blob: Blob) {
    if (!doc) return
    setUploadingSignature(true)
    setError('')
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not signed in.')
      const path = `${user.id}/${doc.slug}-${Date.now()}.png`
      const { error: uploadError } = await supabase.storage
        .from('legal-signatures')
        .upload(path, blob, { upsert: true, contentType: 'image/png' })
      if (uploadError) throw new Error(uploadError.message)
      setSignaturePath(path)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save signature.')
    } finally {
      setUploadingSignature(false)
    }
  }

  async function handleAgree() {
    if (!doc || !canAgree) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/legal/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentSlug: doc.slug,
          documentVersion: doc.version,
          applicationType,
          jobId,
          ...(requiresSignature ? { signaturePath } : {}),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to record acceptance.')
      onAccepted(doc.version)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record acceptance.')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-6">
      <div className="bg-white w-full sm:max-w-2xl sm:rounded-xl rounded-t-xl flex flex-col max-h-[90vh]">
        <div className="border-b border-gray-200 px-5 py-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">{doc?.title ?? 'Loading document…'}</h2>
            {doc && <p className="text-xs text-gray-400 mt-0.5">Version {doc.version} · Effective {doc.effective_date}</p>}
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">
            ✕
          </button>
        </div>

        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="px-5 py-4 overflow-y-auto flex-1 text-sm text-gray-700 whitespace-pre-line"
        >
          {loading && <p className="text-gray-400">Loading…</p>}
          {error && <p className="text-red-600 text-xs mb-2">{error}</p>}
          {displayBody}

          {doc && ackItems.length > 0 && (
            <div className={`mt-5 space-y-2 border-t border-gray-200 pt-4 ${!scrolledToBottom ? 'opacity-50' : ''}`}>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Required acknowledgements</p>
              {ackItems.map((item, index) => (
                <label key={index} className="flex items-start gap-2 text-sm text-gray-700 whitespace-normal">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={!!ackChecks[index]}
                    disabled={!scrolledToBottom}
                    onChange={(e) => toggleAck(index, e.target.checked)}
                  />
                  {item}
                </label>
              ))}
            </div>
          )}

          {doc && requiresSignature && (
            <div className="mt-5 border-t border-gray-200 pt-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Signature</p>
              {canSign ? (
                signaturePath ? (
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <span>✓ Signature captured.</span>
                    <button type="button" className="text-xs text-gray-400 hover:text-gray-700" onClick={() => setSignaturePath(null)}>
                      Redo
                    </button>
                  </div>
                ) : (
                  <ChecklistSignaturePad saving={uploadingSignature} onSave={handleSignatureSave} />
                )
              ) : (
                <p className="text-xs text-gray-400">
                  Scroll to the bottom and check all required boxes above to enable signing.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-gray-200 px-5 py-4">
          {!scrolledToBottom && doc && (
            <p className="text-xs text-gray-400 mb-2">Scroll to the bottom to enable the acknowledgement checkboxes.</p>
          )}
          {scrolledToBottom && !allAcked && doc && (
            <p className="text-xs text-gray-400 mb-2">Check all required boxes to continue.</p>
          )}
          {scrolledToBottom && allAcked && requiresSignature && !signaturePath && (
            <p className="text-xs text-gray-400 mb-2">Sign above to continue.</p>
          )}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-gray-500 hover:text-gray-900 px-3 py-2"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!canAgree}
              onClick={handleAgree}
              className="flex-1 bg-[#378ADD] text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-[#2d6ead] disabled:opacity-40"
            >
              {saving ? 'Saving…' : 'I have read and agree'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
