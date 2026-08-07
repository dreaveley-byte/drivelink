import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

// For anything that's just a database read/write, we use the same anon-key +
// security-definer-RPC approach that the page-load step already uses successfully
// — proven to work without needing the service role key at all. The service role
// client below is reserved for the one thing that genuinely has no SQL equivalent:
// uploading the actual photo files to a private storage bucket.
function anonClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  )
}

function storageClient() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('SUPABASE_SERVICE_ROLE_KEY is not set — ID verification photo uploads cannot work without it.')
  }
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function validatePhoto(base64DataUrl: string, kind: 'face' | 'license'): Promise<{ ok: boolean; reason?: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    // No AI validation configured — accept the photo rather than block the
    // whole flow, but this should be set up for real quality enforcement.
    return { ok: true }
  }

  const match = base64DataUrl.match(/^data:(image\/\w+);base64,(.+)$/)
  if (!match) return { ok: false, reason: 'Invalid image data.' }
  const [, mediaType, base64Data] = match

  const prompt =
    kind === 'face'
      ? 'This should be a clear, well-lit photo of a single person\'s face, unobstructed, looking at the camera. Reply with ONLY "OK" if it clearly meets that description. Otherwise reply with ONLY a short reason (under 12 words) why it does not (e.g. "too dark", "face not visible", "no person visible", "blurry").'
      : 'This should be a clear, in-focus photo of a government-issued photo ID or driver\'s license, with the photo and text legible. Reply with ONLY "OK" if it clearly meets that description. Otherwise reply with ONLY a short reason (under 12 words) why it does not (e.g. "too blurry to read", "no ID visible", "glare obscuring text", "not a government ID").'

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 50,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Data } },
              { type: 'text', text: prompt },
            ],
          },
        ],
      }),
    })
    const data = await res.json()
    const text = data.content?.[0]?.text?.trim() ?? ''
    if (text.toUpperCase().startsWith('OK')) return { ok: true }
    return { ok: false, reason: text || 'Photo quality check failed.' }
  } catch (e) {
    console.error('ID verification vision check failed:', e)
    // Fail open rather than blocking a real customer over an infra hiccup.
    return { ok: true }
  }
}

// Cross-checks the face photo against the person pictured on the ID, and the
// name printed on the ID against who the delivery is actually for. Only
// rejects on a confident mismatch — genuinely uncertain cases (odd angle,
// glare, a legal middle name left off, etc.) pass through rather than
// blocking a real customer over an AI false-negative.
async function validateIdentityMatch(
  faceDataUrl: string,
  licenseDataUrl: string,
  expectedName: string | null
): Promise<{ ok: boolean; reason?: string; retakeTarget?: 'face' | 'license'; notes: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return { ok: true, notes: 'AI identity check not configured (no ANTHROPIC_API_KEY).' }

  const faceMatch = faceDataUrl.match(/^data:(image\/\w+);base64,(.+)$/)
  const licenseMatch = licenseDataUrl.match(/^data:(image\/\w+);base64,(.+)$/)
  if (!faceMatch || !licenseMatch) return { ok: true, notes: 'Could not parse images for identity check.' }

  const prompt =
    `Image 1 is a photo of a person's face. Image 2 is a photo of a government ID or driver's license.\n\n` +
    `1) Does the face in Image 1 appear to be the same person as the photo on the ID in Image 2?\n` +
    `2) What full name is printed on the ID in Image 2?\n` +
    (expectedName
      ? `3) Does that name reasonably match "${expectedName}" (allow for minor formatting differences, middle names/initials, or common nicknames — only flag a real mismatch)?\n`
      : '') +
    `\nReply in EXACTLY this format, nothing else:\n` +
    `FACE_MATCH: yes|no|unclear\n` +
    `ID_NAME: <name printed on the ID, or "unreadable">\n` +
    `NAME_MATCH: yes|no|unclear|n/a\n` +
    `REASON: <short reason if either is "no", otherwise "ok">`

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 150,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: faceMatch[1], data: faceMatch[2] } },
              { type: 'image', source: { type: 'base64', media_type: licenseMatch[1], data: licenseMatch[2] } },
              { type: 'text', text: prompt },
            ],
          },
        ],
      }),
    })
    const data = await res.json()
    const text: string = data.content?.[0]?.text?.trim() ?? ''

    const faceMatchResult = /FACE_MATCH:\s*(yes|no|unclear)/i.exec(text)?.[1]?.toLowerCase()
    const nameMatchResult = /NAME_MATCH:\s*(yes|no|unclear|n\/a)/i.exec(text)?.[1]?.toLowerCase()
    const reason = /REASON:\s*(.+)/i.exec(text)?.[1]?.trim()

    if (faceMatchResult === 'no') {
      return { ok: false, reason: `The face photo doesn't appear to match the person on the ID${reason && reason !== 'ok' ? ` (${reason})` : ''}.`, retakeTarget: 'face', notes: text }
    }
    if (nameMatchResult === 'no') {
      return { ok: false, reason: `The name on the ID doesn't appear to match the delivery recipient${reason && reason !== 'ok' ? ` (${reason})` : ''}.`, retakeTarget: 'license', notes: text }
    }
    return { ok: true, notes: text }
  } catch (e) {
    console.error('ID verification identity match check failed:', e)
    return { ok: true, notes: 'Identity match check failed to run (infra error) — accepted without it.' }
  }
}

function base64ToBuffer(dataUrl: string): Buffer {
  const base64 = dataUrl.split(',')[1] ?? ''
  return Buffer.from(base64, 'base64')
}

export async function POST(req: NextRequest) {
  const { token, facePhoto, licensePhoto } = await req.json()
  if (!token || !facePhoto || !licensePhoto) {
    return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
  }

  const supabase = anonClient()

  const { data: infoData, error: lookupError } = await supabase.rpc('get_verification_info', { p_token: token })
  const job = Array.isArray(infoData) ? infoData[0] : infoData

  if (!job) {
    console.error(`ID verification lookup failed for token ${token}:`, lookupError)
    return NextResponse.json({ error: 'This verification link is invalid or has expired.' }, { status: 404 })
  }
  if (job.id_verification_completed_at) {
    return NextResponse.json({ error: 'This delivery has already been verified.' }, { status: 409 })
  }

  // After 2 failed AI attempts, stop asking the customer to keep retaking photos
  // — hand it off to the driver to confirm the ID in person instead.
  async function registerFailureAndCheckOverride(reason: string, retake: 'face' | 'license') {
    const { data: failureCount } = await supabase.rpc('increment_id_verification_failures', { p_token: token })
    if ((failureCount ?? 0) >= 2) {
      return NextResponse.json(
        {
          error: 'We\u2019re having trouble verifying this automatically. Your driver will confirm your ID in person instead.',
          manualOverrideRequired: true,
        },
        { status: 422 }
      )
    }
    return NextResponse.json({ error: `${reason} Please retake.`, retake }, { status: 422 })
  }

  const [faceCheck, licenseCheck] = await Promise.all([
    validatePhoto(facePhoto, 'face'),
    validatePhoto(licensePhoto, 'license'),
  ])

  if (!faceCheck.ok) {
    return await registerFailureAndCheckOverride(`Face photo: ${faceCheck.reason}.`, 'face')
  }
  if (!licenseCheck.ok) {
    return await registerFailureAndCheckOverride(`ID photo: ${licenseCheck.reason}.`, 'license')
  }

  const identityCheck = await validateIdentityMatch(facePhoto, licensePhoto, job.customer_full_name)
  if (!identityCheck.ok) {
    return await registerFailureAndCheckOverride(identityCheck.reason ?? 'Identity check failed.', identityCheck.retakeTarget ?? 'face')
  }

  const facePath = `${job.job_id}/id-verification-face-${Date.now()}.jpg`
  const licensePath = `${job.job_id}/id-verification-license-${Date.now()}.jpg`

  const storage = storageClient()
  const [faceUpload, licenseUpload] = await Promise.all([
    storage.storage.from('id-verification').upload(facePath, base64ToBuffer(facePhoto), { contentType: 'image/jpeg' }),
    storage.storage.from('id-verification').upload(licensePath, base64ToBuffer(licensePhoto), { contentType: 'image/jpeg' }),
  ])

  if (faceUpload.error || licenseUpload.error) {
    console.error('ID verification upload failed:', faceUpload.error, licenseUpload.error)
    return NextResponse.json({ error: 'Could not save your photos. Please try again.' }, { status: 500 })
  }

  const { data: submitOk, error: submitError } = await supabase.rpc('submit_id_verification', {
    p_token: token,
    p_face_path: facePath,
    p_license_path: licensePath,
  })

  if (submitError || !submitOk) {
    console.error('ID verification submit failed:', submitError)
    return NextResponse.json({ error: 'Could not complete verification. Please try again.' }, { status: 500 })
  }

  await supabase.from('jobs').update({ id_verification_match_notes: identityCheck.notes }).eq('id_verification_token', token)

  // Let the dealer know verification is done, through the job's own chat thread
  // (which also triggers their normal SMS chat notification) rather than a
  // separate one-off text — keeps everything about this delivery in one place.
  try {
    const host = req.headers.get('host')
    const protocol = host?.includes('localhost') ? 'http' : 'https'
    const vehicleDesc = [job.vehicle_year, job.vehicle_make, job.vehicle_model].filter(Boolean).join(' ')
    const { data: settings } = await supabase.from('pricing_settings').select('id_verification_approval_wait_minutes').eq('id', 1).single()
    const waitMinutes = settings?.id_verification_approval_wait_minutes ?? 5
    const chatBody =
      `✅ ${job.customer_full_name || 'The customer'}'s identity has been verified for the ${vehicleDesc || 'vehicle'} delivery. ` +
      `Please approve within ${waitMinutes} minutes — after that the driver will proceed automatically. Review: ${protocol}://${host}/dashboard/jobs/${job.job_id}/receipt`

    await supabase.rpc('post_id_verification_chat_message', { p_token: token, p_body: chatBody })

    // Reuse the existing chat SMS notifier so the dealer gets the same
    // notification experience as any other message on this job.
    await fetch(`${protocol}://${host}/api/job-chat/notify-sms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId: job.job_id, senderRole: 'platform_admin', senderName: 'Drivflo', body: chatBody }),
    })
  } catch (e) {
    console.error('Dealer chat notification failed (verification still succeeded):', e)
  }

  return NextResponse.json({ ok: true })
}

