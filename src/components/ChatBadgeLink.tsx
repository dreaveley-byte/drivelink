import Link from 'next/link'

export default function ChatBadgeLink({ jobId, unread }: { jobId: string; unread: boolean }) {
  return (
    <Link
      href={`/dashboard/jobs/${jobId}/track`}
      target="_blank"
      title={unread ? 'New message' : 'Chat'}
      className={`inline-flex items-center gap-1 text-xs ${unread ? 'text-[#378ADD] font-medium' : 'text-gray-400'}`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill={unread ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-4 h-4"
      >
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
      </svg>
      {unread ? 'New message' : 'Chat'}
    </Link>
  )
}
