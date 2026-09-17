// Mirrors sendSms's pattern: a thin, direct fetch to the provider's REST API,
// no SDK needed. This is deliberately separate from Supabase Auth's own
// built-in email (used for signup confirmation) - this is for custom,
// application-triggered emails Supabase's auth system has no concept of,
// like "your application was approved."
export async function sendEmail(to: string, subject: string, html: string): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.error('RESEND_API_KEY is not set — this email was not sent:', subject, 'to', to)
    return { ok: false, error: 'Email is not configured.' }
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Drivflo <noreply@drivflo.ca>',
        to,
        subject,
        html,
      }),
    })
    if (!res.ok) {
      const body = await res.text()
      console.error('Resend email send failed:', res.status, body)
      return { ok: false, error: `Resend returned ${res.status}` }
    }
    return { ok: true }
  } catch (err) {
    console.error('Resend email send threw:', err)
    return { ok: false, error: 'Could not reach the email service.' }
  }
}
