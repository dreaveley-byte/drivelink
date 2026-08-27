import { sendSms } from './sms'
import type { SupabaseClient } from '@supabase/supabase-js'

// Routine customer SMS shouldn't wake anyone up before a configurable hour
// (default 8am), in the destination's own local time. Proximity-based
// alerts (45/5 minutes away, arrived) are time-critical for the customer
// to actually be ready and should always be passed as exempt=true so they
// bypass this entirely.
//
// There's no reliable cron on this infrastructure to send a queued message
// at exactly the right time, so a message that lands during quiet hours
// gets queued in pending_customer_sms and flushed opportunistically by
// flushPendingCustomerSms() - called from driver-idle-check, which already
// fires frequently off GPS pings while any driver's app is open. This
// means a queued message might send a little late (whenever the next ping
// happens to land after quiet hours end), but never wakes anyone up early.
export async function sendOrQueueCustomerSms(
  supabase: SupabaseClient,
  jobId: string,
  phone: string,
  body: string,
  destinationTimeZone: string | undefined,
  exempt: boolean
): Promise<{ ok: boolean; queued?: boolean; error?: string }> {
  if (exempt) {
    const result = await sendSms(phone, body)
    return result
  }

  const { data: settings } = await supabase.from('pricing_settings').select('quiet_hours_end_hour').eq('id', 1).single()
  const quietHoursEndHour = settings?.quiet_hours_end_hour ?? 8

  const now = new Date()
  const localHour = destinationTimeZone
    ? parseInt(now.toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: destinationTimeZone }), 10)
    : now.getHours()

  if (localHour >= quietHoursEndHour) {
    const result = await sendSms(phone, body)
    return result
  }

  // Queue for the next occurrence of quiet_hours_end_hour in the
  // destination's timezone - since we don't have a clean way to construct
  // an arbitrary-timezone Date directly, approximate using the difference
  // between the local hour and the target hour, applied to the server's
  // own clock (good enough for scheduling a send window, not exact to the
  // second).
  const hoursUntilQuietHoursEnd = quietHoursEndHour - localHour
  const sendAfter = new Date(now.getTime() + hoursUntilQuietHoursEnd * 60 * 60 * 1000)

  const { error } = await supabase.from('pending_customer_sms').insert({
    job_id: jobId,
    phone,
    body,
    send_after: sendAfter.toISOString(),
  })

  if (error) {
    // If queuing itself fails for some reason, better to send late-night
    // than to silently lose the notification entirely.
    const result = await sendSms(phone, body)
    return result
  }

  return { ok: true, queued: true }
}

// Sends any queued messages whose send_after has passed. Called
// opportunistically from driver-idle-check on every GPS ping - cheap to
// check even when there's nothing due.
export async function flushPendingCustomerSms(supabase: SupabaseClient): Promise<void> {
  const { data: due } = await supabase
    .from('pending_customer_sms')
    .select('id, job_id, phone, body')
    .is('sent_at', null)
    .lte('send_after', new Date().toISOString())
    .limit(10)

  if (!due || due.length === 0) return

  for (const msg of due) {
    const { data: claimed } = await supabase
      .from('pending_customer_sms')
      .update({ sent_at: new Date().toISOString() })
      .eq('id', msg.id)
      .is('sent_at', null)
      .select('id')
    if (claimed && claimed.length > 0) {
      await sendSms(msg.phone, msg.body)
      await supabase.from('customer_messages').insert({ job_id: msg.job_id, direction: 'to_customer', body: msg.body })
    }
  }
}
