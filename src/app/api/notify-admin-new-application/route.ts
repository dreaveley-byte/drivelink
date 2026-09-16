import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendSms } from '@/lib/sms'

// Called right after a driver or dealer application is submitted - texts
// admin so a new application doesn't just sit unnoticed until someone
// happens to check the Applications page.
export async function POST(req: NextRequest) {
  const { applicationType, name } = await req.json()
  if (applicationType !== 'driver' && applicationType !== 'dealer') {
    return NextResponse.json({ error: 'Invalid applicationType' }, { status: 400 })
  }

  const supabase = await createClient()

  const { data: settings } = await supabase
    .from('pricing_settings')
    .select('admin_alert_phone')
    .eq('id', 1)
    .single()

  if (!settings?.admin_alert_phone) {
    return NextResponse.json({ ok: true, notified: false })
  }

  const who = applicationType === 'driver' ? 'driver' : 'dealer'
  const body = `🆕 New ${who} application submitted${name ? ` by ${name}` : ''} — review it on the Applications page.`

  const result = await sendSms(settings.admin_alert_phone, body)

  return NextResponse.json({ ok: true, notified: result.ok })
}
