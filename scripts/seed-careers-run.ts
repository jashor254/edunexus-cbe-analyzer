// scripts/seed-careers-run.ts
// Runs the career seed (upsert by slug — safe to re-run).
//   npx tsx scripts/seed-careers-run.ts

import * as dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

import { seedCareers } from '../lib/career/seedCareers'

seedCareers().then(({ inserted, errors }) => {
  console.log(`Seeded ${inserted} careers.`)
  if (errors.length > 0) console.error('Errors:', errors)
}).catch(err => {
  console.error(err)
  process.exit(1)
})
