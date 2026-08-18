// Fills its parent's sized/rounded wrapper with either the cover image or a
// placeholder icon. Used by BookCard, BookDetail, and BookShelf's stack.
export function CoverImage({ src, iconClassName = 'text-3xl' }: { src: string | null; iconClassName?: string }) {
  if (!src) {
    return (
      <div className={`flex h-full w-full items-center justify-center opacity-40 ${iconClassName}`}>📖</div>
    )
  }
  return <img src={src} alt="" className="h-full w-full object-cover" />
}
