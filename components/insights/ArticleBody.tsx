'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useEffect } from 'react'

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}

type Props = { content: string; slug: string }

export function ArticleBody({ content, slug }: Props) {
  // Track view once per session
  useEffect(() => {
    const key = `viewed_${slug}`
    if (sessionStorage.getItem(key)) return
    sessionStorage.setItem(key, '1')
    void fetch('/api/insights/views', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ slug }),
    })
  }, [slug])

  return (
    <div className="prose prose-invert prose-lg max-w-none
      prose-headings:font-extrabold prose-headings:tracking-tight prose-headings:text-white
      prose-h2:text-2xl prose-h2:mt-12 prose-h2:mb-4
      prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-3
      prose-p:text-white/70 prose-p:leading-[1.85] prose-p:text-[17px]
      prose-li:text-white/70 prose-li:leading-relaxed
      prose-strong:text-white prose-strong:font-bold
      prose-em:text-white/80
      prose-blockquote:border-l-violet-500 prose-blockquote:border-l-2
      prose-blockquote:bg-white/3 prose-blockquote:rounded-r-xl
      prose-blockquote:px-6 prose-blockquote:py-1 prose-blockquote:not-italic
      prose-blockquote:text-white/65
      prose-hr:border-white/10
      prose-a:text-violet-400 prose-a:no-underline hover:prose-a:text-violet-300
      focus-visible:prose-a:outline-2 focus-visible:prose-a:outline-offset-2 focus-visible:prose-a:outline-white/70
      prose-code:text-violet-300 prose-code:bg-white/8 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:font-mono
      prose-pre:bg-white/5 prose-pre:border prose-pre:border-white/10 prose-pre:rounded-2xl
      [&_h2]:scroll-mt-20 [&_h3]:scroll-mt-20
    ">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h2: ({ children, ...props }) => {
            const text = String(children)
            const id   = slugify(text)
            return <h2 id={id} {...props}>{children}</h2>
          },
          h3: ({ children, ...props }) => {
            const text = String(children)
            const id   = slugify(text)
            return <h3 id={id} {...props}>{children}</h3>
          },
          hr: () => (
            <div className="flex items-center gap-4 my-12">
              <div className="flex-1 h-px bg-white/10" />
              <div className="text-white/20 text-xs font-bold tracking-widest">✦ ✦ ✦</div>
              <div className="flex-1 h-px bg-white/10" />
            </div>
          ),
          blockquote: ({ children }) => (
            <blockquote className="relative border-l-2 border-violet-500 bg-violet-500/5 pl-6 pr-4 py-4 rounded-r-2xl my-8 not-italic">
              <div className="text-3xl text-violet-500/30 font-serif leading-none mb-2">&ldquo;</div>
              <div className="text-white/75 text-lg leading-relaxed">{children}</div>
            </blockquote>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
