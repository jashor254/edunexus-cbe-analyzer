// WCAG 2.x contrast-ratio math, computed from real hex values rather than
// hardcoded expected numbers — so a future theme change and its contrast
// test can never silently drift apart (see contrastRatio.test.ts, which
// imports the real Kutus theme rather than restating its colours).

export type RGB = { r: number; g: number; b: number }

export function hexToRgb(hex: string): RGB {
  const clean = hex.replace('#', '')
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  }
}

function channelLuminance(c: number): number {
  const normalized = c / 255
  return normalized <= 0.03928 ? normalized / 12.92 : Math.pow((normalized + 0.055) / 1.055, 2.4)
}

export function relativeLuminance({ r, g, b }: RGB): number {
  return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b)
}

/** WCAG contrast ratio between two colours, order-independent, in the
 * standard [1, 21] range. */
export function contrastRatio(hexA: string, hexB: string): number {
  const lA = relativeLuminance(hexToRgb(hexA))
  const lB = relativeLuminance(hexToRgb(hexB))
  const lighter = Math.max(lA, lB)
  const darker = Math.min(lA, lB)
  return (lighter + 0.05) / (darker + 0.05)
}

/** Flattens a foreground colour used at `alpha` opacity over `background`
 * into the single opaque colour a viewer actually sees — e.g. the
 * clay/15-tinted badge background in DemoEnquiryForm — so contrast can be
 * measured against what's rendered, not against the nominal token alone. */
export function blendOver(foregroundHex: string, backgroundHex: string, alpha: number): string {
  const fg = hexToRgb(foregroundHex)
  const bg = hexToRgb(backgroundHex)
  const blend = (f: number, b: number) => Math.round(f * alpha + b * (1 - alpha))
  const toHex = (n: number) => n.toString(16).padStart(2, '0')
  return `#${toHex(blend(fg.r, bg.r))}${toHex(blend(fg.g, bg.g))}${toHex(blend(fg.b, bg.b))}`
}
