'use client'

import { useState, useEffect } from 'react'

type Heading = { id: string; text: string; level: number }

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}

export function TableOfContents({ content }: { content: string }) {
  const [active, setActive] = useState<string>('')

  const headings: Heading[] = (content.match(/^#{2,3} .+/gm) ?? []).map((line) => {
    const level = line.match(/^#+/)?.[0].length ?? 2
    const text  = line.replace(/^#+\s/, '').trim()
    return { id: slugify(text), text, level }
  })

  useEffect(() => {
    const observers: IntersectionObserver[] = []

    headings.forEach(({ id }) => {
      const el = document.getElementById(id)
      if (!el) return
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActive(id) },
        { rootMargin: '-20% 0px -75% 0px' },
      )
      obs.observe(el)
      observers.push(obs)
    })

    return () => observers.forEach((o) => o.disconnect())
  })

  if (headings.length < 2) return null

  return (
    <nav aria-label="Table of contents" className="hidden xl:block">
      <p className="text-[10px] font-bold text-white/25 uppercase tracking-widest mb-4">
        On this page
      </p>
      <ul className="space-y-1">
        {headings.map((h) => (
          <li key={h.id}>
            <a
              href={`#${h.id}`}
              className={`block text-xs leading-relaxed transition-colors py-0.5 ${
                h.level === 3 ? 'pl-3' : ''
              } ${
                active === h.id
                  ? 'text-violet-400 font-semibold'
                  : 'text-white/35 hover:text-white/70'
              }`}
            >
              {h.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
