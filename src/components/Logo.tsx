'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

type LogoProps = {
  variant?: 'primary' | 'white' | 'mono-black'
  height?: number
  className?: string
}

const SRC: Record<string, string> = {
  primary: '/brand/drivflo-logo-primary.svg',
  white: '/brand/drivflo-logo-white.svg',
  'mono-black': '/brand/drivflo-logo-mono-black.svg',
}

// Every logged-in page uses this same Logo - clicking it should always take
// you back to your own dashboard, without every individual page needing to
// know or pass in what that is. Driver pages go to /driver, dealer pages to
// /dashboard, admin pages to /admin; public/pre-login pages (login, verify
// links, driver profile shares, etc.) go to the public homepage instead,
// since there's no logged-in dashboard to return to from those.
function dashboardHrefFor(pathname: string): string {
  if (pathname.startsWith('/admin')) return '/admin'
  if (pathname.startsWith('/dashboard')) return '/dashboard'
  if (pathname.startsWith('/driver') && !pathname.startsWith('/driver-profile')) return '/driver'
  return '/'
}

export default function Logo({ variant = 'primary', height = 24, className = '' }: LogoProps) {
  const pathname = usePathname()
  const href = dashboardHrefFor(pathname ?? '/')

  return (
    <Link href={href} aria-label="Back to dashboard">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={SRC[variant]}
        alt="Drivflo"
        style={{ height, width: 'auto' }}
        className={className}
      />
    </Link>
  )
}
