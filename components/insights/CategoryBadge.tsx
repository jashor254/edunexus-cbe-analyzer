import type { CategoryColor } from '@/lib/insights/types'

const COLOR_MAP: Record<CategoryColor, string> = {
  violet: 'bg-violet-500/15 text-violet-300 border-violet-500/25',
  blue:   'bg-blue-500/15   text-blue-300   border-blue-500/25',
  amber:  'bg-amber-500/15  text-amber-300  border-amber-500/25',
  teal:   'bg-teal-500/15   text-teal-300   border-teal-500/25',
  green:  'bg-green-500/15  text-green-300  border-green-500/25',
  indigo: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/25',
  pink:   'bg-pink-500/15   text-pink-300   border-pink-500/25',
  orange: 'bg-orange-500/15 text-orange-300 border-orange-500/25',
  cyan:   'bg-cyan-500/15   text-cyan-300   border-cyan-500/25',
  rose:   'bg-rose-500/15   text-rose-300   border-rose-500/25',
}

type Props = {
  name: string
  color: CategoryColor
  size?: 'sm' | 'md'
}

export function CategoryBadge({ name, color, size = 'sm' }: Props) {
  const cls = COLOR_MAP[color] ?? COLOR_MAP.violet
  const sizeClass = size === 'md'
    ? 'px-3 py-1 text-xs font-bold'
    : 'px-2.5 py-0.5 text-[10px] font-bold'

  return (
    <span className={`inline-flex items-center border rounded-full uppercase tracking-widest ${cls} ${sizeClass}`}>
      {name}
    </span>
  )
}
