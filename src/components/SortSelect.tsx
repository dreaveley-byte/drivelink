'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'

export default function SortSelect() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const current = searchParams.get('sort') ?? 'soonest'

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('sort', e.target.value)
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <select
      value={current}
      onChange={handleChange}
      className="text-xs border border-gray-300 rounded-lg px-2 py-1.5 text-gray-600"
    >
      <option value="soonest">Delivery date: soonest first</option>
      <option value="latest">Delivery date: latest first</option>
    </select>
  )
}
