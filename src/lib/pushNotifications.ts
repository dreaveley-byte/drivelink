import jwt from 'jsonwebtoken'
import http2 from 'http2'
import { createClient as createServiceClient } from '@supabase/supabase-js'

// Sends real push notifications via Apple's Push Notification service (APNs)
// - these work even with the app closed or the phone locked, unlike an
// in-app-only alert. Requires three secrets from the Apple Developer
// account (an APNs Auth Key): APNS_KEY_ID, APNS_TEAM_ID, and the private
// key contents itself in APNS_PRIVATE_KEY.
//
// APNs tokens are short-lived and reusable for up to an hour, so this
// caches the signed JWT rather than re-signing on every single send.
let cachedToken: { token: string; expiresAt: number } | null = null

function getApnsAuthToken(): string | null {
  const keyId = process.env.APNS_KEY_ID
  const teamId = process.env.APNS_TEAM_ID
  const privateKey = process.env.APNS_PRIVATE_KEY
  if (!keyId || !teamId || !privateKey) return null

  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token
  }

  const token = jwt.sign({ iss: teamId, iat: Math.floor(Date.now() / 1000) }, privateKey.replace(/\\n/g, '\n'), {
    algorithm: 'ES256',
    header: { alg: 'ES256', kid: keyId },
  })
  cachedToken = { token, expiresAt: Date.now() + 55 * 60 * 1000 }
  return token
}

// Sends a single push to one iOS device token. APNs wants one HTTP/2
// request per device - there's no batch-send endpoint - so callers should
// fire these concurrently (e.g. via Promise.allSettled) for multiple
// drivers rather than awaiting them one at a time.
export async function sendApnsPush(
  deviceToken: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<{ ok: boolean; error?: string }> {
  const authToken = getApnsAuthToken()
  const bundleId = process.env.APNS_BUNDLE_ID || 'com.carbyclick.drivflo.driver'
  if (!authToken) {
    return { ok: false, error: 'not_configured' }
  }

  // Production APNs host - use api.sandbox.push.apple.com instead when
  // testing against a debug/development-signed build.
  const apnsHost = process.env.APNS_USE_SANDBOX === 'true' ? 'api.sandbox.push.apple.com' : 'api.push.apple.com'

  return new Promise((resolve) => {
    const client = http2.connect(`https://${apnsHost}`)
    client.on('error', (err) => {
      resolve({ ok: false, error: err.message })
    })

    const payload = JSON.stringify({
      aps: { alert: { title, body }, sound: 'default' },
      ...data,
    })

    const req = client.request({
      ':method': 'POST',
      ':path': `/3/device/${deviceToken}`,
      authorization: `bearer ${authToken}`,
      'apns-topic': bundleId,
      'apns-push-type': 'alert',
      'content-type': 'application/json',
    })

    let responseBody = ''
    let status = 0
    req.on('response', (headers) => {
      status = Number(headers[':status'])
    })
    req.on('data', (chunk) => {
      responseBody += chunk
    })
    req.on('end', () => {
      client.close()
      if (status === 200) {
        resolve({ ok: true })
      } else {
        resolve({ ok: false, error: `APNs status ${status}: ${responseBody}` })
      }
    })
    req.on('error', (err) => {
      client.close()
      resolve({ ok: false, error: err.message })
    })
    req.end(payload)
  })
}

// ---------- Android (Firebase Cloud Messaging, HTTP v1) ----------
// Needs a Firebase service account in FCM_SERVICE_ACCOUNT_JSON (the whole JSON
// file contents). The Android app itself also has to be built with Firebase
// set up (google-services.json) before it will hand out push tokens - until
// then no Android tokens exist and this simply never fires.
let cachedFcmToken: { token: string; expiresAt: number } | null = null

async function getFcmAccessToken(): Promise<{ token: string; projectId: string } | null> {
  const raw = process.env.FCM_SERVICE_ACCOUNT_JSON
  if (!raw) return null
  let account: { client_email: string; private_key: string; project_id: string }
  try {
    account = JSON.parse(raw)
  } catch {
    return null
  }
  if (cachedFcmToken && cachedFcmToken.expiresAt > Date.now() + 60_000) {
    return { token: cachedFcmToken.token, projectId: account.project_id }
  }
  const now = Math.floor(Date.now() / 1000)
  const assertion = jwt.sign(
    { iss: account.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3300 },
    account.private_key,
    { algorithm: 'RS256' }
  )
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  })
  const data = await res.json()
  if (!data.access_token) return null
  cachedFcmToken = { token: data.access_token, expiresAt: Date.now() + 3300 * 1000 }
  return { token: data.access_token, projectId: account.project_id }
}

export async function sendFcmPush(
  deviceToken: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<{ ok: boolean; error?: string }> {
  const auth = await getFcmAccessToken()
  if (!auth) return { ok: false, error: 'not_configured' }
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${auth.projectId}/messages:send`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: { token: deviceToken, notification: { title, body }, data: data ?? {}, android: { priority: 'HIGH' } },
    }),
  })
  if (!res.ok) return { ok: false, error: `FCM status ${res.status}: ${await res.text()}` }
  return { ok: true }
}

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createServiceClient(url, key)
}

// Records an in-app notification for each driver AND sends a mobile push
// (iOS via APNs, Android via FCM) to every device they have registered.
export async function notifyDrivers(
  driverIds: string[],
  note: { kind: 'new_job' | 'message' | 'customer_sms'; title: string; body: string; jobId?: string }
): Promise<void> {
  const supabase = serviceClient()
  if (!supabase || driverIds.length === 0) return

  await supabase.from('driver_notifications').insert(
    driverIds.map((driver_id) => ({ driver_id, kind: note.kind, title: note.title, body: note.body, job_id: note.jobId ?? null }))
  )

  const { data: tokens } = await supabase
    .from('driver_push_tokens')
    .select('device_token, platform')
    .in('driver_id', driverIds)
  const data: Record<string, string> = { kind: note.kind }
  if (note.jobId) data.jobId = note.jobId
  await Promise.allSettled(
    (tokens ?? []).map((t: { device_token: string; platform: string }) =>
      t.platform === 'ios'
        ? sendApnsPush(t.device_token, note.title, note.body, data)
        : sendFcmPush(t.device_token, note.title, note.body, data)
    )
  )
}

// A new job: only drivers who can actually take it (active, approved, valid
// licence and documents, qualified, no schedule clash) are notified.
export async function notifyDriversOfNewJob(jobId: string, jobSummary: string): Promise<void> {
  const supabase = serviceClient()
  if (!supabase) return
  const { data: rows } = await supabase.rpc('get_eligible_driver_ids_for_job', { p_job_id: jobId })
  const ids = (rows ?? []).map((r: { driver_id: string }) => r.driver_id)
  await notifyDrivers(ids, { kind: 'new_job', title: 'New job available', body: jobSummary, jobId })
}
