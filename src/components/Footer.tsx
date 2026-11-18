import { For } from 'solid-js'
import { BuyMeACoffee } from './BuyMeACoffee'
import PageViewsTracker from './PageViewsTracker'

const SOCIAL_LINKS = [
  { label: 'GitHub', href: 'https://github.com/lwpulsifer' },
  { label: 'Twitter / X', href: 'https://twitter.com/LiamPulsifer' },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/liam-pulsifer' },
  { label: 'Real Python', href: 'https://realpython.com/team/lwpulsifer/' },
]

export default function Footer() {
  const year = new Date().getFullYear()
  return (
    <footer class="site-footer px-4 pb-14 pt-10 text-(--sea-ink-soft)">
      <div class="page-wrap flex flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
        <div class="flex flex-col items-center gap-1 sm:items-start">
          <p class="m-0 text-sm">&copy; {year} Liam Pulsifer. All rights reserved.</p>
          <PageViewsTracker />
        </div>
        <nav class="flex flex-wrap justify-center gap-x-5 gap-y-1 text-sm sm:justify-end">
          <For each={SOCIAL_LINKS}>
            {(link) => (
              <a
                href={link.href}
                target="_blank"
                rel="noreferrer"
                class="text-[var(--text-muted)] no-underline transition hover:text-[var(--text)]"
              >
                {link.label}
              </a>
            )}
          </For>
          <BuyMeACoffee />
        </nav>
      </div>
    </footer>
  )
}
