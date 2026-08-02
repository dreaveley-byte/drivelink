'use client'

import { useRouter } from 'next/navigation'

export default function CloseButton() {
  const router = useRouter()

  function handleClose() {
    window.close()
    // If the tab wasn't opened by script (window.close() has no effect), fall back to going back.
    setTimeout(() => router.back(), 100)
  }

  return (
    <button onClick={handleClose} className="text-sm text-gray-500 hover:text-gray-900">
      Close
    </button>
  )
}
