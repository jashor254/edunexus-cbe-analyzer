'use client'

import { useState, useCallback, useRef } from 'react'
import { Search, Sparkles, AlertCircle, X } from 'lucide-react'
import { CareerCard } from './CareerCard'

// ✅ Client-side cache - same session = no repeat API calls
const searchCache = new Map<string, { data: any; timestamp: number }>()
const CACHE_TTL = 30 * 60 * 1000 // 30 minutes

export function CareerSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rateLimited, setRateLimited] = useState(false)

  const debounceRef = useRef<NodeJS.Timeout | undefined>(undefined)

  const handleSearch = useCallback(async () => {
    const trimmedQuery = query.trim()
    if (!trimmedQuery) return

    // ✅ Check client-side cache first
    const cacheKey = trimmedQuery.toLowerCase()
    const cached = searchCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      setResults(cached.data)
      return
    }

    setLoading(true)
    setError(null)
    setRateLimited(false)

    try {
      const response = await fetch(
        `/api/careers/search?name=${encodeURIComponent(trimmedQuery)}`
      )

      if (response.status === 429) {
        setRateLimited(true)
        setError('Too many searches. Please wait before trying again.')
        return
      }

      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`)
      }

      const data = await response.json()

      // ✅ Cache result
      searchCache.set(cacheKey, { data, timestamp: Date.now() })
      setResults(data)

    } catch (err: any) {
      console.error('Search error:', err)
      setError('Search failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [query])

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(handleSearch, 300)
    }
  }

  const handleClear = () => {
    setQuery('')
    setResults(null)
    setError(null)
    setRateLimited(false)
  }

  return (
    <div className="max-w-3xl mx-auto p-6">

      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-black text-slate-900 mb-2">
          🔍 Career Explorer
        </h2>
        <p className="text-slate-600">
          Search any career — even ones not in our database!
          Our AI will research it for you.
        </p>
      </div>

      {/* Search Input */}
      <div className="flex gap-2 mb-6">
        <div className="relative flex-1">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Try: Blockchain Developer, UX Designer, Data Scientist..."
            className="w-full px-4 py-3 pr-10 border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-semibold"
            disabled={loading || rateLimited}
          />
          {query && (
            <button
              onClick={handleClear}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <button
          onClick={handleSearch}
          disabled={loading || rateLimited || !query.trim()}
          className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 transition-colors font-black"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Searching...
            </>
          ) : (
            <>
              <Search className="w-4 h-4" />
              Search
            </>
          )}
        </button>
      </div>

      {/* Suggestions */}
      {!results && !loading && (
        <div className="mb-6">
          <p className="text-xs font-black uppercase tracking-wider text-slate-400 mb-2">
            Popular searches
          </p>
          <div className="flex flex-wrap gap-2">
            {[
              'Software Engineer',
              'Medical Doctor',
              'Data Scientist',
              'Lawyer',
              'Teacher',
              'Graphic Designer',
              'Accountant',
              'Journalist',
            ].map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => {
                  setQuery(suggestion)
                  setTimeout(handleSearch, 100)
                }}
                className="px-3 py-1.5 bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-700 rounded-full text-sm font-semibold transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border-2 border-red-200 rounded-xl mb-6">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-red-700 text-sm font-semibold">{error}</p>
        </div>
      )}

      {/* Rate Limited */}
      {rateLimited && (
        <div className="flex items-center gap-3 p-4 bg-orange-50 border-2 border-orange-200 rounded-xl mb-6">
          <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0" />
          <div>
            <p className="text-orange-700 font-black">Search limit reached</p>
            <p className="text-orange-600 text-sm mt-0.5">
              Upgrade your plan for unlimited career searches.
            </p>
          </div>
        </div>
      )}

      {/* Results */}
      {results && !error && (
        <div>
          {/* AI Generated notice */}
          {results.source === 'dynamic' && (
            <div className="flex items-start gap-3 bg-amber-50 border-l-4 border-amber-400 p-4 mb-6 rounded-r-xl">
              <Sparkles className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-black text-amber-900">AI-Generated Career Data</p>
                <p className="text-sm text-amber-800 mt-0.5">
                  This career was researched by our AI. Data will be reviewed 
                  by our team and may be added to our permanent database.
                </p>
              </div>
            </div>
          )}

          {/* ✅ Use CareerCard component to display results */}
          {results.career && (
            <CareerCard
              career={results.career}
              showFullDetails={true}
            />
          )}
        </div>
      )}

    </div>
  )
}