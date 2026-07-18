'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import { Plus, Trash2, Save } from 'lucide-react'
import { friendlyMessage } from '@/lib/errors/friendlyMessage'

interface DraftQuestion {
  questionText: string
  choices: string[]
  correctIndex: number
}

function emptyQuestion(): DraftQuestion {
  return { questionText: '', choices: ['', ''], correctIndex: 0 }
}

export default function QuizBuilderPage({ params }: { params: Promise<{ assignmentId: string }> }) {
  const { assignmentId } = use(params)
  const [questions, setQuestions] = useState<DraftQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch(`/api/teacher/assignments/${assignmentId}/questions`)
      .then(r => r.json())
      .then(d => {
        if (d.success && d.data.questions.length > 0) {
          setQuestions(d.data.questions.map((q: { question_text: string; choices: string[]; correct_index: number }) => ({
            questionText: q.question_text, choices: q.choices, correctIndex: q.correct_index,
          })))
        } else {
          setQuestions([emptyQuestion()])
        }
      })
      .finally(() => setLoading(false))
  }, [assignmentId])

  function updateQuestion(index: number, patch: Partial<DraftQuestion>) {
    setQuestions(prev => prev.map((q, i) => (i === index ? { ...q, ...patch } : q)))
  }

  function updateChoice(qIndex: number, cIndex: number, value: string) {
    setQuestions(prev => prev.map((q, i) => {
      if (i !== qIndex) return q
      const choices = [...q.choices]
      choices[cIndex] = value
      return { ...q, choices }
    }))
  }

  function addChoice(qIndex: number) {
    setQuestions(prev => prev.map((q, i) => (i === qIndex && q.choices.length < 6 ? { ...q, choices: [...q.choices, ''] } : q)))
  }

  function removeChoice(qIndex: number, cIndex: number) {
    setQuestions(prev => prev.map((q, i) => {
      if (i !== qIndex || q.choices.length <= 2) return q
      const choices = q.choices.filter((_, idx) => idx !== cIndex)
      const correctIndex = q.correctIndex >= choices.length ? 0 : q.correctIndex
      return { ...q, choices, correctIndex }
    }))
  }

  function addQuestion() {
    setQuestions(prev => [...prev, emptyQuestion()])
  }

  function removeQuestion(index: number) {
    setQuestions(prev => prev.filter((_, i) => i !== index))
  }

  async function handleSave() {
    setError('')
    setSaved(false)

    const cleaned = questions
      .map(q => ({ ...q, questionText: q.questionText.trim(), choices: q.choices.map(c => c.trim()) }))
      .filter(q => q.questionText && q.choices.every(c => c))

    if (cleaned.length === 0) {
      setError('Add at least one question with all choices filled in.')
      return
    }

    setSaving(true)
    try {
      const res = await fetch(`/api/teacher/assignments/${assignmentId}/questions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questions: cleaned }),
      })
      const data = await res.json()
      if (!data.success) { setError(data.error || 'Failed to save'); return }
      setSaved(true)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <span className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <Link href={`/teacher/assignments/${assignmentId}`} className="text-sm text-gray-400 hover:text-gray-600 font-medium">
          ← Back to Assignment
        </Link>
        <h1 className="text-3xl font-black text-gray-900 mt-3">Quiz Questions</h1>
        <p className="text-gray-500 mt-1">Multiple choice — students get their score instantly, no marking needed</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-4">
          {friendlyMessage(error).message}
        </div>
      )}
      {saved && (
        <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl px-4 py-3 text-sm mb-4 font-bold">
          Saved — students will see this question set.
        </div>
      )}

      <div className="space-y-4 mb-6">
        {questions.map((q, qIndex) => (
          <div key={qIndex} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-start justify-between gap-3 mb-3">
              <span className="text-xs font-black text-gray-400">QUESTION {qIndex + 1}</span>
              {questions.length > 1 && (
                <button onClick={() => removeQuestion(qIndex)} className="text-gray-300 hover:text-red-500 transition">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            <textarea
              value={q.questionText}
              onChange={e => updateQuestion(qIndex, { questionText: e.target.value })}
              placeholder="Type the question..."
              rows={2}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 outline-none focus:border-teal-500 resize-none mb-3"
            />

            <div className="space-y-2">
              {q.choices.map((choice, cIndex) => (
                <div key={cIndex} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`correct-${qIndex}`}
                    checked={q.correctIndex === cIndex}
                    onChange={() => updateQuestion(qIndex, { correctIndex: cIndex })}
                    className="w-4 h-4 accent-teal-600 shrink-0"
                    title="Mark as correct answer"
                  />
                  <input
                    value={choice}
                    onChange={e => updateChoice(qIndex, cIndex, e.target.value)}
                    placeholder={`Choice ${String.fromCharCode(65 + cIndex)}`}
                    className="flex-1 px-3 py-2 rounded-xl border border-gray-200 outline-none focus:border-teal-500 text-sm"
                  />
                  {q.choices.length > 2 && (
                    <button onClick={() => removeChoice(qIndex, cIndex)} className="text-gray-300 hover:text-red-500 transition shrink-0">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {q.choices.length < 6 && (
              <button
                onClick={() => addChoice(qIndex)}
                className="mt-2 text-xs font-bold text-teal-700 hover:text-teal-800 transition"
              >
                + Add choice
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <button
          onClick={addQuestion}
          className="flex items-center gap-2 border border-gray-200 text-gray-700 bg-gray-50 px-4 py-2.5 rounded-xl font-black text-sm hover:bg-gray-100 transition"
        >
          <Plus className="w-4 h-4" /> Add Question
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-teal-600 text-white px-4 py-2.5 rounded-xl font-black text-sm hover:bg-teal-700 transition disabled:opacity-60"
        >
          {saving
            ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            : <><Save className="w-4 h-4" /> Save Quiz</>
          }
        </button>
      </div>
    </div>
  )
}
