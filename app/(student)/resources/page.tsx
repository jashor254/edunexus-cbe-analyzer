'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { FileText, Download, BookOpen, ExternalLink } from 'lucide-react'

interface ResourceItem {
  id: string
  title: string
  file_name: string
  file_type: string
  created_at: string
  teacher_classes: { name: string; subject: string } | null
}

interface MaterialItem {
  id: string
  title: string
  body: string
  link_url: string | null
  created_at: string
  teacher_classes: { name: string; subject: string } | null
}

type Tab = 'materials' | 'files'

export default function StudentResourcesPage() {
  const [tab, setTab] = useState<Tab>('materials')
  const [resources, setResources] = useState<ResourceItem[]>([])
  const [materials, setMaterials] = useState<MaterialItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/student/resources').then(r => r.json()),
      fetch('/api/student/materials').then(r => r.json()),
    ]).then(([r, m]) => {
      if (r.success) setResources(r.data.resources)
      if (m.success) setMaterials(m.data.materials)
    }).finally(() => setLoading(false))
  }, [])

  async function handleDownload(id: string) {
    const res = await fetch(`/api/resources/${id}/file-url`)
    const data = await res.json()
    if (data.success) window.open(data.data.url, '_blank')
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <Link href="/student" className="text-sm text-gray-400 hover:text-gray-600 font-medium">
          ← Home
        </Link>
        <h1 className="text-3xl font-black text-gray-900 mt-3">Class Resources</h1>
        <p className="text-gray-500 mt-1">Notes and files your teacher has shared</p>
      </div>

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setTab('materials')}
          className={`px-4 py-2 rounded-xl font-bold text-sm transition ${tab === 'materials' ? 'bg-teal-600 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}
        >
          Notes ({materials.length})
        </button>
        <button
          onClick={() => setTab('files')}
          className={`px-4 py-2 rounded-xl font-bold text-sm transition ${tab === 'files' ? 'bg-teal-600 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}
        >
          Files ({resources.length})
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <span className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : tab === 'materials' ? (
        materials.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border-2 border-dashed border-gray-200">
            <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-black text-gray-600">No notes yet</h3>
          </div>
        ) : (
          <div className="space-y-4">
            {materials.map(m => (
              <div key={m.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                <div className="text-xs text-gray-400 mb-1">
                  {m.teacher_classes?.subject} · {m.teacher_classes?.name}
                </div>
                <h3 className="font-black text-gray-900 mb-2">{m.title}</h3>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{m.body}</p>
                {m.link_url && (
                  <a
                    href={m.link_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 mt-3 text-xs font-black text-teal-700"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Open link
                  </a>
                )}
              </div>
            ))}
          </div>
        )
      ) : resources.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border-2 border-dashed border-gray-200">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-black text-gray-600">No files yet</h3>
        </div>
      ) : (
        <div className="space-y-3">
          {resources.map(r => (
            <div key={r.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs text-gray-400 mb-0.5">
                  {r.teacher_classes?.subject} · {r.teacher_classes?.name}
                </div>
                <div className="font-black text-gray-900 truncate">{r.title}</div>
                <div className="text-xs text-gray-400 truncate">{r.file_name}</div>
              </div>
              <button
                onClick={() => handleDownload(r.id)}
                className="shrink-0 flex items-center gap-1.5 text-xs font-black text-teal-700 bg-teal-50 border border-teal-200 px-3 py-2 rounded-xl hover:bg-teal-100 transition"
              >
                <Download className="w-3.5 h-3.5" /> Download
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
