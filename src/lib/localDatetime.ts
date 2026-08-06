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

// Interprets a `datetime-local` input value (naive, no timezone) as wall-clock
// time in a SPECIFIC IANA timezone — e.g. "2026-08-10T17:00" in "America/Edmonton"
// — and returns the correct UTC ISO timestamp. This is what makes a delivery time
// entered for an Edmonton drop-off actually mean 5pm Edmonton time, not 5pm wherever
// the dealer's browser happens to be set to. Handles DST correctly since it uses the
// real zone rules for that specific date via Intl.DateTimeFormat.
export function zonedLocalInputToUtcIso(localValue: string, timeZone: string): string | undefined {
  if (!localValue) return undefined
  // Treat the naive string as if it were UTC — a starting guess to anchor from.
  const asUtcGuess = new Date(localValue.length === 16 ? `${localValue}:00Z` : `${localValue}Z`)
  if (isNaN(asUtcGuess.getTime())) return undefined

  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false,
    })
    const parts = formatter.formatToParts(asUtcGuess)
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00'
    // What our UTC guess actually displays as, in the target zone.
    const displayedAsLocal = new Date(
      `${get('year')}-${get('month')}-${get('day')}T${get('hour') === '24' ? '00' : get('hour')}:${get('minute')}:${get('second')}Z`
    )
    // The gap between our guess and what it displays as IS the zone's offset —
    // apply it to get the true UTC instant for the requested wall-clock time.
    const offsetMs = asUtcGuess.getTime() - displayedAsLocal.getTime()
    return new Date(asUtcGuess.getTime() + offsetMs).toISOString()
  } catch {
    // Unknown/invalid timeZone string — fall back to browser-local interpretation
    // rather than failing outright.
    return localInputToUtcIso(localValue)
  }
}

// Converts a UTC ISO timestamp into a `datetime-local` input value representing
// the same instant's wall-clock time in a SPECIFIC IANA timezone (not the browser's).
export function utcIsoToZonedInputValue(utcIso: string, timeZone: string): string {
  const date = new Date(utcIso)
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
      hour12: false,
    })
    const parts = formatter.formatToParts(date)
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00'
    const hour = get('hour') === '24' ? '00' : get('hour')
    return `${get('year')}-${get('month')}-${get('day')}T${hour}:${get('minute')}`
  } catch {
    return toLocalDatetimeInputValue(date)
  }
}

// Short display label for a timezone at a given instant, e.g. "PDT" or "MST" —
// used so times shown in a non-browser-local zone are unambiguous.
export function zonedAbbreviation(utcIso: string, timeZone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'short' }).formatToParts(new Date(utcIso))
    return parts.find((p) => p.type === 'timeZoneName')?.value ?? ''
  } catch {
    return ''
  }
}
