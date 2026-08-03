// Shared helper for sending a text via Twilio. Returns silently (does nothing)
// if Twilio isn't configured yet, so callers can fire-and-forget without
// needing to check configuration themselves.
export async function sendSms(to: string, body: string): Promise<{ ok: boolean; error?: string }> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const fromNumber = process.env.TWILIO_FROM_NUMBER

  if (!accountSid || !authToken || !fromNumber) {
    return { ok: false, error: 'not_configured' }
  }

  const digits = to.replace(/\D/g, '')
  let toNumber: string
  if (to.trim().startsWith('+')) {
    toNumber = to.trim()
  } else if (digits.length === 10) {
    toNumber = `+1${digits}`
  } else if (digits.length === 11 && digits.startsWith('1')) {
    toNumber = `+${digits}`
  } else {
    return { ok: false, error: 'invalid_number' }
  }

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ To: toNumber, From: fromNumber, Body: body }),
  })

  if (!res.ok) {
    const detail = await res.text()
    console.error('Twilio send failed:', detail)
    return { ok: false, error: detail }
  }

  return { ok: true }
}
