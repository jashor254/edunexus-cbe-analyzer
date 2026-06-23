export function toTitleCase(s: string): string {
  if (!s) return s
  return s.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
}

export function firstSentence(text: string | null | undefined, maxLen = 120): string {
  if (!text) return ''
  const s = text.split(/[.!?\n]/)[0]?.trim() ?? ''
  return s.length > maxLen ? s.slice(0, maxLen) + '…' : s
}
