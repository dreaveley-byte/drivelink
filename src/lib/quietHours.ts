import { sendSms } from './sms'
import type { SupabaseClient } from '@supabase/supabase-js'

// Automatic customer texts (arrival time / delay updates) are only sent inside
// a daily window in the DROP-OFF location's local time:
//   start = pricing_settings.quiet_hours_end_hour   (default 8  = 8:00 AM)
//   end   = pricing_settings.sms_window_end_hour    (default 22 = 10:00 PM)
// Anything generated outside it is held in pending_customer_sms and sent when
// the window opens (or earlier if the driver taps "Send now anyway").
// Time-critical proximity / arrived alerts pass exempt=true and always send.
//
// There's no reliable scheduler on this infrastructure, so held messages are
// flushed opportunistically by flushPendingCustomerSms() (called from the
// GPS-ping route). A held message can therefore go a little late, never early.

function localParts(now: Date, timeZone: string | undefined): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: 'numeric', hour12: false, timeZone: timeZone ?? 'America/Vancouver' }).formatToParts(now)
  const hour = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10) % 24
  const minute = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0', 10)
  return { hour, minute }
}

export async function sendOrQueueCustomerSms(
  supabase: SupabaseClient,
  jobId: string,
  phone: string,
  body: string,
  destinationTimeZone: string | undefined,
  exempt: boolean,
  kind: 'eta' | 'delay' | 'other' = 'other'
): Promise<{ ok: boolean; queued?: boolean; sendAfter?: string; error?: string }> {
  if (exempt) {
    return await sendSms(phone, body)
  }

  const { data: settings } = await supabase.from('pricing_settings').select('quiet_hours_end_hour, sms_window_end_hour').eq('id', 1).single()
  const startHour: number = settings?.quiet_hours_end_hour ?? 8
  const endHour: number = settings?.sms_window_end_hour ?? 22

  const now = new Date()
  const { hour, minute } = localParts(now, destinationTimeZone)
  const minutesNow = hour * 60 + minute
  if (minutesNow >= startHour * 60 && minutesNow < endHour * 60) {
    return await sendSms(phone, body)
  }

  // Next window opening (later today if it's before the start, otherwise tomorrow).
  const minutesUntilOpen = minutesNow < startHour * 60 ? startHour * 60 - minutesNow : 24 * 60 - minutesNow + startHour * 60
  const sendAfter = new Date(now.getTime() + minutesUntilOpen * 60000)

  // A newer held message of the same kind replaces any older one for this job,
  // so the customer never gets an outdated text in the morning.
  await supabase
    .from('pending_customer_sms')
    .update({ superseded_at: now.toISOString() })
    .eq('job_id', jobId)
    .eq('kind', kind)
    .is('sent_at', null)
    .is('superseded_at', null)

  const { error } = await supabase.from('pending_customer_sms').insert({
    job_id: jobId,
    phone,
    body,
    kind,
    send_after: sendAfter.toISOString(),
  })

  if (error) {
    // Better to hold nothing and tell the caller than to text at night.
    return { ok: false, error: `Could not hold the message: ${error.message}` }
  }
  return { ok: true, queued: true, sendAfter: sendAfter.toISOString() }
}

// Sends any held messages whose send_after has passed (skipping replaced ones).
export async function flushPendingCustomerSms(supabase: SupabaseClient): Promise<void> {
  const { data: due } = await supabase
    .from('pending_customer_sms')
    .select('id, job_id, phone, body')
    .is('sent_at', null)
    .is('superseded_at', null)
    .lte('send_after', new Date().toISOString())
    .limit(10)

  if (!due || due.length === 0) return

  for (const msg of due) {
    const { data: claimed } = await supabase
      .from('pending_customer_sms')
      .update({ sent_at: new Date().toISOString() })
      .eq('id', msg.id)
      .is('sent_at', null)
      .is('superseded_at', null)
      .select('id')
    if (claimed && claimed.length > 0) {
      await sendSms(msg.phone, msg.body)
      await supabase.from('customer_messages').insert({ job_id: msg.job_id, direction: 'to_customer', body: msg.body })
    }
  }
}
