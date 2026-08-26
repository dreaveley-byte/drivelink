import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ResignFlow from '@/components/ResignFlow'

export const dynamic = 'force-dynamic'

export default async function DealerResignPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role, organization_id').eq('id', user.id).single()
  if (profile?.role !== 'org_admin' && profile?.role !== 'org_member') redirect('/dashboard')
  if (!profile.organization_id) redirect('/dashboard')

  return <ResignFlow applicationType="dealer" redirectTo="/dashboard" />
}
