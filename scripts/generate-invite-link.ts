// Generates a fresh activation/magic link for a teacher who already has a
// pending (or existing) EduNexus account, for manual delivery (WhatsApp,
// SMS) when the invite email itself can't be trusted to arrive — e.g. the
// Resend send failing silently while inviteSchoolMember still reported
// success (see lib/core/teacherOnboarding.ts's emailSent/emailError fields,
// added to close that gap; this script is the manual fallback for when
// email is broken or unavailable for a specific recipient regardless).
//
// Uses type:'magiclink' rather than 'invite' — 'invite' errors on an
// account that already exists (which every real invite target does, once
// inviteSchoolMember has run once), while magiclink works for any existing
// user and lands them on the same /teacher/activate acceptance screen via
// NEXT_PUBLIC_APP_URL's real callback route.
//
// Run: npx tsx -r dotenv/config scripts/generate-invite-link.ts <email> [dotenv_config_path=.env.local]
import { createServiceClient } from '@/utils/supabase/service'

// Hardcoded, not read from NEXT_PUBLIC_APP_URL: this script is meant to be
// run from a local dev checkout to produce a link a real teacher will
// click, and local .env.local intentionally points that var at
// localhost:3000 for local development — reading it here would silently
// hand back a dead link, the exact failure mode this script exists to work
// around.
const APP_URL = 'https://edunexus.co.ke'
const ACTIVATION_PATH = '/teacher/activate'

async function main() {
  const email = process.argv[2]
  if (!email) {
    console.error('Usage: npx tsx -r dotenv/config scripts/generate-invite-link.ts <email>')
    process.exit(1)
  }

  const db = createServiceClient()
  const { data, error } = await db.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo: `${APP_URL}/auth/callback?returnTo=${encodeURIComponent(ACTIVATION_PATH)}` },
  })

  if (error || !data.properties?.action_link) {
    console.error(`Failed to generate a link for ${email}: ${error?.message ?? 'unknown error'}`)
    process.exit(1)
  }

  console.log(data.properties.action_link)
}

main()
