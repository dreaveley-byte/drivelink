import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: {
        // @supabase/ssr defaults to the PKCE flow, which stores a private
        // verifier in the browser that started the request and requires
        // that same browser/device to complete it - fine for something
        // like an OAuth redirect that stays in one browser tab, but wrong
        // for an emailed confirmation link, which people routinely open
        // on a different device (fill out the form on a computer, open
        // the email on their phone) than the one that started it. The
        // implicit flow carries everything needed in the link itself
        // instead, so it completes correctly no matter which device
        // clicks it - this is what was actually causing 'This link
        // didn't work' even on a freshly sent, immediately-clicked link.
        flowType: 'implicit',
      },
    }
  )
}
