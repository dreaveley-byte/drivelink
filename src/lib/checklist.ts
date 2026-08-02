export type ChecklistItemType =
  | 'check' | 'photo' | 'video' | 'upload' | 'signature' | 'condition_report'
  | 'tristate' | 'yesno' | 'input' | 'notes'

export type ChecklistDefinitionItem = {
  label: string
  type: ChecklistItemType
  documentText?: string
  numeric?: boolean // for 'input' items — hints a numeric keyboard
}

// Vehicle-moving jobs: pickup phase, unchanged from before.
export const VEHICLE_CHECKLIST: ChecklistDefinitionItem[] = [
  { label: 'Pickup: Confirm VIN on vehicle matches Bill of Sale', type: 'yesno' },
  { label: 'Pickup: Confirm VIN matches registration (if applicable)', type: 'tristate' },
  { label: 'Pickup: Verify year, make, model & colour match Bill of Sale', type: 'check' },
  { label: 'Pickup: Photograph VIN', type: 'photo' },
  { label: 'Pickup: Photograph odometer showing mileage', type: 'photo' },
  { label: 'Pickup: Photograph windshield', type: 'photo' },
  { label: 'Pickup: Full 360° walkaround video', type: 'video' },
  { label: 'Pickup: Condition report', type: 'condition_report' },
  { label: 'Pickup: Mark vehicle picked up', type: 'check' },

  // Delivery phase — appears once the driver marks the job delivered
  { label: 'Delivery: Photograph windshield', type: 'photo' },
  { label: 'Delivery: Photograph odometer', type: 'photo' },
  { label: 'Delivery: Enter the odometer reading', type: 'input', numeric: true },
  { label: 'Delivery: Photograph dash & fuel gauge with engine running (check for trouble lights)', type: 'photo' },
  { label: 'Delivery: Full 360° walkaround video', type: 'video' },
  { label: 'Delivery: Photos of any new damage', type: 'photo' },
  { label: "Delivery: Photo of customer holding driver's license or government photo ID beside their face", type: 'photo' },
  {
    label: 'Delivery: Customer signs delivery disclosure',
    type: 'signature',
    // documentText is built dynamically at render time for this item — see buildDeliveryDisclosureText()
  },
  { label: 'Delivery: Photo of happy customer in front of their new vehicle', type: 'photo' },
  { label: 'Delivery: Quick video testimonial from customer', type: 'video' },
  { label: 'Delivery: Additional notes', type: 'notes' },
  { label: 'Delivery: Delivery completed', type: 'check' },
]

// Appended (delivery phase) when the job is flagged as a First Nations reserve delivery.
// The "happy customer" photo above is skipped in this case since the reserve photo covers it.
export const FIRST_NATIONS_CHECKLIST: ChecklistDefinitionItem[] = [
  { label: 'Delivery: Was this vehicle delivered on native land?', type: 'yesno' },
  { label: 'Delivery: Photo of customer standing with their vehicle on reserve land', type: 'photo' },
]

// Appended (delivery phase) whenever the job includes a trade-in.
export const TRADE_IN_CHECKLIST: ChecklistDefinitionItem[] = [
  { label: 'Delivery: Verify trade registration and APV9T/transfer form are signed by all owners', type: 'check' },
  { label: 'Delivery: Verify name on registration matches Bill of Sale', type: 'check' },
  { label: 'Delivery: Photo of the trade registration signed by the owner', type: 'photo' },
]

// Appended (in-progress phase) when the job requires an out-of-province inspection.
export const INSPECTION_CHECKLIST: ChecklistDefinitionItem[] = [
  { label: 'Inspection: Go to registry and pick up out-of-province inspection report', type: 'check' },
  { label: 'Inspection: Perform out-of-province inspection at repair facility — completed', type: 'check' },
  { label: 'Inspection: Name of repair facility', type: 'input' },
  { label: 'Inspection: Amount of the inspection', type: 'input', numeric: true },
  { label: 'Inspection: Any additional repairs needed?', type: 'yesno' },
  { label: 'Inspection: Total amount', type: 'input', numeric: true },
  { label: 'Inspection: Photo upload of inspection report', type: 'upload' },
]

// Document/courier jobs get a shorter checklist.
export const DOCUMENT_CHECKLIST: ChecklistDefinitionItem[] = [
  { label: 'Confirm pickup contact and documents received', type: 'check' },
  { label: 'Confirm delivery contact and documents handed off', type: 'check' },
  { label: 'Get signature or confirmation of receipt', type: 'signature' },
]

const VEHICLE_JOB_TYPES = ['Vehicle Delivery', 'Vehicle Pickup', 'Dealer to Dealer']

export function getDocumentTextForLabel(label: string): string | undefined {
  const displayLabel = label.replace(/^(Pickup|Delivery|Inspection):\s*/, '')
  const match = [...VEHICLE_CHECKLIST, ...TRADE_IN_CHECKLIST, ...DOCUMENT_CHECKLIST].find(
    (item) => item.label.replace(/^(Pickup|Delivery|Inspection):\s*/, '') === displayLabel
  )
  return match?.documentText
}

export type IncludedItems = {
  keyCount: number | null
  hasWheelLock: boolean
  hasChargingCables: boolean
  otherItems: string | null
}

function includedItemsLabel(items: IncludedItems): string | null {
  const parts: string[] = []
  if (items.keyCount) parts.push(`${items.keyCount} set${items.keyCount === 1 ? '' : 's'} of keys`)
  if (items.hasWheelLock) parts.push('wheel lock')
  if (items.hasChargingCables) parts.push('charging cables')
  if (items.otherItems) parts.push(items.otherItems)
  if (parts.length === 0) return null
  return `Pickup: Confirm included items — ${parts.join(', ')}`
}

export function getDefaultChecklist(
  jobTypeName: string | null | undefined,
  isTradeIn: boolean,
  isFirstNationsDelivery: boolean = false,
  includedItems?: IncludedItems,
  needsOutOfProvinceInspection: boolean = false
): ChecklistDefinitionItem[] {
  if (jobTypeName && VEHICLE_JOB_TYPES.includes(jobTypeName)) {
    let items = [...VEHICLE_CHECKLIST]

    if (includedItems) {
      const label = includedItemsLabel(includedItems)
      if (label) items.splice(1, 0, { label, type: 'check' })
    }

    if (needsOutOfProvinceInspection) {
      // Inserted before the delivery phase begins, since it happens while en route (in_progress).
      const deliveryStartIdx = items.findIndex((i) => i.label.startsWith('Delivery:'))
      items.splice(deliveryStartIdx === -1 ? items.length : deliveryStartIdx, 0, ...INSPECTION_CHECKLIST)
    }

    if (isFirstNationsDelivery) {
      // Skip the generic "happy customer" photo — the reserve-land photo covers it.
      items = items.filter((i) => i.label !== 'Delivery: Photo of happy customer in front of their new vehicle')
      const disclosureIdx = items.findIndex((i) => i.label === 'Delivery: Customer signs delivery disclosure')
      items.splice(disclosureIdx + 1, 0, ...FIRST_NATIONS_CHECKLIST)
    }

    if (isTradeIn) {
      const disclosureIdx = items.findIndex((i) => i.label === 'Delivery: Customer signs delivery disclosure')
      items.splice(disclosureIdx, 0, ...TRADE_IN_CHECKLIST)
    }

    return items
  }
  return DOCUMENT_CHECKLIST
}

// Builds the delivery disclosure document text dynamically, preloaded with real job data.
export function buildDeliveryDisclosureText(params: {
  customerName?: string | null
  customerAddress?: string | null
  customerPhone?: string | null
  vehicleYear?: number | null
  vehicleMake?: string | null
  vehicleModel?: string | null
  vin?: string | null
  odometer?: string | null
  dealerName?: string | null
  dealerAddress?: string | null
  dealerPhone?: string | null
  deliveryDateTime?: string | null
  deliveryLat?: number | null
  deliveryLng?: number | null
}): string {
  const vehicleDesc = [params.vehicleYear, params.vehicleMake, params.vehicleModel].filter(Boolean).join(' ')
  const lines: string[] = []

  lines.push('VEHICLE DELIVERY ACKNOWLEDGEMENT, ACCEPTANCE & MEDIA CONSENT')
  lines.push('')
  if (params.customerName) lines.push(`Customer: ${params.customerName}`)
  if (params.customerAddress) lines.push(`Address: ${params.customerAddress}`)
  if (params.customerPhone) lines.push(`Phone: ${params.customerPhone}`)
  if (vehicleDesc) lines.push(`Vehicle: ${vehicleDesc}`)
  if (params.vin) lines.push(`VIN: ${params.vin}`)
  if (params.odometer) lines.push(`Odometer at delivery: ${params.odometer} km`)
  if (params.dealerName) lines.push(`Delivering dealer: ${params.dealerName}`)
  if (params.dealerAddress) lines.push(`Dealer address: ${params.dealerAddress}`)
  if (params.dealerPhone) lines.push(`Dealer phone: ${params.dealerPhone}`)
  if (params.deliveryDateTime) lines.push(`Delivery date/time: ${params.deliveryDateTime}`)
  if (params.deliveryLat != null && params.deliveryLng != null) {
    lines.push(`Delivery location (GPS): ${params.deliveryLat.toFixed(5)}, ${params.deliveryLng.toFixed(5)}`)
  }
  lines.push('')
  lines.push(
    'I acknowledge that I have taken delivery of the above-described vehicle after being given a full ' +
    'opportunity to inspect its exterior, interior, glass, wheels and tires, lights and accessories, odometer, ' +
    'and included keys and accessories. I confirm I am satisfied with the condition of the vehicle at the time ' +
    "of delivery, and that I have reviewed the Vehicle Condition Report completed at pickup, which forms part " +
    'of this transaction.'
  )
  lines.push('')
  lines.push(
    'I acknowledge that the vehicle delivered to me matches the vehicle I agreed to purchase, including its ' +
    'year, make, model, VIN, colour, trim level, and options and equipment as described in my purchase ' +
    'documentation.'
  )
  lines.push('')
  lines.push(
    'By signing below, I acknowledge that I have accepted delivery and ownership of the above-described ' +
    'vehicle in accordance with my purchase agreement, and that responsibility for the vehicle transfers to ' +
    'me upon delivery, subject to the terms of that agreement and applicable law.'
  )
  lines.push('')
  lines.push(
    'I acknowledge that any promised repairs have been completed and any promised accessories installed to ' +
    'my satisfaction, or that any outstanding items have been listed separately on a signed Due Bill or We ' +
    'Owe form forming part of my purchase agreement.'
  )
  lines.push('')
  lines.push(
    'I voluntarily authorize DriveLink, its third-party partners, and the selling dealership to use ' +
    'photographs and video taken during this delivery for promotional and marketing purposes. I understand my ' +
    'participation is entirely voluntary, I will receive no compensation, and declining this authorization ' +
    'will not affect my purchase.'
  )
  lines.push('')
  lines.push(
    'By signing electronically below, I certify that I have read and understand this acknowledgement, had the ' +
    'opportunity to ask questions, and voluntarily accept delivery of the vehicle described above.'
  )

  return lines.join('\n')
}
