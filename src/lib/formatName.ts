// Used anywhere a name goes into a customer-facing SMS - takes just the
// first name and normalizes casing (handles ALL CAPS entries, all-lowercase
// entries, etc. from however the name was originally typed in).
export function firstNameProperCase(fullName: string | null | undefined): string {
  if (!fullName) return ''
  const first = fullName.trim().split(/\s+/)[0] ?? ''
  if (!first) return ''
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase()
}
