export type ChecklistItemType = 'check' | 'photo' | 'video' | 'upload' | 'signature' | 'condition_report'

export type ChecklistDefinitionItem = {
  label: string
  type: ChecklistItemType
}

// Vehicle-moving jobs get the full pickup-through-delivery checklist, split into
// two clearly labeled phases so the driver always knows where they are.
export const VEHICLE_CHECKLIST: ChecklistDefinitionItem[] = [
  // Pickup phase
  { label: 'Pickup: Pick up vehicle', type: 'check' },
  { label: 'Pickup: Verify year, make, model & VIN', type: 'check' },
  { label: 'Pickup: Check VIN on registration matches vehicle (if insurance complete)', type: 'check' },
  { label: 'Pickup: Condition report — note damages, cleanliness & fuel level', type: 'condition_report' },
  { label: 'Pickup: Walk-around video', type: 'video' },
  { label: 'Pickup: Photos of any damage, the VIN, and the dash', type: 'photo' },
  { label: 'Pickup: Upload registration', type: 'upload' },
  { label: 'Pickup: Upload out-of-province safety (if applicable)', type: 'upload' },
  { label: 'Pickup: Mark vehicle picked up', type: 'check' },

  // Delivery phase
  { label: "Delivery: Verify purchaser — photo of customer holding driver's license", type: 'photo' },
  { label: 'Delivery: Condition walkaround video', type: 'video' },
  { label: 'Delivery: Photos of any damage', type: 'photo' },
  { label: 'Delivery: Customer signs off on condition report', type: 'signature' },
  { label: 'Delivery: Photograph vehicle', type: 'photo' },
  { label: 'Delivery: Photograph odometer', type: 'photo' },
  { label: 'Delivery: Obtain signatures', type: 'signature' },
  { label: 'Delivery: Complete checklist', type: 'check' },
  { label: 'Delivery: Upload photos', type: 'photo' },
]

// Added on top of the vehicle checklist whenever the job includes a trade-in pickup.
export const TRADE_IN_CHECKLIST: ChecklistDefinitionItem[] = [
  { label: 'Get trade-in registration from customer', type: 'upload' },
  { label: 'Confirm name on registration matches bill of sale owner', type: 'check' },
  { label: 'Registration signed by customer (both signers if two names on it)', type: 'signature' },
  { label: 'APV9T / transfer form signed', type: 'signature' },
]

// Document/courier jobs get a shorter checklist.
export const DOCUMENT_CHECKLIST: ChecklistDefinitionItem[] = [
  { label: 'Confirm pickup contact and documents received', type: 'check' },
  { label: 'Confirm delivery contact and documents handed off', type: 'check' },
  { label: 'Get signature or confirmation of receipt', type: 'signature' },
]

const VEHICLE_JOB_TYPES = ['Vehicle Delivery', 'Vehicle Pickup', 'Dealer to Dealer']

export function getDefaultChecklist(jobTypeName: string | null | undefined, isTradeIn: boolean): ChecklistDefinitionItem[] {
  if (jobTypeName && VEHICLE_JOB_TYPES.includes(jobTypeName)) {
    return isTradeIn ? [...VEHICLE_CHECKLIST, ...TRADE_IN_CHECKLIST] : VEHICLE_CHECKLIST
  }
  return DOCUMENT_CHECKLIST
}
