'use client'

import { useState } from 'react'
import AdminProfileEditForm from '@/components/AdminProfileEditForm'

export default function AdminProfileEditToggle({
  userId,
  initialFullName,
  initialPhone,
  initialGender,
}: {
  userId: string
  initialFullName: string
  initialPhone: string
  initialGender?: string | null
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button onClick={() => setOpen((v) => !v)} className="text-xs text-blue-600 hover:underline">
        {open ? 'Close' : 'Edit profile'}
      </button>
      {open && (
        <div className="w-full mt-2">
          <AdminProfileEditForm
            userId={userId}
            initialFullName={initialFullName}
            initialPhone={initialPhone}
            initialGender={initialGender}
          />
        </div>
      )}
    </>
  )
}
