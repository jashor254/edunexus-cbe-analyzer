// lib/pdf/utils.ts
// Shared HTML-print utilities used by all PDF renderers.

export function esc(s: string | number | null | undefined): string {
  if (s == null) return ''
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function printAndClose(): void {
  window.print()
}
