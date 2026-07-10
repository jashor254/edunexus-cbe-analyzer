// Buckets a timestamp to the Monday of its ISO week, so a dismissed item
// naturally reappears if the same underlying issue persists into a new week.
export function weekBucketOf(dateStr: string): string {
  const d = new Date(dateStr)
  const day = d.getUTCDay()
  const diffToMonday = day === 0 ? -6 : 1 - day
  const monday = new Date(d)
  monday.setUTCDate(d.getUTCDate() + diffToMonday)
  return monday.toISOString().slice(0, 10)
}
