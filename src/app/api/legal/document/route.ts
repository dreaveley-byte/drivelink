import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Fetches the current version of a legal document by slug — used by
// LegalDocumentModal to render document text on demand.
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug')
  if (!slug) {
    return NextResponse.json({ error: 'Missing slug.' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('legal_documents')
    .select('slug, version, title, body, audience, effective_date')
    .eq('slug', slug)
    .eq('is_current', true)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: 'Document not found.' }, { status: 404 })
  }

  return NextResponse.json({ document: data })
}
