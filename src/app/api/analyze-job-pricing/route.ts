import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

// Job types that use simple_job_hourly_rate_cents instead of hourly_rate_cents -
// mirrors the exact logic in post-job/page.tsx's useSimpleJobRates determination.
const SIMPLE_RATE_JOB_TYPES = ['Courier / Package', 'Parts Delivery', 'Parts Pickup', 'Paperwork Signing', 'Customer Pick Up', 'Customer Drop Off']

// Only ever these two fields are ever suggested - both are pure hourly
// pay rates, never a safety/compliance setting. Enforced here in code, not
// left to the AI's own judgment about what's "safe" to touch.
const ALLOWED_FIELDS = ['hourly_rate_cents', 'simple_job_hourly_rate_cents'] as const

const MIN_SIMILAR_JOBS = 3
const MIN_VARIANCE_PERCENT = 15
// Never suggest more than a 15% change from the current rate in one go,
// regardless of how large the observed variance is - keeps any single
// suggestion from swinging pricing wildly even if the underlying pattern
// is extreme.
const MAX_SUGGESTED_CHANGE_PERCENT = 15

export async function POST(req: NextRequest) {
  const { jobId } = await req.json()
  if (!jobId) {
    return NextResponse.json({ error: 'Missing jobId.' }, { status: 400 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ ok: false, error: 'not_configured' }, { status: 501 })
  }
  const supabase = createServiceClient(supabaseUrl, serviceRoleKey)

  const { data: job } = await supabase
    .from('jobs')
    .select('id, job_type_id, estimated_distance_km, driver_paid_hours, actual_driver_hours, job_types(name)')
    .eq('id', jobId)
    .single()

  if (!job || job.driver_paid_hours == null || job.actual_driver_hours == null || job.estimated_distance_km == null) {
    // Nothing to analyze yet - not every job has both figures on record
    // (e.g. older jobs, or a job with no distance data).
    return NextResponse.json({ ok: true, suggestion: null })
  }

  const jobTypeName = Array.isArray(job.job_types) ? job.job_types[0]?.name : (job.job_types as { name: string } | null)?.name
  const useSimpleRate = SIMPLE_RATE_JOB_TYPES.includes(jobTypeName ?? '')
  const fieldName: (typeof ALLOWED_FIELDS)[number] = useSimpleRate ? 'simple_job_hourly_rate_cents' : 'hourly_rate_cents'

  // Similar = same job type, distance within 25% of this job's, both
  // hours figures on record, completed within the last 90 days - a real,
  // recent pattern rather than one outlier or ancient data.
  const distanceLow = job.estimated_distance_km * 0.75
  const distanceHigh = job.estimated_distance_km * 1.25
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()

  const { data: similarJobs } = await supabase
    .from('jobs')
    .select('id, driver_paid_hours, actual_driver_hours')
    .eq('job_type_id', job.job_type_id)
    .eq('status', 'completed')
    .not('driver_paid_hours', 'is', null)
    .not('actual_driver_hours', 'is', null)
    .gte('estimated_distance_km', distanceLow)
    .lte('estimated_distance_km', distanceHigh)
    .gte('updated_at', ninetyDaysAgo)

  if (!similarJobs || similarJobs.length < MIN_SIMILAR_JOBS) {
    return NextResponse.json({ ok: true, suggestion: null, reason: 'not_enough_similar_jobs' })
  }

  const variances = similarJobs
    .filter((j) => j.driver_paid_hours > 0)
    .map((j) => ((j.actual_driver_hours - j.driver_paid_hours) / j.driver_paid_hours) * 100)
  const avgVariancePercent = variances.reduce((sum, v) => sum + v, 0) / variances.length

  // Require a consistent direction, not just a large average masking
  // jobs that cancel each other out.
  const sameDirectionCount = variances.filter((v) => Math.sign(v) === Math.sign(avgVariancePercent)).length
  const isConsistent = sameDirectionCount / variances.length >= 0.7

  if (Math.abs(avgVariancePercent) < MIN_VARIANCE_PERCENT || !isConsistent) {
    return NextResponse.json({ ok: true, suggestion: null, reason: 'variance_not_significant_or_consistent' })
  }

  // Don't create a duplicate suggestion if there's already a pending one
  // for this exact field.
  const { data: existingPending } = await supabase
    .from('pricing_suggestions')
    .select('id')
    .eq('field_name', fieldName)
    .eq('status', 'pending')
    .limit(1)
    .maybeSingle()
  if (existingPending) {
    return NextResponse.json({ ok: true, suggestion: null, reason: 'pending_suggestion_already_exists' })
  }

  const { data: settings } = await supabase.from('pricing_settings').select(fieldName).eq('id', 1).single()
  const currentValueCents = (settings as unknown as Record<string, number>)?.[fieldName]
  if (currentValueCents == null) {
    return NextResponse.json({ ok: true, suggestion: null })
  }

  // Cap the suggested change regardless of how large the observed
  // variance is - a capped, conservative nudge in the right direction,
  // not a swing sized to fully close the gap in one step.
  const cappedChangePercent = Math.sign(avgVariancePercent) * Math.min(Math.abs(avgVariancePercent), MAX_SUGGESTED_CHANGE_PERCENT)
  const suggestedValueCents = Math.round(currentValueCents * (1 + cappedChangePercent / 100))

  const apiKey = process.env.ANTHROPIC_API_KEY
  let analysisSummary = `Across ${similarJobs.length} similar ${jobTypeName ?? 'job'} jobs in the last 90 days, actual driver hours ran ${avgVariancePercent > 0 ? 'over' : 'under'} booked hours by an average of ${Math.abs(avgVariancePercent).toFixed(0)}%. Suggesting a conservative ${Math.abs(cappedChangePercent).toFixed(0)}% ${cappedChangePercent > 0 ? 'increase' : 'decrease'} to keep driver pay fair and competitive for this type of route.`

  if (apiKey) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 200,
          messages: [
            {
              role: 'user',
              content:
                `A vehicle delivery platform is analyzing pricing accuracy. For "${jobTypeName}" jobs around ${job.estimated_distance_km.toFixed(0)}km, ` +
                `across ${similarJobs.length} recent completed jobs, actual driver hours ran ${avgVariancePercent > 0 ? 'over' : 'under'} the booked/estimated hours by an average of ${Math.abs(avgVariancePercent).toFixed(0)}%. ` +
                `We're proposing a conservative, capped ${Math.abs(cappedChangePercent).toFixed(0)}% ${cappedChangePercent > 0 ? 'increase' : 'decrease'} to the driver hourly rate for this job type to keep pay fair and stay competitive with other delivery services. ` +
                `Write a 2-3 sentence plain-English explanation of this finding and why the suggested change makes sense, for a non-technical small business owner to read. No markdown, no headers, just plain sentences.`,
            },
          ],
        }),
      })
      const data = await res.json()
      const text: string = data?.content?.[0]?.text
      if (text) analysisSummary = text.trim()
    } catch {
      // Fall back to the plain-computed summary above if the AI call fails.
    }
  }

  const { data: suggestion, error } = await supabase
    .from('pricing_suggestions')
    .insert({
      triggering_job_id: jobId,
      title: `${jobTypeName ?? 'Job'} rate ${cappedChangePercent > 0 ? 'may be too low' : 'may be too high'} for ~${job.estimated_distance_km.toFixed(0)}km routes`,
      analysis_summary: analysisSummary,
      field_name: fieldName,
      current_value: currentValueCents,
      suggested_value: suggestedValueCents,
      similar_jobs_count: similarJobs.length,
      avg_variance_percent: avgVariancePercent,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, suggestion })
}
