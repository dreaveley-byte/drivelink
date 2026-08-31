import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  }

  const { deviceToken, platform } = await req.json()
  if (!deviceToken || !['ios', 'android'].includes(platform)) {
    return NextResponse.json({ error: 'Missing or invalid deviceToken/platform.' }, { status: 400 })
  }

  const { error } = await supabase
    .from('driver_push_tokens')
    .upsert(
      { driver_id: user.id, device_token: deviceToken, platform, last_seen_at: new Date().toISOString() },
      { onConflict: 'driver_id,device_token' }
    )

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
