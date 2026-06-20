import { seedCareersCOS } from '../lib/career/seedCareers'

seedCareersCOS().then(result => {
  console.log(JSON.stringify(result, null, 2))
  process.exit(result.errors.length > 0 ? 1 : 0)
}).catch(err => {
  console.error(err)
  process.exit(1)
})
