import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOutstandingLegalDocs } from '@/lib/legalGate'

// Lists the legal documents the signed-in user still needs to (re-)accept for
// their application type — used by the /driver/resign and /dashboard/resign
// gating pages.
export async function GET(req: NextRequest) {
  const applicationType = req.nextUrl.searchParams.get('applicationType')
  if (applicationType !== 'driver' && applicationType !== 'dealer') {
    return NextResponse.json({ error: 'Invalid applicationType.' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  }

  const outstanding = await getOutstandingLegalDocs(user.id, applicationType)
  return NextResponse.json({ outstanding })
}
