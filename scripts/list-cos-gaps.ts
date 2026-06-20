import { createServiceClient } from '../utils/supabase/service'

async function main() {
  const db = createServiceClient()
  const { data, error } = await db
    .from('careers')
    .select('slug, title, category, required_capabilities')
    .order('category')

  if (error) { console.error(error); process.exit(1) }

  const withCOS    = (data ?? []).filter(c => c.required_capabilities)
  const withoutCOS = (data ?? []).filter(c => !c.required_capabilities)

  console.log(`\nWITH COS (${withCOS.length}):`)
  withCOS.forEach(c => console.log(`  ✓ ${c.slug} | ${c.category}`))

  console.log(`\nNEEDS COS (${withoutCOS.length}):`)
  withoutCOS.forEach(c => console.log(`  ✗ ${c.slug} | ${c.category} | ${c.title}`))
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
