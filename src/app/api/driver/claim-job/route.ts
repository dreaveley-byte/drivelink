import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

// Server-side claim. Does the precise schedule check (real drive time from
// the end of the driver's existing job to the new job's pickup, and the other
// way round) and then calls claim_job_if_no_conflict, which re-checks approval,
// licence, documents, capabilities and overlap inside the database transaction.
//
// "Free again" = existing job's scheduled start + its estimated drive time,
// then the drive from its drop-off back to the new job's pickup.

type JobRow = {
  id: string
  scheduled_for: string | null
  estimated_duration_minutes: number | null
  pickup_address: string
  dropoff_address: string
}

async function driveMinutes(origin: string, destination: string, base: string): Promise<number | null> {
  try {
    const res = await fetch(`${base}/api/distance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ addresses: [origin, destination] }),
    })
    const data = await res.json()
    return typeof data?.durationMinutes === 'number' ? data.durationMinutes : null
  } catch {
    return null
  }
}

function fmt(ms: number) {
  return new Date(ms).toLocaleString('en-CA', { timeZone: 'America/Vancouver', weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  const { jobId } = await req.json()
  if (!jobId) return NextResponse.json({ error: 'Missing jobId.' }, { status: 400 })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (url && serviceKey) {
    const admin = createServiceClient(url, serviceKey)
    const { data: job } = await admin
      .from('jobs')
      .select('id, scheduled_for, estimated_duration_minutes, pickup_address, dropoff_address')
      .eq('id', jobId)
      .single<JobRow>()
    const { data: mine } = await admin
      .from('jobs')
      .select('id, scheduled_for, estimated_duration_minutes, pickup_address, dropoff_address')
      .eq('driver_id', user.id)
      .in('status', ['assigned', 'picked_up', 'in_progress', 'delivered'])
      .returns<JobRow[]>()

    if (job && job.scheduled_for && mine && mine.length > 0) {
      const host = req.headers.get('host')
      const base = `${host?.includes('localhost') ? 'http' : 'https'}://${host}`
      const newStart = new Date(job.scheduled_for).getTime()
      const newDriveMs = (job.estimated_duration_minutes ?? 60) * 60000

      for (const e of mine) {
        if (!e.scheduled_for) continue // the database check blocks this case
        const eStart = new Date(e.scheduled_for).getTime()
        const eDriveMs = (e.estimated_duration_minutes ?? 60) * 60000

        if (newStart >= eStart) {
          const travel = await driveMinutes(e.dropoff_address, job.pickup_address, base)
          if (travel != null) {
            const freeAt = eStart + eDriveMs + travel * 60000
            if (newStart < freeAt) {
              return NextResponse.json({
                error: `You can't take this job: your other job is expected to finish around ${fmt(eStart + eDriveMs)}, and getting back to this pickup takes about ${Math.round(travel / 60 * 10) / 10} hours, so you wouldn't be there until ${fmt(freeAt)} - this job starts ${fmt(newStart)}.`,
              }, { status: 409 })
            }
          }
        } else {
          const travel = await driveMinutes(job.dropoff_address, e.pickup_address, base)
          if (travel != null) {
            const freeAt = newStart + newDriveMs + travel * 60000
            if (eStart < freeAt) {
              return NextResponse.json({
                error: `You can't take this job: it would finish around ${fmt(newStart + newDriveMs)}, and getting to your other job's pickup takes about ${Math.round(travel / 60 * 10) / 10} hours, so you wouldn't be there until ${fmt(freeAt)} - your other job starts ${fmt(eStart)}.`,
              }, { status: 409 })
            }
          }
        }
      }
    }
  }

  const { data, error } = await supabase.rpc('claim_job_if_no_conflict', { p_job_id: jobId })
  if (error) return NextResponse.json({ error: error.message }, { status: 409 })
  return NextResponse.json({ ok: true, job: data })
}
