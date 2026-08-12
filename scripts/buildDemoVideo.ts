// scripts/buildDemoVideo.ts
//
// Renders the /demo presentation to an MP4.
//
// Frames come from the real page rather than a redrawn copy: the script opens
// /demo in a headless browser, steps through the slides with the same Next
// control a viewer uses, and screenshots each one at 1920x1080. What ships in
// the video is therefore exactly what ships on the web — there is no second
// implementation of the deck to keep in sync.
//
// Captions are burned in, deliberately. Most people open a link with the sound
// off, and browsers will not autoplay audio without a gesture in any case, so
// the piece has to be complete silently. The narration text is the caption
// text, from lib/demo/presentation.ts.
//
// Narration audio is optional. Given a directory of per-line audio files the
// script muxes them onto their slides; without one it produces the silent cut,
// which is a finished artefact in its own right. Generating the audio needs
// the locked voice (see scripts/buildDemoNarration.ts).
//
// Run: npx tsx scripts/buildDemoVideo.ts [outputPath] [--audio <dir>]

if (process.env.NODE_ENV === 'production') {
  throw new Error('[video] refusing to run with NODE_ENV=production.')
}

import { chromium } from 'playwright-core'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { DEMO_SLIDES } from '../lib/demo/presentation'

const run = promisify(execFile)

const BASE_URL = process.env.DEMO_CAPTURE_BASE_URL ?? 'http://localhost:3000'
const WIDTH = 1920
const HEIGHT = 1080

function parseArgs() {
  const args = process.argv.slice(2)
  const audioIdx = args.indexOf('--audio')
  const audioDir = audioIdx >= 0 ? args[audioIdx + 1] : null
  const out = args.find((a, i) => !a.startsWith('--') && i !== audioIdx + 1)
  return {
    outPath: out ?? path.join(os.homedir(), 'Desktop', 'EduNexus-Demo.mp4'),
    audioDir,
  }
}

/** ffmpeg drawtext needs these escaped, and the copy contains apostrophes. */
function escapeDrawText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/:/g, '\\:')
    .replace(/'/g, "’")
    .replace(/%/g, '\\%')
}

/** Wraps caption text to a readable measure without breaking words. */
function wrapCaption(text: string, maxChars = 62): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    if ((line + ' ' + word).trim().length > maxChars && line) {
      lines.push(line.trim())
      line = word
    } else {
      line = (line + ' ' + word).trim()
    }
  }
  if (line) lines.push(line)
  return lines.slice(0, 3) // three lines is the most a caption should ever be
}

async function captureFrames(framesDir: string): Promise<string[]> {
  const systemChrome = ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser']
    .find(p => existsSync(p))
  const browser = await chromium.launch(systemChrome ? { executablePath: systemChrome } : {})
  const context = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 1,
    // The deck must not advance under us while we are stepping it by hand.
    reducedMotion: 'reduce',
  })
  const page = await context.newPage()

  await page.goto(`${BASE_URL}/demo`, { waitUntil: 'networkidle', timeout: 90_000 }).catch(() => {})
  await page.waitForTimeout(3_000)

  // A video has no buttons to press, so the controls and the progress bar must
  // not appear in the frame. Hidden with visibility rather than display so the
  // layout does not reflow and the slide keeps the same composition it has on
  // the web. The controls still exist and are still clickable underneath —
  // that is how this script steps through the deck.
  await page.addStyleTag({
    content: `
      footer .demo-control, footer p { visibility: hidden !important; }
      main + footer { pointer-events: auto; }
      ol[aria-label^="Presentation progress"] { visibility: hidden !important; }
    `,
  })

  const frames: string[] = []
  for (let i = 0; i < DEMO_SLIDES.length; i++) {
    if (i > 0) {
      await page.getByRole('button', { name: 'Next slide' }).click()
      await page.waitForTimeout(1_200)
    }
    const frame = path.join(framesDir, `slide-${String(i).padStart(2, '0')}.png`)
    await page.screenshot({ path: frame })
    frames.push(frame)
    console.log(`  frame ${i + 1}/${DEMO_SLIDES.length}: ${DEMO_SLIDES[i].label}`)
  }

  await browser.close()
  return frames
}

async function main() {
  const { outPath, audioDir } = parseArgs()
  const work = path.join(os.tmpdir(), `edunexus-demo-video-${Date.now()}`)
  const framesDir = path.join(work, 'frames')
  await mkdir(framesDir, { recursive: true })

  console.log(`Rendering ${DEMO_SLIDES.length} slides from ${BASE_URL}/demo at ${WIDTH}x${HEIGHT}\n`)
  const frames = await captureFrames(framesDir)

  // One clip per slide: a still, held for the slide's dwell time, with its
  // caption burned in. Built separately then concatenated, because each slide
  // needs its own duration and its own caption.
  const clips: string[] = []
  for (let i = 0; i < DEMO_SLIDES.length; i++) {
    const slide = DEMO_SLIDES[i]
    const seconds = (slide.durationMs ?? 12_000) / 1000
    const clip = path.join(work, `clip-${String(i).padStart(2, '0')}.mp4`)

    // One drawtext for the whole caption, so it reads as a single block
    // rather than a stack of separately-boxed lines.
    const captionLines = slide.narration ? wrapCaption(slide.narration) : []
    const drawtext = captionLines.length
      ? `drawtext=text='${escapeDrawText(captionLines.join('\n'))}'` +
        `:fontcolor=white:fontsize=34:line_spacing=12` +
        `:x=(w-text_w)/2:y=h-th-90` +
        `:box=1:boxcolor=0x0b1220@0.82:boxborderw=22`
      : ''

    const filters = ['scale=1920:1080:force_original_aspect_ratio=decrease',
                     'pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x0b1220']
    if (drawtext) filters.push(drawtext)

    // ffmpeg wants every input declared before any output option. Built in
    // that order explicitly rather than spliced together after the fact —
    // getting this wrong makes it read -vf as belonging to the audio input.
    const audioFile = audioDir ? path.join(audioDir, `s${i + 1}.wav`) : null
    const hasNarration = audioFile !== null && existsSync(audioFile)

    const inputs = ['-loop', '1', '-t', String(seconds), '-i', frames[i]]
    inputs.push(...(hasNarration
      ? ['-i', audioFile!]
      : ['-f', 'lavfi', '-t', String(seconds), '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000']))

    const args = [
      '-y',
      ...inputs,
      '-vf', filters.join(','),
      // Pad the narration out to the slide's length so the still is never cut
      // short by a line that finishes early.
      ...(hasNarration ? ['-af', `apad=whole_dur=${seconds}`] : []),
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', '30',
      '-c:a', 'aac', '-b:a', '160k',
      '-t', String(seconds),
      clip,
    ]

    await run('ffmpeg', args, { maxBuffer: 1024 * 1024 * 64 })
    clips.push(clip)
    console.log(`  clip ${i + 1}/${DEMO_SLIDES.length} (${seconds}s)${captionLines.length ? ' + caption' : ''}`)
  }

  const listFile = path.join(work, 'clips.txt')
  await writeFile(listFile, clips.map(c => `file '${c}'`).join('\n'), 'utf8')

  await mkdir(path.dirname(outPath), { recursive: true })
  await run('ffmpeg', [
    '-y', '-f', 'concat', '-safe', '0', '-i', listFile,
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-preset', 'medium',
    '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart',
    outPath,
  ], { maxBuffer: 1024 * 1024 * 64 })

  await rm(work, { recursive: true, force: true })

  const totalS = DEMO_SLIDES.reduce((sum, s) => sum + (s.durationMs ?? 0), 0) / 1000
  console.log(`\nWrote ${outPath}`)
  console.log(`  ${DEMO_SLIDES.length} slides, ${totalS}s, ${WIDTH}x${HEIGHT}, captions burned in`)
  console.log(`  narration: ${audioDir ? `from ${audioDir}` : 'none yet — silent cut'}`)
}

main().catch(err => { console.error(err); process.exitCode = 1 })
