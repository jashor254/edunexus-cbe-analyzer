'use client'

import { useEffect } from 'react'

// Root layout itself failed to render — this replaces the ENTIRE document,
// including <html>/<body>, and cannot assume globals.css or any provider
// from layout.tsx ran. Inline styles only, no Tailwind classes, no imports
// beyond what's safe standing completely alone.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Intentionally not lib/observability/logger here — keep this boundary
    // dependency-free since the failure that reached it may be systemic.
    console.error('[global-error]', error)
  }, [error])

  return (
    <html lang="en">
      <body style={{
        margin: 0,
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1rem',
        padding: '1.5rem',
        textAlign: 'center',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        color: '#1e293b',
        backgroundColor: '#ffffff',
      }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>
          Kuna kitu kimeenda mrama!
        </h1>
        <p style={{ color: '#475569', maxWidth: '28rem', margin: 0 }}>
          Samahani, programu imekutana na hitilafu kubwa. Jaribu kupakia upya ukurasa.
        </p>
        <button
          onClick={() => reset()}
          style={{
            padding: '0.5rem 1.5rem',
            backgroundColor: '#1a56be',
            color: '#ffffff',
            border: 'none',
            borderRadius: '0.5rem',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Jaribu Tena
        </button>
      </body>
    </html>
  )
}
