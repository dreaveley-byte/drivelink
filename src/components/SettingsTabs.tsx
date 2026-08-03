'use client'

import { useState, type ReactNode } from 'react'

export default function SettingsTabs({ profile, application }: { profile: ReactNode; application: ReactNode }) {
  const [tab, setTab] = useState<'profile' | 'application'>('profile')

  return (
    <div>
      <div className="flex items-center gap-1 border border-gray-200 rounded-lg p-1 mb-6 w-fit">
        <button
          onClick={() => setTab('profile')}
          className={`text-sm px-3 py-1.5 rounded-md ${tab === 'profile' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:text-gray-900'}`}
        >
          Profile
        </button>
        <button
          onClick={() => setTab('application')}
          className={`text-sm px-3 py-1.5 rounded-md ${tab === 'application' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:text-gray-900'}`}
        >
          Application
        </button>
      </div>
      {tab === 'profile' ? profile : application}
    </div>
  )
}
