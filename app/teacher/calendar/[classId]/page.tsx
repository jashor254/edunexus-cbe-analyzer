'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import { Plus, Trash2, Calendar as CalendarIcon, Megaphone, Clock } from 'lucide-react'
import { friendlyMessage } from '@/lib/errors/friendlyMessage'

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

export default function TeacherCalendarPage({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = use(params)
  const [tab, setTab] = useState<Tab>('calendar')
  const [calendar, setCalendar] = useState<CalendarEntry[]>([])
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [showEventForm, setShowEventForm] = useState(false)
  const [eventTitle, setEventTitle] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [eventDescription, setEventDescription] = useState('')
  const [savingEvent, setSavingEvent] = useState(false)

  const [showAnnouncementForm, setShowAnnouncementForm] = useState(false)
  const [announcementTitle, setAnnouncementTitle] = useState('')
  const [announcementBody, setAnnouncementBody] = useState('')
  const [savingAnnouncement, setSavingAnnouncement] = useState(false)

  function load() {
    setLoading(true)
    Promise.all([
      fetch(`/api/teacher/calendar/by-class/${classId}`).then(r => r.json()),
      fetch(`/api/teacher/announcements/by-class/${classId}`).then(r => r.json()),
    ]).then(([c, a]) => {
      if (c.success) setCalendar(c.data.calendar)
      if (a.success) setAnnouncements(a.data.announcements)
    }).finally(() => setLoading(false))
  }

  useEffect(load, [classId])

  async function handleCreateEvent() {
    if (!eventTitle.trim() || !eventDate) return
    setError('')
    setSavingEvent(true)
    try {
      const res = await fetch(`/api/teacher/calendar/by-class/${classId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: eventTitle.trim(), eventDate, description: eventDescription.trim() || undefined }),
      })
      const data = await res.json()
      if (!data.success) { setError(data.error || 'Failed to save'); return }
      setEventTitle(''); setEventDate(''); setEventDescription(''); setShowEventForm(false)
      load()
    } finally {
      setSavingEvent(false)
    }
  }

  async function handleDeleteEvent(id: string) {
    await fetch(`/api/teacher/calendar/${id}`, { method: 'DELETE' })
    setCalendar(prev => prev.filter(e => e.id !== id))
  }

  async function handleCreateAnnouncement() {
    if (!announcementTitle.trim() || !announcementBody.trim()) return
    setError('')
    setSavingAnnouncement(true)
    try {
      const res = await fetch(`/api/teacher/announcements/by-class/${classId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: announcementTitle.trim(), body: announcementBody.trim() }),
      })
      const data = await res.json()
      if (!data.success) { setError(data.error || 'Failed to post'); return }
      setAnnouncementTitle(''); setAnnouncementBody(''); setShowAnnouncementForm(false)
      load()
    } finally {
      setSavingAnnouncement(false)
    }
  }

  async function handleDeleteAnnouncement(id: string) {
    await fetch(`/api/teacher/announcements/${id}`, { method: 'DELETE' })
    setAnnouncements(prev => prev.filter(a => a.id !== id))
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <Link href="/teacher/classes" className="text-sm text-gray-400 hover:text-gray-600 font-medium">
          ← My Classes
        </Link>
        <h1 className="text-3xl font-black text-gray-900 mt-3">Calendar & Announcements</h1>
        <p className="text-gray-500 mt-1">Dates, deadlines, and updates for this class</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-4">
          {friendlyMessage(error).message}
        </div>
      )}

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
        <div className="space-y-4">
          {!showEventForm ? (
            <button
              onClick={() => setShowEventForm(true)}
              className="flex items-center gap-2 bg-teal-600 text-white px-4 py-2.5 rounded-xl font-black text-sm hover:bg-teal-700 transition"
            >
              <Plus className="w-4 h-4" /> New Event
            </button>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
              <input
                value={eventTitle}
                onChange={e => setEventTitle(e.target.value)}
                placeholder="Event title (e.g. CAT 1, School trip)"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 outline-none focus:border-teal-500"
              />
              <input
                type="date"
                value={eventDate}
                onChange={e => setEventDate(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 outline-none focus:border-teal-500"
              />
              <textarea
                value={eventDescription}
                onChange={e => setEventDescription(e.target.value)}
                placeholder="Optional details"
                rows={3}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 outline-none focus:border-teal-500 resize-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleCreateEvent}
                  disabled={savingEvent}
                  className="bg-teal-600 text-white px-4 py-2.5 rounded-xl font-black text-sm hover:bg-teal-700 transition disabled:opacity-60"
                >
                  {savingEvent ? 'Saving...' : 'Add to Calendar'}
                </button>
                <button
                  onClick={() => setShowEventForm(false)}
                  className="px-4 py-2.5 border border-gray-200 rounded-xl font-bold text-sm text-gray-600"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {calendar.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border-2 border-dashed border-gray-200">
              <CalendarIcon className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-bold">No dates yet</p>
            </div>
          ) : (
            calendar.map(entry => (
              <div key={`${entry.kind}-${entry.id}`} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex items-start justify-between gap-3">
                <div>
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
                {entry.kind === 'event' && (
                  <button onClick={() => handleDeleteEvent(entry.id)} className="text-gray-300 hover:text-red-500 transition shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {!showAnnouncementForm ? (
            <button
              onClick={() => setShowAnnouncementForm(true)}
              className="flex items-center gap-2 bg-teal-600 text-white px-4 py-2.5 rounded-xl font-black text-sm hover:bg-teal-700 transition"
            >
              <Plus className="w-4 h-4" /> New Announcement
            </button>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
              <input
                value={announcementTitle}
                onChange={e => setAnnouncementTitle(e.target.value)}
                placeholder="Title"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 outline-none focus:border-teal-500"
              />
              <textarea
                value={announcementBody}
                onChange={e => setAnnouncementBody(e.target.value)}
                placeholder="Write your announcement..."
                rows={4}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 outline-none focus:border-teal-500 resize-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleCreateAnnouncement}
                  disabled={savingAnnouncement}
                  className="bg-teal-600 text-white px-4 py-2.5 rounded-xl font-black text-sm hover:bg-teal-700 transition disabled:opacity-60"
                >
                  {savingAnnouncement ? 'Posting...' : 'Post'}
                </button>
                <button
                  onClick={() => setShowAnnouncementForm(false)}
                  className="px-4 py-2.5 border border-gray-200 rounded-xl font-bold text-sm text-gray-600"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {announcements.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border-2 border-dashed border-gray-200">
              <Megaphone className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-bold">No announcements yet</p>
            </div>
          ) : (
            announcements.map(a => (
              <div key={a.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-black text-gray-900">{a.title}</h3>
                  <button onClick={() => handleDeleteAnnouncement(a.id)} className="text-gray-300 hover:text-red-500 transition shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap mt-2">{a.body}</p>
                <div className="text-xs text-gray-400 mt-2">
                  {new Date(a.created_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
