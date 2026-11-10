'use client'

import { useState } from 'react'

// Red/amber notice with an X. Dismissal only hides it until the next time the
// page is opened - it is deliberately NOT stored anywhere, so it reappears every
// time the driver opens the app, and dismissing never affects any deadline.
export default function DismissibleBanner({
  title,
  children,
  dismissible = true,
}: {
  title: string
  children: React.ReactNode
  dismissible?: boolean
}) {
  const [hidden, setHidden] = useState(false)
  if (hidden) return null
  return (
    <div role="alert" className="relative border-2 border-red-300 bg-red-50 rounded-xl px-4 py-3 pr-10">
      <p className="text-sm font-semibold text-red-800">{title}</p>
      <div className="text-sm text-red-700 mt-1">{children}</div>
      {dismissible && (
        <button
          type="button"
          onClick={() => setHidden(true)}
          aria-label="Dismiss"
          className="absolute top-2 right-2 w-7 h-7 rounded-full text-red-700 hover:bg-red-100 text-lg leading-none"
        >
          ×
        </button>
      )}
    </div>
  )
}
