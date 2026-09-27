import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { sendSms } from '@/lib/sms'

const roleLabels: Record<string, string> = {
  driver: 'Your driver',
  org_member: 'The dealer',
  org_admin: 'The dealer',
  platform_admin: 'Drivflo',
  customer: 'The customer',
}

// Uses the service role rather than the caller's own session throughout -
// this route is reached by both authenticated callers (the dealer<->driver
// chat) and a genuinely anonymous one (a customer on their public tracking
// page, with no session at all). profiles is only ever granted to
// 'authenticated', not 'anon', so an anonymous caller's own session client
// would silently get nothing back from the phone-number lookups below -
// the route itself is the trust boundary here (it only ever notifies
// whoever a valid token/jobId's own driver or dealer actually is, not
// anything the caller can influence), so bypassing RLS for these specific,
// narrow lookups is the same pattern already used elsewhere for this kind
// of server-only notification logic.
function serviceClient() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('SUPABASE_SERVICE_ROLE_KEY is not set — chat notifications cannot be looked up without it.')
    return null
  }
  return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function POST(req: NextRequest) {
  const supabase = serviceClient()
  if (!supabase) {
    return NextResponse.json({ sent: [] })
  }

  const { jobId, token, senderRole, senderName, body: messageBody } = await req.json()
  if ((!jobId && !token) || !senderRole) {
    return NextResponse.json({ error: 'Missing jobId/token or senderRole' }, { status: 400 })
  }

  let resolvedJobId = jobId
  let driverId: string | null = null
  let organizationId: string | null = null

  if (token) {
    const { data } = await supabase.rpc('get_job_ids_by_token', { p_token: token })
    const row = Array.isArray(data) ? data[0] : data
    if (!row) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    resolvedJobId = row.job_id
    driverId = row.driver_id
    organizationId = row.organization_id
  } else {
    const { data: job } = await supabase
      .from('jobs')
      .select('driver_id, organization_id')
      .eq('id', jobId)
      .single()
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    driverId = job.driver_id
    organizationId = job.organization_id
  }

  const host = req.headers.get('host')
  const protocol = host?.includes('localhost') ? 'http' : 'https'
  const link = `${protocol}://${host}/dashboard/jobs/${resolvedJobId}/track`

  const label = roleLabels[senderRole] ?? 'Someone'
  const excerpt = (messageBody || '').slice(0, 120)
  const text = `${label}${senderName ? ` (${senderName})` : ''} sent a message on your Drivflo job: "${excerpt}" ${link}`

  const results: { to: string; ok: boolean }[] = []

  // Notify the driver, unless they're the one who sent it
  if (senderRole !== 'driver' && driverId) {
    const { data: driver } = await supabase
      .from('profiles')
      .select('phone, sms_notifications_opt_in')
      .eq('id', driverId)
      .single()
    if (driver?.phone && driver.sms_notifications_opt_in !== false) {
      const result = await sendSms(driver.phone, text)
      results.push({ to: driver.phone, ok: result.ok })
    }
  }

  // Notify the dealer's admin(s), unless the message came from that dealership
  if (senderRole !== 'org_admin' && senderRole !== 'org_member' && organizationId) {
    const { data: dealerAdmins } = await supabase
      .from('profiles')
      .select('phone')
      .eq('organization_id', organizationId)
      .eq('role', 'org_admin')
    for (const admin of dealerAdmins ?? []) {
      if (admin.phone) {
        const result = await sendSms(admin.phone, text)
        results.push({ to: admin.phone, ok: result.ok })
      }
    }
  }

  return NextResponse.json({ sent: results })
}
