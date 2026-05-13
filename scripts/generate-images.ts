// Run with: npx tsx scripts/generate-images.ts
// (ts-node requires --esm flag due to moduleResolution: bundler in tsconfig)

import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const API_KEY  = process.env.TOGETHER_API_KEY
const MODEL    = 'black-forest-labs/FLUX.1-schnell-Free'
const API_URL  = 'https://api.together.xyz/v1/images/generations'
const OUT_DIR  = path.resolve(__dirname, '../public/images')

interface ImageSpec {
  filename: string
  width:    number
  height:   number
  prompt:   string
}

const images: ImageSpec[] = [
  {
    filename: 'hero.png',
    width:    1200,
    height:   800,
    prompt:
      'Kenyan Grade 8 student smiling while studying on a modern laptop, ' +
      'CBC textbooks on desk, warm golden hour light through window, ' +
      'photorealistic DSLR style, shallow depth of field, East African ' +
      'features, natural hair, school uniform',
  },
  {
    filename: 'teacher.png',
    width:    1200,
    height:   800,
    prompt:
      'Kenyan secondary school teacher sitting at desk reviewing digital ' +
      'lesson plans on laptop, modern classroom background, professional ' +
      'warm lighting, East African features, natural confident expression, ' +
      'photorealistic',
  },
  {
    filename: 'parent.png',
    width:    1200,
    height:   800,
    prompt:
      'Kenyan mother and teenage daughter reviewing academic report together ' +
      'on a tablet, modern home living room, warm evening light, candid ' +
      'natural moment, East African features, photorealistic DSLR style',
  },
  {
    filename: 'dashboard.png',
    width:    1600,
    height:   896, // nearest multiple of 8 to 900
    prompt:
      'Clean modern dark-theme education dashboard on a MacBook screen, ' +
      'teal and cyan accent colors, student progress charts and analytics, ' +
      'product photography style, studio lighting, blurred background',
  },
  {
    filename: 'mobile-app.png',
    width:    800,
    height:   1200,
    prompt:
      'EduNexus mobile app on iPhone, dark theme with teal accents, ' +
      'showing student learning compass screen, product mockup style, ' +
      'studio background, professional',
  },
]

async function generate(spec: ImageSpec, attempt = 1): Promise<boolean> {
  const tag = attempt === 1 ? '🎨' : '🔄 retry'
  console.log(`\n[${tag}] ${spec.filename}  ${spec.width}×${spec.height}`)

  try {
    const res = await fetch(API_URL, {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model:           MODEL,
        prompt:          spec.prompt,
        width:           spec.width,
        height:          spec.height,
        steps:           4,
        n:               1,
        response_format: 'b64_json',
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`HTTP ${res.status} — ${body.slice(0, 200)}`)
    }

    const json = await res.json() as { data?: { b64_json?: string }[] }
    const b64  = json?.data?.[0]?.b64_json

    if (!b64) throw new Error('No b64_json field in response')

    const buf     = Buffer.from(b64, 'base64')
    const outPath = path.join(OUT_DIR, spec.filename)
    fs.writeFileSync(outPath, buf)

    console.log(`   ✓ saved  ${spec.filename}  (${(buf.length / 1024).toFixed(0)} KB)`)
    return true

  } catch (err) {
    const msg = (err as Error).message
    if (attempt === 1) {
      console.warn(`   ⚠ failed: ${msg}`)
      console.warn('   ↩ retrying once…')
      return generate(spec, 2)
    }
    console.error(`   ✗ gave up after retry: ${msg}`)
    return false
  }
}

async function main() {
  if (!API_KEY) {
    console.error('❌  TOGETHER_API_KEY not found — check .env.local')
    process.exit(1)
  }

  fs.mkdirSync(OUT_DIR, { recursive: true })

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('🖼   EduNexus image generator')
  console.log(`🤖  Model : ${MODEL}`)
  console.log(`📁  Output: ${OUT_DIR}`)
  console.log(`🔢  Images: ${images.length}`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  const results: { filename: string; ok: boolean }[] = []

  for (const spec of images) {
    const ok = await generate(spec)
    results.push({ filename: spec.filename, ok })
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('📊  Summary')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  const saved  = results.filter(r => r.ok)
  const failed = results.filter(r => !r.ok)

  saved.forEach(r  => console.log(`  ✅  ${r.filename}`))
  failed.forEach(r => console.log(`  ❌  ${r.filename}`))

  console.log(`\n${saved.length} / ${images.length} images saved to public/images/`)

  if (failed.length) {
    console.log('Re-run the script to retry failed images.')
    process.exit(1)
  }
}

main()
