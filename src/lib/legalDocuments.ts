// Canonical list of legal document slugs and which application type(s) must
// accept them. Kept in one place so the apply flows, the re-sign gate and the
// admin panel all agree on what's required.

export type LegalDocSlug =
  | 'driver_contractor_agreement'
  | 'dealer_master_services_agreement'
  | 'vehicle_delivery_acknowledgement'
  | 'privacy_policy'
  | 'platform_terms_of_service'
  | 'fee_waiting_cancellation_policy'
  | 'drug_alcohol_policy'
  | 'driver_standards_code_of_conduct'
  | 'vehicle_inspection_damage_policy'
  | 'driver_expense_reimbursement_policy'

export const ALL_LEGAL_DOC_SLUGS: LegalDocSlug[] = [
  'driver_contractor_agreement',
  'dealer_master_services_agreement',
  'vehicle_delivery_acknowledgement',
  'privacy_policy',
  'platform_terms_of_service',
  'fee_waiting_cancellation_policy',
  'drug_alcohol_policy',
  'driver_standards_code_of_conduct',
  'vehicle_inspection_damage_policy',
  'driver_expense_reimbursement_policy',
]

// Documents a driver must accept before applying / continuing to use the app.
export const DRIVER_REQUIRED_DOCS: LegalDocSlug[] = [
  'driver_contractor_agreement',
  'drug_alcohol_policy',
  'driver_standards_code_of_conduct',
  'vehicle_inspection_damage_policy',
  'driver_expense_reimbursement_policy',
  'privacy_policy',
  'platform_terms_of_service',
]

// Documents a dealer (org_admin / org_member) must accept before applying / continuing.
export const DEALER_REQUIRED_DOCS: LegalDocSlug[] = [
  'dealer_master_services_agreement',
  'fee_waiting_cancellation_policy',
  'privacy_policy',
  'platform_terms_of_service',
]

export function requiredDocsForApplicationType(applicationType: 'driver' | 'dealer'): LegalDocSlug[] {
  return applicationType === 'driver' ? DRIVER_REQUIRED_DOCS : DEALER_REQUIRED_DOCS
}

// The two main contract documents require a real pen signature (not just a
// click-through checkbox) — everything else is satisfied by scrolling to the
// bottom and checking an acknowledgement box.
export const SIGNATURE_REQUIRED_DOC_SLUGS: LegalDocSlug[] = [
  'driver_contractor_agreement',
  'dealer_master_services_agreement',
]

export function documentRequiresSignature(slug: string): boolean {
  return (SIGNATURE_REQUIRED_DOC_SLUGS as string[]).includes(slug)
}
