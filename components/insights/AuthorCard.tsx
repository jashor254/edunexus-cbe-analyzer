import type { InsightAuthor } from '@/lib/insights/types'

type Props = { author: InsightAuthor; compact?: boolean }

export function AuthorCard({ author, compact = false }: Props) {
  if (compact) {
    return (
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-base font-bold text-violet-300 shrink-0">
          {author.name.charAt(0)}
        </div>
        <div>
          <p className="text-sm font-semibold text-white/90">{author.name}</p>
          {author.title && (
            <p className="text-xs text-white/40">{author.title}</p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white/3 border border-white/8 rounded-2xl p-6">
      <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-4">About the Author</p>
      <div className="flex items-start gap-4">
        <div className="w-14 h-14 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-xl font-bold text-violet-300 shrink-0">
          {author.name.charAt(0)}
        </div>
        <div>
          <p className="text-base font-bold text-white">{author.name}</p>
          {author.title && (
            <p className="text-sm text-white/50 mt-0.5">{author.title}</p>
          )}
          {author.bio && (
            <p className="text-sm text-white/55 leading-relaxed mt-3">{author.bio}</p>
          )}

          {Object.keys(author.social_links ?? {}).length > 0 && (
            <div className="flex gap-3 mt-4">
              {Object.entries(author.social_links).map(([platform, url]) => (
                <a
                  key={platform}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-semibold text-violet-400 hover:text-violet-300 capitalize transition-colors"
                >
                  {platform} →
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
