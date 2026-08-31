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

// Notifies every active driver that a new job is available - called after a
// job is posted with status 'awaiting_driver'. Uses the service-role client
// since this runs server-side and needs to read every driver's push token,
// not just the calling user's own.
export async function notifyDriversOfNewJob(jobSummary: string): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) return

  const supabase = createServiceClient(supabaseUrl, serviceRoleKey)
  const { data: tokens } = await supabase.rpc('get_active_driver_push_tokens')
  if (!tokens || tokens.length === 0) return

  await Promise.allSettled(
    tokens
      .filter((t: { platform: string }) => t.platform === 'ios')
      .map((t: { device_token: string }) => sendApnsPush(t.device_token, 'New job available', jobSummary))
  )
}
