// components/careers/CareerSearchSimple.tsx
'use client';

import { useState } from 'react';

export function CareerSearchSimple() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async () => {
    if (!query.trim()) return;
    
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch(`/api/careers/search?name=${encodeURIComponent(query)}`);
      
      if (!response.ok) {
        throw new Error('Search failed');
      }
      
      const data = await response.json();
      setResults(data);
    } catch (err) {
      setError('Failed to search. Please try again.');
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-4">🔍 Career Search</h2>
      
      <div className="flex gap-2 mb-6">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Try: Blockchain Developer, Marine Biologist..."
          className="flex-1 px-4 py-3 border rounded-lg"
        />
        <button
          onClick={handleSearch}
          disabled={loading}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg mb-4">
          {error}
        </div>
      )}

      {results && (
        <div className="border rounded-lg p-6">
          {results.source === 'dynamic' && (
            <div className="bg-amber-50 border-l-4 border-amber-400 p-4 mb-4">
              <p className="font-bold text-amber-900">✨ AI-Generated</p>
              <p className="text-sm text-amber-800">
                This career was researched by AI and will be reviewed by our team.
              </p>
            </div>
          )}

          <h3 className="text-2xl font-bold mb-2">{results.career.name}</h3>
          <p className="text-sm text-gray-600 mb-4">{results.career.pathway}</p>
          
          <div className="space-y-4">
            <div>
              <p className="text-sm font-bold">🇰🇪 Kenyan Market</p>
              <p className="text-sm">{results.career.marketReality.kenyanContext}</p>
            </div>
            
            <div>
              <p className="text-sm font-bold">Universities</p>
              <p className="text-sm">{results.career.cbeReadiness.universities.join(', ')}</p>
            </div>

            {results.career.cbeReadiness.tvetOptions.length > 0 && (
              <div>
                <p className="text-sm font-bold">TVET Options</p>
                <p className="text-sm">{results.career.cbeReadiness.tvetOptions.join(', ')}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}