import { NextRequest, NextResponse } from 'next/server'
import { lookupFerry } from '@/lib/ferryLookup'

// Which BC Ferries crossing a trip uses, with sailing times and the driving legs
// to/from each terminal. The logic lives in lib/ferryLookup so the admin trip
// itinerary can use exactly the same lookup as the quote.
export async function POST(req: NextRequest) {
  const { originAddress, destinationAddress, actualDrivingKm, actualDrivingMinutes } = await req.json()
  const result = await lookupFerry({ originAddress, destinationAddress, actualDrivingKm, actualDrivingMinutes })
  if (!result.ok) return NextResponse.json(result.body, { status: result.status })
  return NextResponse.json(result.data)
}
