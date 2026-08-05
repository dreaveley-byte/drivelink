// Helpers for correctly converting between `datetime-local` input values (which
// have NO timezone info, and are meant to represent the browser's local time)
// and real timestamps. Using `.toISOString()` directly on these is a common bug —
// it silently shifts the time by the browser's UTC offset. These helpers avoid that.

// Converts a `datetime-local` input value into a proper UTC ISO timestamp,
// correctly anchored to the CALLER's local timezone. Must be called client-side.
export function localInputToUtcIso(localValue: string): string | undefined {
  if (!localValue) return undefined
  const d = new Date(localValue)
  if (isNaN(d.getTime())) return undefined
  return d.toISOString()
}

// Converts a Date object into a `datetime-local` input value representing the
// same wall-clock moment in the local timezone (NOT UTC).
export function toLocalDatetimeInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

// Converts a Date object into a plain YYYY-MM-DD local calendar date string.
export function toLocalDateString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}
