import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Runs daily (see vercel.json). Removes the stored photos/videos/signatures
// and customer ID photos for drives completed more than 2 years ago - the
// end of Drivflo's archive period. Nothing else is touched: the job record,
// pricing, and expense receipts (accounting records) all stay.
//
// Because this deletes files, it is deliberately conservative:
//   - refuses to run unless CRON_SECRET is set AND the request carries it
//   - only considers completed jobs older than the cutoff
//   - only ever lists/deletes inside a folder named after a job's own id,
//     and refuses to proceed with anything that isn't a plain UUID (an
//     empty prefix would list the whole bucket)
//   - handles a few jobs per run, and only marks a job as purged once every
//     file in it was removed without error - a failure just means it's
//     retried the next day

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const ARCHIVE_YEARS = 2
const JOBS_PER_RUN = 10
const BUCKETS = ['job-media', 'id-verification'] as const
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// storage.list only returns one folder level at a time, and "folders" come
// back without an id - so walk down until every file is collected.
async function listAllFiles(supabase: SupabaseClient, bucket: string, prefix: string): Promise<string[]> {
  if (!UUID.test(prefix)) throw new Error(`Refusing to list a non-job prefix: "${prefix}"`)
  const files: string[] = []
  const folders = [prefix]
  while (folders.length > 0) {
    const dir = folders.pop() as string
    for (let offset = 0; ; offset += 100) {
      const { data, error } = await supabase.storage.from(bucket).list(dir, { limit: 100, offset })
      if (error) throw error
      if (!data || data.length === 0) break
      for (const entry of data) {
        const full = `${dir}/${entry.name}`
        if (entry.id) files.push(full)
        else folders.push(full)
      }
      if (data.length < 100) break
    }
  }
  return files
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET is not set, so this is disabled.' }, { status: 503 })
  }
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY is not set.' }, { status: 503 })
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })

  const cutoff = new Date()
  cutoff.setFullYear(cutoff.getFullYear() - ARCHIVE_YEARS)

  const { data: jobs, error: jobsError } = await supabase
    .from('jobs')
    .select('id')
    .eq('status', 'completed')
    .is('media_purged_at', null)
    .not('completed_at', 'is', null)
    .lt('completed_at', cutoff.toISOString())
    .order('completed_at', { ascending: true })
    .limit(JOBS_PER_RUN)

  if (jobsError) {
    // Most likely the retention migration hasn't been run yet. Nothing deleted.
    return NextResponse.json({ error: jobsError.message }, { status: 500 })
  }

  const purged: { jobId: string; filesRemoved: number }[] = []
  const failed: { jobId: string; error: string }[] = []

  for (const job of jobs ?? []) {
    try {
      let removed = 0
      for (const bucket of BUCKETS) {
        const paths = (await listAllFiles(supabase, bucket, job.id)).filter((p) => p.startsWith(`${job.id}/`))
        for (let i = 0; i < paths.length; i += 100) {
          const chunk = paths.slice(i, i + 100)
          const { error } = await supabase.storage.from(bucket).remove(chunk)
          if (error) throw error
          removed += chunk.length
        }
      }
      // The extra-photo rows point at files that no longer exist.
      await supabase.from('job_admin_photos').delete().eq('job_id', job.id)
      const { error: markError } = await supabase
        .from('jobs')
        .update({ media_purged_at: new Date().toISOString() })
        .eq('id', job.id)
      if (markError) throw markError
      purged.push({ jobId: job.id, filesRemoved: removed })
    } catch (e) {
      failed.push({ jobId: job.id, error: e instanceof Error ? e.message : String(e) })
    }
  }

  return NextResponse.json({ cutoff: cutoff.toISOString(), checked: jobs?.length ?? 0, purged, failed })
}
