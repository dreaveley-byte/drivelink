// True when an address is somewhere you can't drive to from the BC Lower
// Mainland without a ferry: Vancouver Island, the southern Gulf Islands, the
// Sunshine Coast and Powell River. A rough shape, not a survey - it only has
// to separate those places from the Lower Mainland, where the old bounding
// box wrongly included Vancouver, North Vancouver, Richmond and Delta
// (anything west of -123.0), which made mainland jobs look like island jobs.
export function isFerryIsolated(lat: number, lng: number): boolean {
  if (lat < 48.2 || lat > 51.0) return false
  if (lng < -128.6) return false
  // Victoria / Saanich / southern Gulf Islands: everything west of -123.0
  // below the Tsawwassen latitude is water or island.
  if (lat < 48.95) return lng <= -123.0
  // Nanaimo north to Campbell River, plus Gibsons / Sechelt / Powell River:
  // the Lower Mainland (UBC, West Vancouver, Horseshoe Bay) sits east of -123.4.
  return lng <= -123.4
}

// Harbour Air scheduled seaplane bases that matter for a driver heading home
// across the Strait of Georgia. Coordinates are the harbour terminals; Google
// routes the ride to/from them.
export type HarbourAirBase = { code: string; name: string; lat: number; lng: number; island: boolean }

export const HARBOUR_AIR_BASES: HarbourAirBase[] = [
  { code: 'CYHC', name: 'Vancouver Harbour (Coal Harbour)', lat: 49.2893, lng: -123.1167, island: false },
  { code: 'CYWH', name: 'Victoria Inner Harbour', lat: 48.4230, lng: -123.3705, island: true },
  { code: 'CAC4', name: 'Nanaimo Harbour', lat: 49.1690, lng: -123.9380, island: true },
]
