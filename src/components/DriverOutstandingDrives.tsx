'use client'

import { useState } from 'react'
import Link from 'next/link'
import { formatCents } from '@/lib/pricing'
import { shortJobId } from '@/lib/shortId'
import type { PayrollJobRow, PayrollDrawRow } from '@/components/DriverPayrollJobs'

function shortDate(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', timeZone: 'America/Vancouver' })
}

// "Outstanding drives" tile on a driver's payroll card: completed drives from
// before the period on screen that the driver hasn't been paid for yet. Without
// this, a drive finished last week silently dropped out of this week's totals
// while its expenses and the driver's advances were still being counted.
// The number is a button that opens the list underneath the card.
export default function DriverOutstandingDrives({
  jobs,
  draws,
  periodLabel,
}: {
  jobs: PayrollJobRow[]
  draws: PayrollDrawRow[]
  periodLabel: string
}) {
  const [open, setOpen] = useState(false)
  const payTotal = jobs.reduce((s, j) => s + j.basePayCents + j.bonusCents, 0)
  const unpaidExpenses = jobs.reduce((s, j) => s + j.unpaidExpensesCents, 0)
  const outstandingDraws = draws.filter((d) => !d.settled)
  const drawsTotal = outstandingDraws.reduce((s, d) => s + d.amountCents, 0)

  return (
    <>
      <div>
        <p className="text-gray-400">Outstanding drives</p>
        {jobs.length > 0 ? (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="text-amber-700 font-medium text-sm mt-0.5 underline decoration-dotted underline-offset-2 hover:text-amber-800"
          >
            {jobs.length} · {formatCents(payTotal)} {open ? '▴' : '▾'}
          </button>
        ) : (
          <p className="text-gray-900 font-medium text-sm mt-0.5">0</p>
        )}
      </div>

      {open && (
        <div className="order-last col-span-2 sm:col-span-5 border border-amber-300 rounded-lg bg-amber-50/50 p-3 space-y-3">
          <p className="text-gray-700">
            Drives finished before {periodLabel} that haven&apos;t been paid yet. Their pay is included in this driver&apos;s <span className="font-medium">Net owed</span>, and
            “Mark paid” will cover them.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="text-gray-400 border-b border-amber-200">
                  <th className="font-normal pb-1.5 pr-3">Drive</th>
                  <th className="font-normal pb-1.5 pr-3">Dealer / customer</th>
                  <th className="font-normal pb-1.5 pr-3">Location</th>
                  <th className="font-normal pb-1.5 pr-3 text-right">Base pay</th>
                  <th className="font-normal pb-1.5 pr-3 text-right">Unpaid expenses</th>
                  <th className="font-normal pb-1.5 text-right">Owed</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => (
                  <tr key={j.id} className="border-b border-amber-100 align-top">
                    <td className="py-1.5 pr-3 whitespace-nowrap">
                      <Link href={`/dashboard/jobs/${j.id}/receipt`} className="font-mono text-[#378ADD] hover:underline">
                        {shortJobId(j.id)}
                      </Link>
                      <p className="text-[10px] text-gray-400">Completed {shortDate(j.completedAt)}</p>
                    </td>
                    <td className="py-1.5 pr-3">
                      <p className="text-gray-900">{j.dealer}</p>
                      <p className="text-gray-500">{j.customer}</p>
                    </td>
                    <td className="py-1.5 pr-3 max-w-[220px]">
                      <p className="text-gray-700 truncate" title={j.pickup}>{j.pickup}</p>
                      <p className="text-gray-400 truncate" title={j.dropoff}>→ {j.dropoff}</p>
                    </td>
                    <td className="py-1.5 pr-3 text-right whitespace-nowrap text-gray-900">
                      {formatCents(j.basePayCents)}
                      {j.bonusCents > 0 && <p className="text-[10px] text-gray-400">+ {formatCents(j.bonusCents)} bonus</p>}
                    </td>
                    <td className="py-1.5 pr-3 text-right whitespace-nowrap text-gray-900">{formatCents(j.unpaidExpensesCents)}</td>
                    <td className="py-1.5 text-right whitespace-nowrap text-amber-800 font-medium">
                      {formatCents(j.basePayCents + j.bonusCents + j.unpaidExpensesCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="text-gray-900 font-medium">
                  <td className="pt-2 pr-3" colSpan={3}>Total ({jobs.length} drive{jobs.length === 1 ? '' : 's'})</td>
                  <td className="pt-2 pr-3 text-right whitespace-nowrap">{formatCents(payTotal)}</td>
                  <td className="pt-2 pr-3 text-right whitespace-nowrap">{formatCents(unpaidExpenses)}</td>
                  <td className="pt-2 text-right whitespace-nowrap">{formatCents(payTotal + unpaidExpenses)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="text-gray-500">
            The unpaid expenses above are already counted in “Outstanding reimbursements”; only the base pay is added on top.
          </p>

          <div className="border-t border-amber-200 pt-2 space-y-1">
            <p className="text-gray-400">Advances (draws) taken by this driver</p>
            {outstandingDraws.length === 0 ? (
              <p className="text-gray-500">No outstanding advances.</p>
            ) : (
              <>
                {outstandingDraws.map((d) => (
                  <div key={d.id} className="flex items-center justify-between gap-3">
                    <span className="text-gray-700">{shortDate(d.createdAt)}{d.note ? ` · ${d.note}` : ''}</span>
                    <span className="text-red-600 font-medium">−{formatCents(d.amountCents)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between gap-3 pt-1 border-t border-amber-200 text-gray-900 font-medium">
                  <span>Total outstanding advances</span>
                  <span>−{formatCents(drawsTotal)}</span>
                </div>
              </>
            )}
            <p className="text-gray-500">
              Advances belong to the driver, not to one drive — they come off the driver&apos;s total owed when you mark them paid.
            </p>
          </div>
        </div>
      )}
    </>
  )
}
