export type ChecklistItemType = 'check' | 'photo' | 'video' | 'upload' | 'signature' | 'condition_report' | 'tristate' | 'yesno'

export type ChecklistDefinitionItem = {
  label: string
  type: ChecklistItemType
  documentText?: string
}

const RELEASE_AND_MEDIA_CONSENT_TEXT =
  'I acknowledge that I have received and personally inspected the vehicle described above, ' +
  'together with all included options and equipment. I accept the vehicle and its condition as ' +
  "recorded in this delivery's condition report, and I confirm that I am completely satisfied with " +
  'the vehicle. I grant DriveLink, its third-party partners, and the selling dealer permission to use ' +
  'photographs of me with my purchased vehicle for promotional and social media purposes.'

// Vehicle-moving jobs get the full pickup-through-delivery checklist, split into
// two clearly labeled phases so the driver always knows where they are.
export const VEHICLE_CHECKLIST: ChecklistDefinitionItem[] = [
  // Pickup phase
  { label: 'Pickup: Confirm VIN on vehicle matches Bill of Sale', type: 'yesno' },
  { label: 'Pickup: Confirm VIN matches registration (if applicable)', type: 'tristate' },
  { label: 'Pickup: Verify year, make, model & colour match Bill of Sale', type: 'check' },
  { label: 'Pickup: Photograph VIN', type: 'photo' },
  { label: 'Pickup: Photograph odometer showing mileage', type: 'photo' },
  { label: 'Pickup: Photograph windshield', type: 'photo' },
  { label: 'Pickup: Full 360° walkaround video', type: 'video' },
  { label: 'Pickup: Condition report', type: 'condition_report' },
  { label: 'Pickup: Mark vehicle picked up', type: 'check' },

  // Delivery phase
  { label: "Delivery: Verify purchaser — photo of customer holding driver's license", type: 'photo' },
  { label: 'Delivery: Condition walkaround video', type: 'video' },
  { label: 'Delivery: Photos of any damage', type: 'photo' },
  {
    label: 'Delivery: Customer signs release, condition acceptance & media consent',
    type: 'signature',
    documentText: RELEASE_AND_MEDIA_CONSENT_TEXT,
  },
  { label: 'Delivery: Photograph vehicle', type: 'photo' },
  { label: 'Delivery: Photograph odometer', type: 'photo' },
  { label: 'Delivery: Obtain signatures', type: 'signature' },
  { label: 'Delivery: Short video testimonial from customer', type: 'video' },
  { label: 'Delivery: Complete checklist', type: 'check' },
  { label: 'Delivery: Upload photos', type: 'photo' },
]

// Appended when the job is flagged as a First Nations reserve delivery.
export const FIRST_NATIONS_CHECKLIST: ChecklistDefinitionItem[] = [
  { label: 'Delivery: Deliver vehicle to the reservation', type: 'check' },
  { label: 'Delivery: Photograph customer in front of their vehicle at the reservation', type: 'photo' },
]

// Added on top of the vehicle checklist whenever the job includes a trade-in pickup.
export const TRADE_IN_CHECKLIST: ChecklistDefinitionItem[] = [
  { label: 'Pickup: Get trade-in registration from customer', type: 'upload' },
  { label: 'Pickup: Confirm name on registration matches bill of sale owner', type: 'check' },
  { label: 'Pickup: All owners listed on registration have signed both the registration and APV9T/transfer form', type: 'check' },
]

// Document/courier jobs get a shorter checklist.
export const DOCUMENT_CHECKLIST: ChecklistDefinitionItem[] = [
  { label: 'Confirm pickup contact and documents received', type: 'check' },
  { label: 'Confirm delivery contact and documents handed off', type: 'check' },
  { label: 'Get signature or confirmation of receipt', type: 'signature' },
]

const VEHICLE_JOB_TYPES = ['Vehicle Delivery', 'Vehicle Pickup', 'Dealer to Dealer']

export function getDocumentTextForLabel(label: string): string | undefined {
  const displayLabel = label.replace(/^(Pickup|Delivery):\s*/, '')
  const match = [...VEHICLE_CHECKLIST, ...TRADE_IN_CHECKLIST, ...DOCUMENT_CHECKLIST].find(
    (item) => item.label.replace(/^(Pickup|Delivery):\s*/, '') === displayLabel
  )
  return match?.documentText
}
export function getDefaultChecklist(
  jobTypeName: string | null | undefined,
  isTradeIn: boolean,
  isFirstNationsDelivery: boolean = false
): ChecklistDefinitionItem[] {
  if (jobTypeName && VEHICLE_JOB_TYPES.includes(jobTypeName)) {
    let items = VEHICLE_CHECKLIST
    if (isTradeIn) items = [...items, ...TRADE_IN_CHECKLIST]
    if (isFirstNationsDelivery) items = [...items, ...FIRST_NATIONS_CHECKLIST]
    return items
  }
  return DOCUMENT_CHECKLIST
}
