'use client'

import { useEffect, useRef, useState } from 'react'

export type DeliveryAutoFillFields = {
  recipientName?: string | null
  address?: string | null
  phone?: string | null
  vehicleDesc?: string | null
  vin?: string | null
  odometer?: string | null
  dealerName?: string | null
  deliveryDateTime?: string | null
  deliveryLocation?: string | null
  jobNumber?: string | null
}

type LegalDocument = {
  slug: string
  version: number
  title: string
  body: string
  effective_date: string
}

// The full Vehicle Delivery Acknowledgement, Release & Acceptance — presented to the
// customer on the driver's phone/tablet at the moment of delivery. Auto-fills the
// header fields from live job data (matching the old buildDeliveryDisclosureText
// behaviour), gates the required acknowledgement behind scrolling to the bottom, and
// offers a separate, clearly optional media-consent checkbox that does NOT gate
// completing delivery.
export default function VehicleDeliveryAcknowledgementModal({
  open,
  jobId,
  fields,
  onClose,
  onAccepted,
}: {
  open: boolean
  jobId: string
  fields: DeliveryAutoFillFields
  onClose: () => void
  onAccepted: (result: { version: number; mediaConsent: boolean; caslConsent: boolean; phoneMailConsent: boolean }) => void
}) {
  const [doc, setDoc] = useState<LegalDocument | null>(null)
  const [mediaDoc, setMediaDoc] = useState<LegalDocument | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [scrolledToBottom, setScrolledToBottom] = useState(false)
  const [saving, setSaving] = useState(false)
  const [ackReceipt, setAckReceipt] = useState(false)
  const [ackInspect, setAckInspect] = useState(false)
  const [ackRead, setAckRead] = useState(false)
  const [mediaConsent, setMediaConsent] = useState(false)
  const [caslConsent, setCaslConsent] = useState(false)
  const [phoneMailConsent, setPhoneMailConsent] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    setDoc(null)
    setMediaDoc(null)
    setError('')
    setScrolledToBottom(false)
    setAckReceipt(false)
    setAckInspect(false)
    setAckRead(false)
    setMediaConsent(false)
    setCaslConsent(false)
    setPhoneMailConsent(false)
    setLoading(true)
    Promise.all([
      fetch('/api/legal/document?slug=vehicle_delivery_acknowledgement').then((res) => res.json().then((data) => ({ res, data }))),
      fetch('/api/legal/document?slug=media_consent_release').then((res) => res.json().then((data) => ({ res, data }))),
    ])
      .then(([main, media]) => {
        if (!main.res.ok) throw new Error(main.data.error || 'Failed to load document.')
        setDoc(main.data.document)
        // The media consent document is optional by design (the checkbox
        // itself is optional) - if it's missing for any reason, the
        // acknowledgement itself still loads and works fine, just without
        // the media section below.
        if (media.res.ok) setMediaDoc(media.data.document)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [open])

  function handleScroll() {
    const el = scrollRef.current
    if (!el) return
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 24) setScrolledToBottom(true)
  }

  useEffect(() => {
    if (!doc) return
    const el = scrollRef.current
    if (el && el.scrollHeight <= el.clientHeight + 4) setScrolledToBottom(true)
  }, [doc])

  const headerLines: [string, string | null | undefined][] = [
    ['Recipient', fields.recipientName],
    ['Address', fields.address],
    ['Phone', fields.phone],
    ['Vehicle', fields.vehicleDesc],
    ['VIN', fields.vin],
    ['Odometer', fields.odometer],
    ['Dealer', fields.dealerName],
    ['Delivery Date/Time', fields.deliveryDateTime],
    ['Delivery Location/GPS', fields.deliveryLocation],
    ['Job Number', fields.jobNumber],
  ]

  const canAgree = scrolledToBottom && ackReceipt && ackInspect && ackRead

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
          applicationType: 'customer',
          jobId,
          mediaConsent,
          mediaConsentDocumentVersion: mediaConsent ? mediaDoc?.version ?? null : null,
          caslMarketingConsent: caslConsent,
          phoneMailMarketingConsent: phoneMailConsent,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to record acceptance.')
      onAccepted({ version: doc.version, mediaConsent, caslConsent, phoneMailConsent })
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
      <div className="bg-white w-full sm:max-w-2xl sm:rounded-xl rounded-t-xl flex flex-col max-h-[92vh]">
        <div className="border-b border-gray-200 px-5 py-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">{doc?.title ?? 'Loading document…'}</h2>
            {doc && <p className="text-xs text-gray-400 mt-0.5">Version {doc.version} · Effective {doc.effective_date}</p>}
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">
            ✕
          </button>
        </div>

        <div ref={scrollRef} onScroll={handleScroll} className="px-5 py-4 overflow-y-auto flex-1 text-sm text-gray-700">
          {loading && <p className="text-gray-400">Loading…</p>}
          {error && <p className="text-red-600 text-xs mb-2">{error}</p>}

          {doc && (
            <>
              <div className="border border-gray-200 rounded-lg p-3 mb-4 bg-gray-50 text-xs space-y-0.5">
                {headerLines.map(([label, value]) => (
                  <p key={label}>
                    <span className="text-gray-400">{label}: </span>
                    <span className="text-gray-800">{value || '—'}</span>
                  </p>
                ))}
              </div>
              <p className="whitespace-pre-line">{doc.body}</p>

              <div className="mt-5 space-y-2 border-t border-gray-200 pt-4">
                <label className="flex items-start gap-2 text-sm text-gray-700">
                  <input type="checkbox" className="mt-0.5" checked={ackReceipt} onChange={(e) => setAckReceipt(e.target.checked)} />
                  I acknowledge receipt and physical delivery.
                </label>
                <label className="flex items-start gap-2 text-sm text-gray-700">
                  <input type="checkbox" className="mt-0.5" checked={ackInspect} onChange={(e) => setAckInspect(e.target.checked)} />
                  I had a reasonable opportunity to inspect the vehicle.
                </label>
                <label className="flex items-start gap-2 text-sm text-gray-700">
                  <input type="checkbox" className="mt-0.5" checked={ackRead} onChange={(e) => setAckRead(e.target.checked)} />
                  I have read and agree to this acknowledgement.
                </label>
              </div>

              <div className="mt-4 border-t border-gray-200 pt-4">
                <p className="text-xs font-semibold text-gray-500 mb-1">OPTIONAL: MEDIA CONSENT &amp; PROMOTIONAL COMMUNICATIONS</p>
                <p className="text-xs text-gray-500 mb-2">
                  All three parts below are voluntary, independent of one another, and not required to receive the vehicle.
                </p>
                {mediaDoc && (
                  <div className="border border-gray-200 rounded-lg p-3 mb-3 bg-gray-50 text-xs">
                    <p className="font-medium text-gray-700 mb-1">
                      {mediaDoc.title} — Version {mediaDoc.version}
                    </p>
                    <p className="whitespace-pre-line text-gray-600">{mediaDoc.body}</p>
                  </div>
                )}
                <label className="flex items-start gap-2 text-sm text-gray-700">
                  <input type="checkbox" className="mt-0.5" checked={mediaConsent} onChange={(e) => setMediaConsent(e.target.checked)} />
                  YES — I have read Part A above and authorize Drivflo Inc., its affiliated and third-party companies,
                  and/or the selling Dealer to use photographs/video
                  of me taken during delivery as described.
                </label>
                <label className="flex items-start gap-2 text-sm text-gray-700 mt-3">
                  <input type="checkbox" className="mt-0.5" checked={caslConsent} onChange={(e) => setCaslConsent(e.target.checked)} />
                  YES — I have read Part B above and consent to receive promotional emails and/or text messages from
                  Drivflo Inc., its affiliated and third-party companies, and/or the selling Dealer. I understand I
                  can withdraw this consent at any time.
                </label>
                <label className="flex items-start gap-2 text-sm text-gray-700 mt-3">
                  <input type="checkbox" className="mt-0.5" checked={phoneMailConsent} onChange={(e) => setPhoneMailConsent(e.target.checked)} />
                  YES — I have read Part C above and consent to receive promotional phone calls and mail from
                  Drivflo Inc., its affiliated and third-party companies, and/or the selling Dealer. I understand I
                  can withdraw this consent at any time.
                </label>
              </div>
            </>
          )}
        </div>

        <div className="border-t border-gray-200 px-5 py-4">
          {!scrolledToBottom && doc && (
            <p className="text-xs text-gray-400 mb-2">Scroll to the bottom and check all required boxes to continue.</p>
          )}
          <div className="flex items-center gap-3">
            <button type="button" onClick={onClose} className="text-sm text-gray-500 hover:text-gray-900 px-3 py-2">
              Cancel
            </button>
            <button
              type="button"
              disabled={!canAgree || saving || !doc}
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
