import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Looks up an organization's own Google Business listing from its name and
// address (via Google's "Find Place From Text" endpoint), and saves the
// resulting review link. Callable by that org's own org_admin, or by a
// platform admin (used right after a dealer application is approved and
// the organization is first created).
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { organizationId } = await req.json()
  if (!organizationId) {
    return NextResponse.json({ error: 'Missing organizationId' }, { status: 400 })
  }

  const { data: profile } = await supabase.from('profiles').select('role, organization_id').eq('id', user.id).single()
  const isPlatformAdmin = profile?.role === 'platform_admin'
  const isOwnOrgAdmin = profile?.role === 'org_admin' && profile.organization_id === organizationId
  if (!isPlatformAdmin && !isOwnOrgAdmin) {
    return NextResponse.json({ error: 'Not authorized for this organization' }, { status: 403 })
  }

  const { data: org } = await supabase
    .from('organizations')
    .select('name, address, lat, lng')
    .eq('id', organizationId)
    .single()
  if (!org?.name) {
    return NextResponse.json({ ok: false, error: 'no_name_on_file' }, { status: 400 })
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: 'not_configured' }, { status: 501 })
  }

  const query = [org.name, org.address].filter(Boolean).join(', ')
  const params = new URLSearchParams({
    input: query,
    inputtype: 'textquery',
    fields: 'place_id,name,formatted_address',
    key: apiKey,
  })
  // Bias toward the org's own coordinates if we have them, so a dealership
  // name that's common across multiple cities still resolves to the right
  // branch instead of a same-named store somewhere else.
  if (org.lat != null && org.lng != null) {
    params.set('locationbias', `circle:20000@${org.lat},${org.lng}`)
  }

  let placeResult: { status: string; candidates?: { place_id: string; name: string; formatted_address: string }[] }
  try {
    const res = await fetch(`https://maps.googleapis.com/maps/api/place/findplacefromtext/json?${params.toString()}`)
    placeResult = await res.json()
  } catch (e) {
    return NextResponse.json({ ok: false, error: `Google Places request failed: ${e instanceof Error ? e.message : String(e)}` }, { status: 502 })
  }

  if (placeResult.status !== 'OK' || !placeResult.candidates?.length) {
    return NextResponse.json({ ok: false, error: 'not_found', googleStatus: placeResult.status })
  }

  const match = placeResult.candidates[0]
  const reviewLink = `https://search.google.com/local/writereview?placeid=${match.place_id}`

  const { error: updateError } = await supabase
    .from('organizations')
    .update({ google_place_id: match.place_id, google_review_link: reviewLink })
    .eq('id', organizationId)
  if (updateError) {
    return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    reviewLink,
    matchedName: match.name,
    matchedAddress: match.formatted_address,
  })
}
