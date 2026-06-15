'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { FileText, PlusCircle, ChevronRight, Clock, CheckCircle2, XCircle } from 'lucide-react'

function statusBadge(status: string) {
  if (status === 'active') return 'bg-green-100 text-green-700'
  if (status === 'closed') return 'bg-gray-100 text-gray-600'
  return 'bg-amber-100 text-amber-700'
}

function statusIcon(status: string) {
  if (status === 'active') return <CheckCircle2 className="w-3.5 h-3.5" />
  if (status === 'closed') return <XCircle className="w-3.5 h-3.5" />
  return <Clock className="w-3.5 h-3.5" />
}

interface Assignment {
  id: string
  title: string
  subject: string
  topic: string
  type: string
  status: string
  due_date: string
  total_students: number
  submitted_count: number
  teacher_classes: { name: string; grade: number } | null
}

export default function AssignmentsPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'active' | 'closed' | 'draft'>('all')

  useEffect(() => {
    fetch('/api/teacher/assignments')
      .then(r => r.json())
      .then(d => { if (d.success) setAssignments(d.data.assignments) })
      .finally(() => setLoading(false))
  }, [])

  const filtered = filter === 'all'
    ? assignments
    : assignments.filter(a => a.status === filter)

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900">Assignments</h1>
          <p className="text-gray-500 mt-1">Create and manage assignments for your classes</p>
        </div>
        <Link
          href="/teacher/assignments/new"
          className="flex items-center justify-center gap-2 bg-teal-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-teal-700 transition shadow-sm self-start"
        >
          <PlusCircle className="w-4 h-4" /> New Assignment
        </Link>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto">
        {(['all', 'active', 'draft', 'closed'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl font-bold text-sm capitalize whitespace-nowrap transition ${
              filter === f
                ? 'bg-teal-600 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {f === 'all' ? `All (${assignments.length})` : `${f} (${assignments.filter(a => a.status === f).length})`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <span className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border-2 border-dashed border-gray-200">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-black text-gray-600 mb-2">
            {filter === 'all' ? 'No assignments yet' : `No ${filter} assignments`}
          </h3>
          {filter === 'all' && (
            <>
              <p className="text-gray-400 mb-6">Create your first assignment for your class</p>
              <Link
                href="/teacher/assignments/new"
                className="inline-flex items-center gap-2 bg-teal-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-teal-700 transition"
              >
                <PlusCircle className="w-4 h-4" /> Create Assignment
              </Link>
            </>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">

          {/* Mobile card list */}
          <div className="sm:hidden divide-y divide-gray-100">
            {filtered.map((a) => {
              const due = new Date(a.due_date)
              const daysLeft = Math.ceil((due.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
              const submissionPct = a.total_students > 0
                ? Math.round((a.submitted_count / a.total_students) * 100)
                : 0
              return (
                <div key={a.id} className="p-4">
                  <div className="flex items-start justify-between mb-2 gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-gray-900 text-sm leading-tight">{a.title}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{a.subject} · {a.topic}</div>
                    </div>
                    <span className={`shrink-0 inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-lg capitalize ${statusBadge(a.status)}`}>
                      {statusIcon(a.status)} {a.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500 mb-3 flex-wrap">
                    {a.teacher_classes && (
                      <span className="font-medium">{a.teacher_classes.name} · G{a.teacher_classes.grade}</span>
                    )}
                    <span className="text-gray-300">·</span>
                    <span className={daysLeft < 0 ? 'text-red-500 font-semibold' : daysLeft <= 2 ? 'text-amber-500 font-semibold' : ''}>
                      Due {due.toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })}
                      {a.status === 'active' && (daysLeft < 0 ? ' · Overdue' : ` · ${daysLeft}d left`)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 flex-1">
                      <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                        <div className="h-1.5 rounded-full bg-teal-500" style={{ width: `${submissionPct}%` }} />
                      </div>
                      <span className="text-xs text-gray-500 font-bold whitespace-nowrap">{a.submitted_count}/{a.total_students}</span>
                    </div>
                    <Link
                      href={`/teacher/assignments/${a.id}`}
                      className="text-teal-600 hover:text-teal-800 font-bold text-xs flex items-center gap-0.5 shrink-0"
                    >
                      View <ChevronRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-black text-gray-500 uppercase">Assignment</th>
                <th className="text-left px-5 py-3 text-xs font-black text-gray-500 uppercase hidden md:table-cell">Class</th>
                <th className="text-left px-5 py-3 text-xs font-black text-gray-500 uppercase hidden md:table-cell">Type</th>
                <th className="text-left px-5 py-3 text-xs font-black text-gray-500 uppercase">Due</th>
                <th className="text-left px-5 py-3 text-xs font-black text-gray-500 uppercase">Progress</th>
                <th className="text-left px-5 py-3 text-xs font-black text-gray-500 uppercase">Status</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((a) => {
                const due = new Date(a.due_date)
                const daysLeft = Math.ceil((due.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                const submissionPct = a.total_students > 0
                  ? Math.round((a.submitted_count / a.total_students) * 100)
                  : 0

                return (
                  <tr key={a.id} className="hover:bg-gray-50 transition">
                    <td className="px-5 py-4">
                      <div className="font-bold text-gray-900">{a.title}</div>
                      <div className="text-xs text-gray-400">{a.subject} · {a.topic}</div>
                    </td>
                    <td className="px-5 py-4 hidden md:table-cell">
                      <span className="text-sm text-gray-600">
                        {a.teacher_classes?.name || '—'} (G{a.teacher_classes?.grade})
                      </span>
                    </td>
                    <td className="px-5 py-4 hidden md:table-cell">
                      <span className="text-xs font-bold capitalize text-gray-600 bg-gray-100 px-2 py-1 rounded-lg">
                        {a.type}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="text-sm text-gray-600">
                        {due.toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })}
                      </div>
                      {a.status === 'active' && (
                        <div className={`text-xs font-bold ${daysLeft < 0 ? 'text-red-500' : daysLeft <= 2 ? 'text-amber-500' : 'text-gray-400'}`}>
                          {daysLeft < 0 ? 'Overdue' : `${daysLeft}d left`}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2 min-w-[100px]">
                        <div className="flex-1 bg-gray-100 rounded-full h-2">
                          <div
                            className="h-2 rounded-full bg-teal-500"
                            style={{ width: `${submissionPct}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500 font-bold">
                          {a.submitted_count}/{a.total_students}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg capitalize ${statusBadge(a.status)}`}>
                        {statusIcon(a.status)} {a.status}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <Link
                        href={`/teacher/assignments/${a.id}`}
                        className="text-teal-600 hover:text-teal-800 font-bold text-sm flex items-center gap-1"
                      >
                        View <ChevronRight className="w-4 h-4" />
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  )
}
