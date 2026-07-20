'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Calendar as CalendarIcon, Megaphone, Clock } from 'lucide-react'

interface CalendarEntry {
  id: string
  kind: 'event' | 'assignment_due'
  title: string
  description: string | null
  date: string
}

interface AnnouncementItem {
  id: string
  title: string
  body: string
  created_at: string
}

type Tab = 'calendar' | 'announcements'

export default function StudentCalendarPage() {
  const [tab, setTab] = useState<Tab>('calendar')
  const [calendar, setCalendar] = useState<CalendarEntry[]>([])
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/student/calendar').then(r => r.json()),
      fetch('/api/student/announcements').then(r => r.json()),
    ]).then(([c, a]) => {
      if (c.success) setCalendar(c.data.calendar)
      if (a.success) setAnnouncements(a.data.announcements)
    }).finally(() => setLoading(false))
  }, [])

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <Link href="/student" className="text-sm text-gray-400 hover:text-gray-600 font-medium">
          ← Home
        </Link>
        <h1 className="text-3xl font-black text-gray-900 mt-3">Calendar & Announcements</h1>
        <p className="text-gray-500 mt-1">Dates, deadlines, and updates from your teacher</p>
      </div>

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setTab('calendar')}
          className={`px-4 py-2 rounded-xl font-bold text-sm transition ${tab === 'calendar' ? 'bg-teal-600 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}
        >
          Calendar ({calendar.length})
        </button>
        <button
          onClick={() => setTab('announcements')}
          className={`px-4 py-2 rounded-xl font-bold text-sm transition ${tab === 'announcements' ? 'bg-teal-600 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}
        >
          Announcements ({announcements.length})
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <span className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : tab === 'calendar' ? (
        calendar.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border-2 border-dashed border-gray-200">
            <CalendarIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-black text-gray-600">No dates yet</h3>
          </div>
        ) : (
          <div className="space-y-3">
            {calendar.map(entry => (
              <div key={`${entry.kind}-${entry.id}`} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
                <div className="text-xs text-gray-400 font-bold mb-0.5">
                  {new Date(entry.date).toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short' })}
                </div>
                <div className="font-black text-gray-900">{entry.title}</div>
                {entry.description && <p className="text-sm text-gray-600 mt-1">{entry.description}</p>}
                {entry.kind === 'assignment_due' && (
                  <span className="inline-flex items-center gap-1 mt-1.5 text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg">
                    <Clock className="w-3 h-3" /> Assignment due date
                  </span>
                )}
              </div>
            ))}
          </div>
        )
      ) : announcements.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border-2 border-dashed border-gray-200">
          <Megaphone className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-black text-gray-600">No announcements yet</h3>
        </div>
      ) : (
        <div className="space-y-4">
          {announcements.map(a => (
            <div key={a.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
              <h3 className="font-black text-gray-900">{a.title}</h3>
              <p className="text-sm text-gray-700 whitespace-pre-wrap mt-2">{a.body}</p>
              <div className="text-xs text-gray-400 mt-2">
                {new Date(a.created_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
