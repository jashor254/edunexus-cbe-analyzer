'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import { Upload, Plus, Trash2, Download, Paperclip } from 'lucide-react'
import { friendlyMessage } from '@/lib/errors/friendlyMessage'

interface ResourceItem {
  id: string
  title: string
  file_name: string
  created_at: string
}

interface MaterialItem {
  id: string
  title: string
  body: string
  link_url: string | null
  created_at: string
}

type Tab = 'materials' | 'files'

export default function TeacherResourcesPage({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = use(params)
  const [tab, setTab] = useState<Tab>('materials')
  const [resources, setResources] = useState<ResourceItem[]>([])
  const [materials, setMaterials] = useState<MaterialItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Upload form state
  const [file, setFile] = useState<File | null>(null)
  const [fileTitle, setFileTitle] = useState('')
  const [uploading, setUploading] = useState(false)

  // Material form state
  const [showMaterialForm, setShowMaterialForm] = useState(false)
  const [materialTitle, setMaterialTitle] = useState('')
  const [materialBody, setMaterialBody] = useState('')
  const [materialLink, setMaterialLink] = useState('')
  const [savingMaterial, setSavingMaterial] = useState(false)

  function load() {
    setLoading(true)
    Promise.all([
      fetch(`/api/teacher/resources/${classId}`).then(r => r.json()),
      fetch(`/api/teacher/materials/${classId}`).then(r => r.json()),
    ]).then(([r, m]) => {
      if (r.success) setResources(r.data.resources)
      if (m.success) setMaterials(m.data.materials)
    }).finally(() => setLoading(false))
  }

  useEffect(load, [classId])

  async function handleUpload() {
    if (!file || !fileTitle.trim()) return
    setError('')
    setUploading(true)
    try {
      const form = new FormData()
      form.set('title', fileTitle.trim())
      form.set('file', file)
      const res = await fetch(`/api/teacher/resources/${classId}`, { method: 'POST', body: form })
      const data = await res.json()
      if (!data.success) { setError(data.error || 'Upload failed'); return }
      setFile(null)
      setFileTitle('')
      load()
    } finally {
      setUploading(false)
    }
  }

  async function handleDeleteResource(id: string) {
    await fetch(`/api/teacher/resources/${id}`, { method: 'DELETE' })
    setResources(prev => prev.filter(r => r.id !== id))
  }

  async function handleDownload(id: string) {
    const res = await fetch(`/api/resources/${id}/file-url`)
    const data = await res.json()
    if (data.success) window.open(data.data.url, '_blank')
  }

  async function handleCreateMaterial() {
    if (!materialTitle.trim() || !materialBody.trim()) return
    setError('')
    setSavingMaterial(true)
    try {
      const res = await fetch(`/api/teacher/materials/${classId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: materialTitle.trim(),
          body: materialBody.trim(),
          linkUrl: materialLink.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!data.success) { setError(data.error || 'Failed to save'); return }
      setMaterialTitle(''); setMaterialBody(''); setMaterialLink(''); setShowMaterialForm(false)
      load()
    } finally {
      setSavingMaterial(false)
    }
  }

  async function handleDeleteMaterial(id: string) {
    await fetch(`/api/teacher/materials/${id}`, { method: 'DELETE' })
    setMaterials(prev => prev.filter(m => m.id !== id))
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <Link href="/teacher/classes" className="text-sm text-gray-400 hover:text-gray-600 font-medium">
          ← My Classes
        </Link>
        <h1 className="text-3xl font-black text-gray-900 mt-3">Class Resources</h1>
        <p className="text-gray-500 mt-1">Share notes and files with your students</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-4">
          {friendlyMessage(error).message}
        </div>
      )}

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
        <div className="space-y-4">
          {!showMaterialForm ? (
            <button
              onClick={() => setShowMaterialForm(true)}
              className="flex items-center gap-2 bg-teal-600 text-white px-4 py-2.5 rounded-xl font-black text-sm hover:bg-teal-700 transition"
            >
              <Plus className="w-4 h-4" /> New Note
            </button>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
              <input
                value={materialTitle}
                onChange={e => setMaterialTitle(e.target.value)}
                placeholder="Title"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 outline-none focus:border-teal-500"
              />
              <textarea
                value={materialBody}
                onChange={e => setMaterialBody(e.target.value)}
                placeholder="Write your notes here..."
                rows={5}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 outline-none focus:border-teal-500 resize-none"
              />
              <input
                value={materialLink}
                onChange={e => setMaterialLink(e.target.value)}
                placeholder="Optional link (https://...)"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 outline-none focus:border-teal-500"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleCreateMaterial}
                  disabled={savingMaterial}
                  className="bg-teal-600 text-white px-4 py-2.5 rounded-xl font-black text-sm hover:bg-teal-700 transition disabled:opacity-60"
                >
                  {savingMaterial ? 'Saving...' : 'Publish'}
                </button>
                <button
                  onClick={() => setShowMaterialForm(false)}
                  className="px-4 py-2.5 border border-gray-200 rounded-xl font-bold text-sm text-gray-600"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {materials.map(m => (
            <div key={m.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-black text-gray-900">{m.title}</h3>
                <button onClick={() => handleDeleteMaterial(m.id)} className="text-gray-300 hover:text-red-500 transition shrink-0">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <p className="text-sm text-gray-700 whitespace-pre-wrap mt-2">{m.body}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
            <input
              value={fileTitle}
              onChange={e => setFileTitle(e.target.value)}
              placeholder="File title"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 outline-none focus:border-teal-500"
            />
            <label className="flex items-center gap-2 px-4 py-3 rounded-xl border border-dashed border-gray-300 text-sm text-gray-500 cursor-pointer hover:border-teal-400 hover:text-teal-600 transition">
              <Paperclip className="w-4 h-4" />
              {file ? file.name : 'Choose a file (max 10MB)'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                className="hidden"
                onChange={e => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
            <button
              onClick={handleUpload}
              disabled={uploading || !file || !fileTitle.trim()}
              className="flex items-center gap-2 bg-teal-600 text-white px-4 py-2.5 rounded-xl font-black text-sm hover:bg-teal-700 transition disabled:opacity-60"
            >
              <Upload className="w-4 h-4" /> {uploading ? 'Uploading...' : 'Upload'}
            </button>
          </div>

          {resources.map(r => (
            <div key={r.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-black text-gray-900 truncate">{r.title}</div>
                <div className="text-xs text-gray-400 truncate">{r.file_name}</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleDownload(r.id)}
                  className="text-xs font-black text-teal-700 bg-teal-50 border border-teal-200 px-3 py-2 rounded-xl hover:bg-teal-100 transition flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" /> View
                </button>
                <button onClick={() => handleDeleteResource(r.id)} className="text-gray-300 hover:text-red-500 transition">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
