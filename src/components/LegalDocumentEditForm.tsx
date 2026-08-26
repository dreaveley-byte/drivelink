'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LegalDocumentEditForm({
  slug,
  initialTitle,
  initialBody,
  initialAudience,
  initialEffectiveDate,
  currentVersion,
}: {
  slug: string
  initialTitle: string
  initialBody: string
  initialAudience: string
  initialEffectiveDate: string
  currentVersion: number
}) {
  const router = useRouter()
  const [title, setTitle] = useState(initialTitle)
  const [body, setBody] = useState(initialBody)
  const [audience, setAudience] = useState(initialAudience)
  const [effectiveDate, setEffectiveDate] = useState(initialEffectiveDate)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const dirty = title !== initialTitle || body !== initialBody || audience !== initialAudience || effectiveDate !== initialEffectiveDate

  async function handleSave() {
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      const res = await fetch('/api/admin/legal-documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, title, body, audience, effectiveDate }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save.')
      setSaved(true)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 flex-wrap text-xs text-gray-500">
        <span>Current version: {currentVersion}</span>
        {dirty && <span className="text-amber-600">Saving will create version {currentVersion + 1}</span>}
      </div>

      <div>
        <label className="block text-sm text-gray-700 mb-1">Title</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-gray-700 mb-1">Audience</label>
          <select
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="driver">driver</option>
            <option value="dealer">dealer</option>
            <option value="customer">customer</option>
            <option value="all">all</option>
          </select>
        </div>
        <div>
          <label className="block text-sm text-gray-700 mb-1">Effective date</label>
          <input
            type="date"
            value={effectiveDate}
            onChange={(e) => setEffectiveDate(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm text-gray-700 mb-1">Body</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={24}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono whitespace-pre-wrap"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && !dirty && <p className="text-sm text-green-600">Saved.</p>}

      <button
        type="button"
        disabled={!dirty || saving || !title.trim() || !body.trim()}
        onClick={handleSave}
        className="bg-[#378ADD] text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-[#2d6ead] disabled:opacity-50"
      >
        {saving ? 'Saving…' : `Save as version ${currentVersion + 1}`}
      </button>
      <p className="text-xs text-gray-400">
        Saving creates a new version and requires every driver/dealer who already accepted the previous version to
        re-sign before they can continue using the app.
      </p>
    </div>
  )
}
