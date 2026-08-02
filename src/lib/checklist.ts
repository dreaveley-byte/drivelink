// Vehicle-moving jobs get the full condition/documentation checklist.
export const VEHICLE_CHECKLIST: string[] = [
  'Confirm odometer & fuel level at pickup',
  'Walk-around video of vehicle condition',
  'Condition report photos (4 corners + interior)',
  'Upload registration',
  'Upload out-of-province safety (if applicable)',
  'Customer walkthrough at delivery',
  'Photo with customer',
  'Customer signs consent & satisfaction form',
]

// Document/courier jobs get a shorter checklist.
export const DOCUMENT_CHECKLIST: string[] = [
  'Confirm pickup contact and documents received',
  'Confirm delivery contact and documents handed off',
  'Get signature or confirmation of receipt',
]

const VEHICLE_JOB_TYPES = ['Vehicle Delivery', 'Vehicle Pickup', 'Dealer to Dealer']

export function getDefaultChecklist(jobTypeName: string | null | undefined): string[] {
  if (jobTypeName && VEHICLE_JOB_TYPES.includes(jobTypeName)) return VEHICLE_CHECKLIST
  return DOCUMENT_CHECKLIST
}
