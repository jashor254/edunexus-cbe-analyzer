export function PageIntro({ title, description }: { title: string; description?: string }) {
  return (
    <div className="border-b-2 border-[var(--concept-charcoal)]/80 bg-[var(--concept-primary)]/5 py-10">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <h1 className="font-[family-name:var(--font-institutional)] text-2xl font-bold text-[var(--concept-primary-dark)] sm:text-3xl">
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--concept-charcoal)]/75">{description}</p>
        )}
      </div>
    </div>
  )
}
