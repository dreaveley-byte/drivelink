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

  const [faceCheck, licenseCheck] = await Promise.all([
    validatePhoto(facePhoto, 'face'),
    validatePhoto(licensePhoto, 'license'),
  ])

  if (!faceCheck.ok) {
    return NextResponse.json({ error: `Face photo: ${faceCheck.reason}. Please retake it.`, retake: 'face' }, { status: 422 })
  }
  if (!licenseCheck.ok) {
    return NextResponse.json({ error: `ID photo: ${licenseCheck.reason}. Please retake it.`, retake: 'license' }, { status: 422 })
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

  return NextResponse.json({ ok: true })
}

