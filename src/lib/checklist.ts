export type ChecklistItemType = 'check' | 'photo' | 'video' | 'upload' | 'signature' | 'condition_report'

export type ChecklistDefinitionItem = {
  label: string
  type: ChecklistItemType
}

// Vehicle-moving jobs get the full pickup-through-delivery checklist.
export const VEHICLE_CHECKLIST: ChecklistDefinitionItem[] = [
  { label: 'Pick up vehicle', type: 'check' },
  { label: 'Verify year, make, model & VIN', type: 'check' },
  { label: 'Check VIN on registration matches vehicle (if insurance complete)', type: 'check' },
  { label: 'Condition report — note damages, cleanliness & fuel level', type: 'condition_report' },
  { label: 'Walk-around video of vehicle condition', type: 'video' },
  { label: 'Verify purchaser', type: 'check' },
  { label: 'Photograph vehicle', type: 'photo' },
  { label: 'Photograph odometer', type: 'photo' },
  { label: 'Obtain signature at pickup', type: 'signature' },
  { label: 'Upload photos', type: 'photo' },
  { label: 'Upload registration', type: 'upload' },
  { label: 'Upload out-of-province safety (if applicable)', type: 'upload' },
  { label: 'Complete checklist', type: 'check' },
  { label: 'Customer walkthrough at delivery', type: 'check' },
  { label: 'Photo with customer', type: 'photo' },
  { label: 'Customer signs consent & satisfaction form', type: 'signature' },
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
