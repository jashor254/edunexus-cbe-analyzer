import * as dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })
import { createClient } from '@supabase/supabase-js'

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function main() {
  const { data, error } = await db.from('students').select('id, user_id, name, grade, curriculum_type, current_pathway').eq('id', '494c21c4-18ff-46c1-b364-5c19e6c7509f').single()
  console.log(JSON.stringify({ data, error }, null, 2))
  if (data?.user_id) {
    const { data: list } = await db.auth.admin.listUsers()
    const u = list?.users.find(u => u.id === data.user_id)
    console.log('Auth user:', u ? { id: u.id, email: u.email } : 'NOT FOUND')
  }
}
main()
