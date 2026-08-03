import type { SupabaseClient } from '@supabase/supabase-js'

// Returns a Set of job IDs that have at least one chat message the given
// user hasn't read yet (i.e. sent by someone else, after their last read time).
export async function getUnreadJobChatSet(
  supabase: SupabaseClient,
  userId: string,
  jobIds: string[]
): Promise<Set<string>> {
  if (jobIds.length === 0) return new Set()

  const [{ data: reads }, { data: messages }] = await Promise.all([
    supabase.from('job_chat_reads').select('job_id, last_read_at').eq('user_id', userId).in('job_id', jobIds),
    supabase.from('job_messages').select('job_id, sender_id, created_at').in('job_id', jobIds).neq('sender_id', userId),
  ])

  const readMap = new Map<string, string>()
  reads?.forEach((r) => readMap.set(r.job_id, r.last_read_at))

  const unread = new Set<string>()
  messages?.forEach((m) => {
    const lastRead = readMap.get(m.job_id)
    if (!lastRead || new Date(m.created_at) > new Date(lastRead)) {
      unread.add(m.job_id)
    }
  })
  return unread
}
