'use client'

import { useState } from 'react'
import { Link2, Twitter, Check } from 'lucide-react'

type Props = { title: string; url: string }

export function ShareButtons({ title, url }: Props) {
  const [copied, setCopied] = useState(false)

  async function copyLink() {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`

  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-bold text-white/25 uppercase tracking-widest mr-1">Share</span>

      <a
        href={twitterUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 text-xs font-semibold text-white/40 hover:text-white/70 bg-white/5 hover:bg-white/10 border border-white/8 px-3 py-1.5 rounded-lg transition-all"
        aria-label="Share on X / Twitter"
      >
        <Twitter className="w-3.5 h-3.5" />
        X
      </a>

      <button
        onClick={() => void copyLink()}
        className="flex items-center gap-1.5 text-xs font-semibold text-white/40 hover:text-white/70 bg-white/5 hover:bg-white/10 border border-white/8 px-3 py-1.5 rounded-lg transition-all"
        aria-label="Copy link"
      >
        {copied
          ? <><Check className="w-3.5 h-3.5 text-green-400" /> Copied</>
          : <><Link2 className="w-3.5 h-3.5" /> Copy link</>
        }
      </button>
    </div>
  )
}
