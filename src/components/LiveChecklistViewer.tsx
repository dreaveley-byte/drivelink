'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type ChecklistItem = {
  id: string
  label: string
  completed_at: string | null
  notes: string | null
  file_paths: string[]
}

function isImagePath(path: string) {
  return /\.(jpe?g|png|webp|gif)$/i.test(path)
}

export default function LiveChecklistViewer({ jobId }: { jobId: string }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<ChecklistItem[] | null>(null)
  const [fileUrls, setFileUrls] = useState<Record<string, string>>({})

  async function loadChecklist() {
    if (items !== null) return // already loaded once, no need to refetch every toggle
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('job_checklist_items')
      .select('id, label, completed_at, notes, file_paths')
      .eq('job_id', jobId)
      .order('sort_order')

    setItems(data ?? [])

    const allPaths = (data ?? []).flatMap((i) => i.file_paths)
    if (allPaths.length > 0) {
      const urls: Record<string, string> = {}
      await Promise.all(
        allPaths.map(async (path) => {
          const { data: signed } = await supabase.storage.from('job-media').createSignedUrl(path, 60 * 15)
          if (signed?.signedUrl) urls[path] = signed.signedUrl
        })
      )
      setFileUrls(urls)
    }
    setLoading(false)
  }

  function toggle() {
    const next = !open
    setOpen(next)
    if (next) loadChecklist()
  }

  const doneCount = items?.filter((i) => i.completed_at).length ?? 0
  const totalCount = items?.length ?? 0

  return (
    <div className="mt-2 pt-2 border-t border-gray-100">
      <button
        type="button"
        onClick={toggle}
        className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
      >
        <span>{open ? '▾' : '▸'}</span>
        {items !== null ? `Checklist progress (${doneCount}/${totalCount})` : 'View checklist progress'}
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          {loading && <p className="text-xs text-gray-400">Loading…</p>}
          {!loading && items && items.length === 0 && (
            <p className="text-xs text-gray-400">No checklist items yet.</p>
          )}
          {!loading && items?.map((item, idx) => {
            const phase = item.label.startsWith('Delivery:') ? 'Delivery' : item.label.startsWith('Pickup:') ? 'Pickup' : null
            const prevPhase = idx > 0
              ? (items[idx - 1].label.startsWith('Delivery:') ? 'Delivery' : items[idx - 1].label.startsWith('Pickup:') ? 'Pickup' : null)
              : null
            const displayLabel = item.label.replace(/^(Pickup|Delivery):\s*/, '')
            return (
              <div key={item.id} className="text-xs">
                {phase && phase !== prevPhase && (
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mt-2 mb-1 first:mt-0">{phase}</p>
                )}
                <span className={item.completed_at ? 'text-gray-700' : 'text-gray-400'}>
                  {item.completed_at ? '✓ ' : '○ '}{displayLabel}
                </span>
                {item.notes && <p className="text-xs text-gray-500 mt-0.5 ml-4">{item.notes}</p>}
                {item.file_paths.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-1 ml-4">
                    {item.file_paths.map((path) =>
                      fileUrls[path] ? (
                        <a key={path} href={fileUrls[path]} target="_blank" rel="noopener noreferrer">
                          {isImagePath(path) ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={fileUrls[path]} alt="" className="w-14 h-14 rounded-lg object-cover border border-gray-200" />
                          ) : (
                            <span className="w-14 h-14 rounded-lg border border-gray-200 flex items-center justify-center text-[10px] text-gray-500 bg-gray-50">File</span>
                          )}
                        </a>
                      ) : null
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
