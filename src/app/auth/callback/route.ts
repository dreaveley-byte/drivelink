import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// This app uses @supabase/ssr, which uses the PKCE flow for email links
// (confirmation, magic link, etc.) rather than the older implicit
// hash-fragment flow. PKCE links arrive with a `?code=` query param that
// has to be explicitly exchanged for a real session server-side - the
// browser client's automatic session detection does NOT do this on its
// own, so without this route, clicking a confirmation email link would
// land someone on the destination page still logged out, with a `code`
// in the URL that nothing ever did anything with.
export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=confirmation_failed`)
}
