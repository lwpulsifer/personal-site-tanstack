import type { PublicQuizItem } from '#/server/quizzes'

/** Visitor-facing item: picture and/or description, nothing else. */
export function QuizItemCard({
  item,
  compact = false,
}: {
  item: PublicQuizItem
  compact?: boolean
}) {
  return (
    <div className="flex h-full flex-col items-center gap-3 text-center">
      {item.image_url && (
        <img
          src={item.image_url}
          alt={item.description ?? ''}
          loading="lazy"
          className={`w-full rounded-xl object-contain ${
            compact ? 'max-h-24' : 'aspect-square max-h-72 bg-[var(--chip-bg)]'
          }`}
        />
      )}
      {item.description && (
        <p
          className={`m-0 whitespace-pre-wrap text-[var(--text)] ${
            compact ? 'text-sm' : 'text-base sm:text-lg'
          }`}
        >
          {item.description}
        </p>
      )}
      {!item.image_url && !item.description && (
        <p className="m-0 italic text-[var(--text-muted)]">(blank item)</p>
      )}
    </div>
  )
}
