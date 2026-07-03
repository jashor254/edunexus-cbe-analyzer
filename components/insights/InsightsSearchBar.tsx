'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import Link from 'next/link'
import { Search, X, Clock, Loader2 } from 'lucide-react'
import type { InsightArticleCard } from '@/lib/insights/types'
import { CategoryBadge } from './CategoryBadge'

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

export function InsightsSearchBar() {
  const [query, setQuery]     = useState('')
  const [results, setResults] = useState<InsightArticleCard[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen]       = useState(false)
  const inputRef              = useRef<HTMLInputElement>(null)
  const containerRef          = useRef<HTMLDivElement>(null)
  const debouncedQuery        = useDebounce(query, 300)

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); setOpen(false); return }
    setLoading(true)
    try {
      const res  = await fetch(`/api/insights/search?q=${encodeURIComponent(q)}&limit=6`)
      const json = await res.json() as { results: InsightArticleCard[] }
      setResults(json.results ?? [])
      setOpen(true)
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void search(debouncedQuery) }, [debouncedQuery, search])

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function clear() {
    setQuery('')
    setResults([])
    setOpen(false)
    inputRef.current?.focus()
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-2xl mx-auto">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30 pointer-events-none" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { if (results.length > 0) setOpen(true) }}
          placeholder="Search articles, AI, Career Intelligence, Teacher Academy..."
          className="w-full bg-white/5 border border-white/15 rounded-2xl py-4 pl-12 pr-12 text-white placeholder-white/30 text-base focus:outline-none focus:border-violet-500/50 focus:bg-white/8 transition-all"
          aria-label="Search EduNexus Insights"
          aria-expanded={open}
          aria-haspopup="listbox"
          role="combobox"
          autoComplete="off"
        />
        {loading && (
          <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 animate-spin" />
        )}
        {query && !loading && (
          <button
            onClick={clear}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 hover:text-white/60 transition-colors"
            aria-label="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {open && results.length > 0 && (
        <div
          role="listbox"
          className="absolute top-full left-0 right-0 mt-2 bg-[#111] border border-white/10 rounded-2xl overflow-hidden shadow-2xl z-50"
        >
          {results.map((article) => (
            <Link
              key={article.id}
              href={`/insights/${article.slug}`}
              role="option"
              aria-selected="false"
              onClick={() => { setOpen(false); setQuery('') }}
              className="flex items-start gap-4 px-5 py-4 hover:bg-white/5 border-b border-white/5 last:border-0 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <CategoryBadge name={article.category.name} color={article.category.color} />
                </div>
                <p className="text-sm font-semibold text-white/90 line-clamp-1">{article.title}</p>
                {article.excerpt && (
                  <p className="text-xs text-white/40 mt-0.5 line-clamp-1">{article.excerpt}</p>
                )}
              </div>
              <span className="flex items-center gap-1 text-[11px] text-white/30 shrink-0 mt-0.5">
                <Clock className="w-3 h-3" />
                {article.reading_time}m
              </span>
            </Link>
          ))}

          <div className="px-5 py-2.5 border-t border-white/8">
            <p className="text-[11px] text-white/25">
              {results.length} result{results.length !== 1 ? 's' : ''} for &ldquo;{query}&rdquo;
            </p>
          </div>
        </div>
      )}

      {open && query.trim() && !loading && results.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-[#111] border border-white/10 rounded-2xl px-5 py-4 shadow-2xl z-50">
          <p className="text-sm text-white/40">No results for &ldquo;{query}&rdquo;</p>
        </div>
      )}
    </div>
  )
}
