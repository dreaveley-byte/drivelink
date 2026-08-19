import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Admin-only: saves an edit to a legal document as a brand new version and
// flips is_current, leaving prior versions in history untouched.
export async function POST(req: NextRequest) {
  const { slug, title, body, audience, effectiveDate } = await req.json()
  if (!slug || !title || !body || !audience) {
    return NextResponse.json({ error: 'Missing slug, title, body or audience.' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'platform_admin') {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  const { data: current } = await supabase
    .from('legal_documents')
    .select('version')
    .eq('slug', slug)
    .eq('is_current', true)
    .maybeSingle()

  const nextVersion = (current?.version ?? 0) + 1

  // Demote the current version first so the "one current per slug" partial
  // unique index never sees two current rows for the same slug at once.
  if (current) {
    const { error: demoteError } = await supabase
      .from('legal_documents')
      .update({ is_current: false })
      .eq('slug', slug)
      .eq('is_current', true)
    if (demoteError) {
      return NextResponse.json({ error: demoteError.message }, { status: 500 })
    }
  }

  const { data: inserted, error: insertError } = await supabase
    .from('legal_documents')
    .insert({
      slug,
      version: nextVersion,
      title,
      body,
      audience,
      is_current: true,
      effective_date: effectiveDate || new Date().toISOString().slice(0, 10),
    })
    .select('*')
    .single()

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({ document: inserted })
}
