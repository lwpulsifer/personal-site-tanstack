const BMAC_URL = 'https://buymeacoffee.com/liam.pulsifer'

export function BuyMeACoffee({
  variant = 'footer',
  label = 'Like this post? Buy me a coffee!',
}: {
  variant?: 'footer' | 'prominent'
  label?: string
}) {
  if (variant === 'prominent') {
    return (
      <a
        href={BMAC_URL}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-2 rounded-full bg-[#FFDD00] px-5 py-2 text-sm font-bold text-gray-900 no-underline shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
      >
        {label}
      </a>
    )
  }

  return (
    <a
      href={BMAC_URL}
      target="_blank"
      rel="noreferrer"
      className="text-[var(--text-muted)] no-underline transition hover:text-[var(--text)]"
    >
      Buy me a coffee
    </a>
  )
}
