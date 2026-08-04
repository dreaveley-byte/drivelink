type SortableJob = {
  status: string
  scheduled_for: string | null
  updated_at?: string | null
}

const FINISHED_STATUSES = ['completed', 'cancelled']

// Active jobs always sort above finished ones, regardless of date — an old
// active job scheduled last week shouldn't be buried under jobs completed
// yesterday. Within each group: active jobs follow the requested date sort
// (soonest/latest first), finished jobs always show most-recently-updated first.
export function sortJobsActiveFirst<T extends SortableJob>(jobs: T[], ascending: boolean): T[] {
  return [...jobs].sort((a, b) => {
    const aActive = !FINISHED_STATUSES.includes(a.status)
    const bActive = !FINISHED_STATUSES.includes(b.status)
    if (aActive !== bActive) return aActive ? -1 : 1

    if (aActive) {
      const aTime = a.scheduled_for ? new Date(a.scheduled_for).getTime() : Infinity
      const bTime = b.scheduled_for ? new Date(b.scheduled_for).getTime() : Infinity
      return ascending ? aTime - bTime : bTime - aTime
    }

    const aTime = a.updated_at ? new Date(a.updated_at).getTime() : 0
    const bTime = b.updated_at ? new Date(b.updated_at).getTime() : 0
    return bTime - aTime
  })
}
