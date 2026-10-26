'use client'

import { useState } from 'react'
import Link from 'next/link'
import { formatCents } from '@/lib/pricing'
import { shortJobId } from '@/lib/shortId'

export type PayrollJobRow = {
  id: string
  completedAt: string | null
  dealer: string
  customer: string
  pickup: string
  dropoff: string
  basePayCents: number
  bonusCents: number
  expensesCents: number
  unpaidExpensesCents: number
  paid: boolean
  paidAt: string | null
  outstandingCents: number
}

export type PayrollDrawRow = {
  id: string
  amountCents: number
  note: string | null
  createdAt: string
  settled: boolean
}

function shortDate(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', timeZone: 'America/Vancouver' })
}

// The "Jobs" cell on a driver's payroll card. The count is a button: clicking
// it opens the list of that driver's jobs for the period underneath the card,
// with each job's base pay, added expenses, total and whether it has been paid.
// It renders as grid children of the card's stats grid (the panel is pushed to
// the end of the grid with order-last and spans the whole row).
export default function DriverPayrollJobs({
  label,
  jobs,
  draws,
  otherOutstandingReimbursementsCents,
  netOwedCents,
}: {
  label: string
  jobs: PayrollJobRow[]
  draws: PayrollDrawRow[]
  otherOutstandingReimbursementsCents: number
  netOwedCents: number
}) {
  const [open, setOpen] = useState(false)

  const baseTotal = jobs.reduce((s, j) => s + j.basePayCents + j.bonusCents, 0)
  const expenseTotal = jobs.reduce((s, j) => s + j.expensesCents, 0)
  const outstandingTotal = jobs.reduce((s, j) => s + j.outstandingCents, 0)
  const unsettledDraws = draws.filter((d) => !d.settled).reduce((s, d) => s + d.amountCents, 0)

  return (
    <>
      <div>
        <p className="text-gray-400">{label}</p>
        {jobs.length > 0 ? (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="text-[#378ADD] font-medium text-sm mt-0.5 underline decoration-dotted underline-offset-2 hover:text-[#2d6ead]"
          >
            {jobs.length} {open ? '▴' : '▾'}
          </button>
        ) : (
          <p className="text-gray-900 font-medium text-sm mt-0.5">0</p>
        )}
      </div>

      {open && (
        <div className="order-last col-span-2 sm:col-span-4 border border-gray-200 rounded-lg bg-gray-50 p-3 space-y-3">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="text-gray-400 border-b border-gray-200">
                  <th className="font-normal pb-1.5 pr-3">Job</th>
                  <th className="font-normal pb-1.5 pr-3">Dealer / customer</th>
                  <th className="font-normal pb-1.5 pr-3">Location</th>
                  <th className="font-normal pb-1.5 pr-3 text-right">Base pay</th>
                  <th className="font-normal pb-1.5 pr-3 text-right">Expenses</th>
                  <th className="font-normal pb-1.5 pr-3 text-right">Total</th>
                  <th className="font-normal pb-1.5 text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => (
                  <tr key={j.id} className="border-b border-gray-100 align-top">
                    <td className="py-1.5 pr-3 whitespace-nowrap">
                      <Link href={`/dashboard/jobs/${j.id}/receipt`} className="font-mono text-[#378ADD] hover:underline">
                        {shortJobId(j.id)}
                      </Link>
                      <p className="text-[10px] text-gray-400">{shortDate(j.completedAt)}</p>
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
                    <td className="py-1.5 pr-3 text-right whitespace-nowrap text-gray-900">{formatCents(j.expensesCents)}</td>
                    <td className="py-1.5 pr-3 text-right whitespace-nowrap text-gray-900 font-medium">
                      {formatCents(j.basePayCents + j.bonusCents + j.expensesCents)}
                    </td>
                    <td className="py-1.5 text-right whitespace-nowrap">
                      {j.outstandingCents > 0 ? (
                        <span className="text-amber-700 font-medium">Outstanding {formatCents(j.outstandingCents)}</span>
                      ) : (
                        <span className="text-green-700 font-medium">Paid{j.paidAt ? ` ${shortDate(j.paidAt)}` : ''}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="text-gray-900 font-medium">
                  <td className="pt-2 pr-3" colSpan={3}>Total ({jobs.length} job{jobs.length === 1 ? '' : 's'})</td>
                  <td className="pt-2 pr-3 text-right whitespace-nowrap">{formatCents(baseTotal)}</td>
                  <td className="pt-2 pr-3 text-right whitespace-nowrap">{formatCents(expenseTotal)}</td>
                  <td className="pt-2 pr-3 text-right whitespace-nowrap">{formatCents(baseTotal + expenseTotal)}</td>
                  <td className="pt-2 text-right whitespace-nowrap">
                    {outstandingTotal > 0 ? `Outstanding ${formatCents(outstandingTotal)}` : 'All paid'}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="border-t border-gray-200 pt-2 space-y-1">
            <p className="text-gray-400">Advances (draws) against this driver</p>
            {draws.length === 0 ? (
              <p className="text-gray-500">None.</p>
            ) : (
              draws.map((d) => (
                <div key={d.id} className="flex items-center justify-between gap-3">
                  <span className="text-gray-700">
                    {shortDate(d.createdAt)}{d.note ? ` · ${d.note}` : ''}
                  </span>
                  <span className={d.settled ? 'text-gray-400' : 'text-red-600 font-medium'}>
                    −{formatCents(d.amountCents)} {d.settled ? '(settled)' : '(outstanding)'}
                  </span>
                </div>
              ))
            )}
            {otherOutstandingReimbursementsCents > 0 && (
              <div className="flex items-center justify-between gap-3 pt-1">
                <span className="text-gray-700">Unpaid expense reimbursements from jobs outside this period</span>
                <span className="text-amber-700 font-medium">+{formatCents(otherOutstandingReimbursementsCents)}</span>
              </div>
            )}
            <div className="flex items-center justify-between gap-3 pt-1.5 border-t border-gray-200 text-gray-900 font-medium">
              <span>Net owed (jobs + unpaid expenses − outstanding advances{unsettledDraws > 0 ? ` ${formatCents(unsettledDraws)}` : ''})</span>
              <span>{formatCents(netOwedCents)}</span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
