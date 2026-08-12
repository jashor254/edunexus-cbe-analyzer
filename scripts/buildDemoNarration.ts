// scripts/buildDemoNarration.ts
//
// Emits the narration for the /demo video build, and checks it against the
// House Voice Standard before anything is recorded.
//
// Narration text lives on the slides themselves (lib/demo/presentation.ts), so
// the words and the beat they play over cannot drift apart. This script turns
// them into the `script.json` shape the existing production pipeline already
// uses (see ~/manim-projects/edunexus-tiktok/prod006-plan-once/), so the voice
// step is the same one command as every previous production.
//
// The pacing check is the point of running this before recording: a line that
// overruns its slide has to be cut here, in text, not discovered after the
// model has read all eight of them.
//
// Run: npx tsx scripts/buildDemoNarration.ts [outputDir]

import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { DEMO_SLIDES } from '../lib/demo/presentation'

// docs/brand/edunexus-house-voice-standard.md §Pace — the explanatory
// baseline. The locked voice reads slower than this and is corrected with
// atempo in build_audio.py; these figures are the target after that
// correction.
const WPM_MIN = 140
const WPM_MAX = 155
const WPM_NOMINAL = 145

/** Leave the beat a little silence at each end rather than talking to the edge. */
const TARGET_FILL = 0.85

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

function speechSeconds(words: number, wpm: number): number {
  return (words / wpm) * 60
}

/** Longest sentence in words — the standard asks for 8-18. */
function longestSentence(text: string): number {
  return Math.max(...text.split(/(?<=[.?!])\s+/).map(wordCount))
}

async function main() {
  const outDir = process.argv[2] ?? path.join(process.cwd(), 'public', 'demo', 'narration')
  await mkdir(outDir, { recursive: true })

  const lines = DEMO_SLIDES.map((slide, i) => ({
    id: `s${i + 1}`,
    slideId: slide.id,
    text: slide.narration ?? '',
    slideMs: slide.durationMs ?? 0,
  }))

  const missing = lines.filter(l => !l.text)
  if (missing.length > 0) {
    throw new Error(`[narration] slides without narration: ${missing.map(m => m.slideId).join(', ')}`)
  }

  console.log('slide                    words   speech    slide    fill   longest sentence')
  console.log('─'.repeat(78))

  let totalWords = 0
  let totalSlideMs = 0
  const warnings: string[] = []

  for (const line of lines) {
    const words = wordCount(line.text)
    const slow = speechSeconds(words, WPM_MIN)
    const fast = speechSeconds(words, WPM_MAX)
    const nominal = speechSeconds(words, WPM_NOMINAL)
    const slideS = line.slideMs / 1000
    const fill = nominal / slideS
    const longest = longestSentence(line.text)

    totalWords += words
    totalSlideMs += line.slideMs

    const flag = slow > slideS ? ' ⚠ overruns' : fill > TARGET_FILL + 0.1 ? ' ⚠ tight' : ''
    if (slow > slideS) warnings.push(`${line.slideId}: ${words} words needs ${slow.toFixed(1)}s at ${WPM_MIN} wpm, slide is ${slideS}s`)
    if (longest > 18) warnings.push(`${line.slideId}: longest sentence is ${longest} words (standard: 8-18)`)

    console.log(
      `${line.slideId.padEnd(24)} ${String(words).padStart(5)}   ` +
      `${fast.toFixed(1)}-${slow.toFixed(1)}s`.padStart(9) +
      `   ${slideS.toFixed(0)}s`.padStart(8) +
      `   ${(fill * 100).toFixed(0)}%`.padStart(6) +
      `   ${longest}`.padStart(6) + flag,
    )
  }

  const totalSpeech = speechSeconds(totalWords, WPM_NOMINAL)
  console.log('─'.repeat(78))
  console.log(
    `total: ${totalWords} words, ~${totalSpeech.toFixed(0)}s of speech across ` +
    `${(totalSlideMs / 1000).toFixed(0)}s of slides (${((totalSpeech / (totalSlideMs / 1000)) * 100).toFixed(0)}% fill)`,
  )

  if (warnings.length > 0) {
    console.log('\nwarnings:')
    for (const w of warnings) console.log(`  ! ${w}`)
  } else {
    console.log('\nevery line fits its slide at 140 wpm, and no sentence exceeds 18 words.')
  }

  // script.json — the same shape prod006 used, so the voice step is unchanged.
  await writeFile(
    path.join(outDir, 'script.json'),
    JSON.stringify(lines.map(l => ({ id: l.id, text: l.text })), null, 2) + '\n',
    'utf8',
  )

  // A slide↔line map the video build needs and the voice step does not.
  await writeFile(
    path.join(outDir, 'slides.json'),
    JSON.stringify(lines.map(l => ({ id: l.id, slideId: l.slideId, slideMs: l.slideMs })), null, 2) + '\n',
    'utf8',
  )

  console.log(`\nwrote ${path.join(outDir, 'script.json')}`)
  console.log(`wrote ${path.join(outDir, 'slides.json')}`)
  console.log('\nnext: run script.json through the locked voice on the machine with the Qwen venv:')
  console.log('  <qwen venv>/bin/python generate_locked_voice.py --batch-file script.json')
}

main().catch(err => { console.error(err); process.exitCode = 1 })
