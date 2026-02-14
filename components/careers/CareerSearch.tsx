// components/careers/CareerSearch.tsx
'use client';

import { useState } from 'react';
import { Search, Sparkles } from 'lucide-react';

export function CareerSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/careers/search?name=${encodeURIComponent(query)}`);
      const data = await response.json();
      setResults(data);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">🔍 Career Explorer</h2>
        <p className="text-gray-600">
          Search for any career - even ones not in our database! Our AI will research it for you.
        </p>
      </div>

      <div className="flex gap-2 mb-6">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Try: Blockchain Developer, UX Designer, Data Scientist..."
          className="flex-1 px-4 py-3 border rounded-lg"
        />
        <button
          onClick={handleSearch}
          disabled={loading}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
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

      {results && (
        <div className="border rounded-lg p-6">
          {results.source === 'dynamic' && (
            <div className="bg-amber-50 border-l-4 border-amber-400 p-4 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-5 h-5 text-amber-600" />
                <p className="font-bold text-amber-900">AI-Generated Career Data</p>
              </div>
              <p className="text-sm text-amber-800">
                This career was researched by our AI. The information will be reviewed by our team and may be added to our permanent database.
              </p>
            </div>
          )}

          <h3 className="text-2xl font-bold mb-4">{results.career.name}</h3>
          
          {/* Display career data here - same as your existing career card */}
          <div className="space-y-4">
            <div>
              <p className="text-sm font-bold text-gray-600">Pathway</p>
              <p>{results.career.pathway}</p>
            </div>
            
            <div>
              <p className="text-sm font-bold text-gray-600">🇰🇪 Kenyan Market Reality</p>
              <p className="text-sm">{results.career.marketReality.kenyanContext}</p>
            </div>
            
            {/* Add all other fields */}
          </div>
        </div>
      )}
    </div>
  );
}
