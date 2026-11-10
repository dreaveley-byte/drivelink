'use client'

import { useState } from 'react'
import DriverJobActions from '@/app/driver/DriverJobActions'
import LocationSharer from '@/components/LocationSharer'
import ChatBadgeLink from '@/components/ChatBadgeLink'
import JobRequirementFlags from '@/components/JobRequirementFlags'
import HeldCustomerSms from '@/components/HeldCustomerSms'
import { formatCents } from '@/lib/pricing'

type Job = React.ComponentProps<typeof DriverJobActions>['job'] & {
  id: string
  status: string
  customer_full_name?: string | null
  recipient_name?: string | null
  estimated_distance_km?: number | null
  estimated_driver_pay_cents?: number | null
  admin_pay_override_cents?: number | null
  vehicle_year?: string | number | null
  vehicle_make?: string | null
  vehicle_model?: string | null
  stock_number?: string | null
  scheduled_for?: string | null
}

// "Active" = the driver has the vehicle / is on the drive (picked up, in
// progress, or delivered but not yet completed). Merely accepted jobs
// ('assigned') are the collapsed yellow cards.
const ACTIVE_STATUSES = ['picked_up', 'in_progress', 'delivered']

// Only one card is open at a time. The active job starts open and sits at the
// top; collapsing it (to open another) never changes its status - and its
// location sharing keeps running while it's collapsed.
export default function ClaimedJobsList({
  jobs,
  currentUserId,
  unreadChatJobIds,
  approvedReimbursementByJob,
}: {
  jobs: Job[]
  currentUserId: string
  unreadChatJobIds: string[]
  approvedReimbursementByJob: Record<string, number>
}) {
  const ordered = [...jobs].sort((a, b) => Number(ACTIVE_STATUSES.includes(b.status)) - Number(ACTIVE_STATUSES.includes(a.status)))
  const firstActive = ordered.find((j) => ACTIVE_STATUSES.includes(j.status))
  const [expandedId, setExpandedId] = useState<string | null>(firstActive?.id ?? null)
  void currentUserId

  if (ordered.length === 0) {
    return <p className="text-sm text-gray-400 py-8 text-center">You haven&apos;t claimed any jobs. Check the Available tab.</p>
  }

  return (
    <div className="space-y-3">
      {ordered.map((job) => {
        const isActive = ACTIVE_STATUSES.includes(job.status)
        const expanded = expandedId === job.id
        const unread = unreadChatJobIds.includes(job.id)
        const pay = job.admin_pay_override_cents ?? job.estimated_driver_pay_cents ?? 0
        const vehicle = [job.vehicle_year, job.vehicle_make, job.vehicle_model].filter(Boolean).join(' ')
        const customer = job.customer_full_name || job.recipient_name || 'Customer'
        const border = isActive ? 'border-green-500' : 'border-yellow-400'

        return (
          <div key={job.id} className={`border-2 ${border} rounded-xl ${expanded ? 'p-2' : ''}`}>
            {!expanded && (
              <button
                type="button"
                onClick={() => setExpandedId(job.id)}
                className="w-full flex items-center gap-4 text-left px-4 py-3"
                aria-expanded={false}
              >
                <span className="shrink-0 text-base font-semibold text-gray-900 w-20">{formatCents(pay)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-gray-900 truncate">{customer}</span>
                  <span className="block text-xs text-gray-500 truncate">
                    {vehicle || 'Vehicle details not listed'}
                    {job.stock_number ? ` · Stock #${job.stock_number}` : ''}
                  </span>
                  <span className="block text-xs text-gray-400">
                    {job.estimated_distance_km != null ? `${Math.round(job.estimated_distance_km)} km` : 'Distance not set'}
                    {isActive ? ' · In progress' : ' · Claimed'}
                  </span>
                </span>
                <span className="text-gray-400 text-sm">▾</span>
              </button>
            )}

            {/* Active jobs stay mounted while collapsed so nothing resets and
                location sharing continues. Other claimed jobs mount on open. */}
            {(expanded || isActive) && (
              <div className={expanded ? '' : 'hidden'}>
                {expanded && (
                  <button type="button" onClick={() => setExpandedId(null)} className="text-xs text-gray-400 px-2 pb-1 hover:text-gray-600">
                    ▴ Collapse
                  </button>
                )}
                <JobRequirementFlags job={job as never} />
                <DriverJobActions job={job} isActive approvedReimbursementCents={approvedReimbursementByJob[job.id] ?? 0} />
                {isActive && <div className="px-2"><HeldCustomerSms jobId={job.id} /></div>}
                <div className="mt-2 flex items-center gap-3 px-2 pb-2">
                  <ChatBadgeLink jobId={job.id} unread={unread} prominent />
                </div>
              </div>
            )}
            {isActive && !expanded && (
              <div className="hidden">
                <LocationSharer jobId={job.id} />
              </div>
            )}
            {isActive && expanded && (
              <div className="px-2 pb-2">
                <LocationSharer jobId={job.id} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
