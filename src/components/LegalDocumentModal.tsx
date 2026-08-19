'use client'

import { useEffect, useRef, useState } from 'react'

type LegalDocument = {
  slug: string
  version: number
  title: string
  body: string
  audience: string
  effective_date: string
}

export default function LegalDocumentModal({
  slug,
  applicationType,
  jobId,
  open,
  onClose,
  onAccepted,
}: {
  slug: string
  applicationType: 'driver' | 'dealer' | 'customer'
  jobId?: string
  open: boolean
  onClose: () => void
  onAccepted: (version: number) => void
}) {
  const [doc, setDoc] = useState<LegalDocument | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [scrolledToBottom, setScrolledToBottom] = useState(false)
  const [saving, setSaving] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    setDoc(null)
    setError('')
    setScrolledToBottom(false)
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

  async function handleAgree() {
    if (!doc) return
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
          {doc?.body}
        </div>

        <div className="border-t border-gray-200 px-5 py-4">
          {!scrolledToBottom && doc && (
            <p className="text-xs text-gray-400 mb-2">Scroll to the bottom to enable the agree button.</p>
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
              disabled={!scrolledToBottom || saving || !doc}
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
