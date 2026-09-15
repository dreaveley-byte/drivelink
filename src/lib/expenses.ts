export type ExpenseBaselines = { fuel: number; inspection: number; food: number; hotel: number; ferry: number; return_transport: number }

// How much approving/adding this specific expense would actually add to the
// job's dealer-billed total, given everything already approved in the same
// category so far - only the amount beyond the baseline already priced into
// the job gets added. Food never adds to the dealer bill at all (handled
// separately via the leftover-meal-money-goes-to-driver-pay mechanism).
export function computeExpenseAddAmount(
  category: string,
  amountCents: number,
  priorApprovedSameCategoryCents: number,
  baselines: ExpenseBaselines
): number {
  if (category === 'food') return 0
  if (category !== 'fuel' && category !== 'inspection' && category !== 'hotel' && category !== 'ferry' && category !== 'return_transport') return amountCents

  const baseline = baselines[category as 'fuel' | 'inspection' | 'hotel' | 'ferry' | 'return_transport']
  const newSum = priorApprovedSameCategoryCents + amountCents
  return Math.max(0, newSum - baseline) - Math.max(0, priorApprovedSameCategoryCents - baseline)
}
