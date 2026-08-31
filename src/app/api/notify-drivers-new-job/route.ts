import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { notifyDriversOfNewJob } from '@/lib/pushNotifications'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  }

  const { jobId } = await req.json()
  if (!jobId) {
    return NextResponse.json({ error: 'Missing jobId.' }, { status: 400 })
  }

  // RLS already restricts this to a job the calling user can actually see.
  const { data: job } = await supabase
    .from('jobs')
    .select('pickup_address, dropoff_address, vehicle_year, vehicle_make, vehicle_model, job_types(name)')
    .eq('id', jobId)
    .single()

  if (!job) {
    return NextResponse.json({ error: 'Job not found.' }, { status: 404 })
  }

  const jobTypeName = Array.isArray(job.job_types) ? job.job_types[0]?.name : (job.job_types as { name: string } | null)?.name
  const vehicleDesc = [job.vehicle_year, job.vehicle_make, job.vehicle_model].filter(Boolean).join(' ')
  const summary = vehicleDesc
    ? `${vehicleDesc} - ${job.pickup_address} to ${job.dropoff_address}`
    : `${jobTypeName || 'New job'} - ${job.pickup_address} to ${job.dropoff_address}`

  await notifyDriversOfNewJob(summary)

  return NextResponse.json({ ok: true })
}
