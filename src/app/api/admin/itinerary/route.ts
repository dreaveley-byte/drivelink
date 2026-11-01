import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildItinerary } from '@/lib/itinerary'

// Several provider lookups (directions, registry, bus, airline search) run here.
export const maxDuration = 60

// Admin-only: builds the full door-to-door trip plan shown on the ordering page.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'platform_admin') return NextResponse.json({ error: 'Admins only.' }, { status: 403 })

  if (!process.env.GOOGLE_MAPS_API_KEY) {
    return NextResponse.json({ error: 'Google Maps isn’t configured, so a trip plan can’t be built.' }, { status: 501 })
  }

  const { pickupAddress, dropoffAddress, startUtc, registryRequired } = await req.json()
  if (!pickupAddress || !dropoffAddress || !startUtc || isNaN(new Date(startUtc).getTime())) {
    return NextResponse.json({ error: 'Enter the pickup address, delivery address and pickup date/time first.' }, { status: 400 })
  }

  const { data: settings } = await supabase.from('pricing_settings').select('*').eq('id', 1).single()
  try {
    const itinerary = await buildItinerary({
      pickupAddress,
      dropoffAddress,
      startUtc,
      registryRequired: !!registryRequired,
      settings: settings ?? {},
    })
    return NextResponse.json({ itinerary })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Could not build the trip plan.' }, { status: 502 })
  }
}
