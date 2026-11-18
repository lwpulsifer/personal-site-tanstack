const BMAC_URL = 'https://buymeacoffee.com/liam.pulsifer'

export function BuyMeACoffee(props: {
  variant?: 'footer' | 'prominent'
  label?: string
}) {
  return props.variant === 'prominent' ? (
    <a
      href={BMAC_URL}
      target="_blank"
      rel="noreferrer"
      class="inline-flex items-center gap-2 rounded-full bg-[#FFDD00] px-5 py-2 text-sm font-bold text-gray-900 no-underline shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      {props.label ?? 'Like this post? Buy me a coffee!'}
    </a>
  ) : (
    <a
      href={BMAC_URL}
      target="_blank"
      rel="noreferrer"
      class="text-[var(--text-muted)] no-underline transition hover:text-[var(--text)]"
    >
      Buy me a coffee
    </a>
  )
}
