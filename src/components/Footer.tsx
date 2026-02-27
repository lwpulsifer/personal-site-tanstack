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
    <footer className="site-footer mt-20 px-4 pb-14 pt-10 text-[var(--sea-ink-soft)]">
      <div className="page-wrap flex flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
        <div className="flex flex-col items-center gap-1 sm:items-start">
          <p className="m-0 text-sm">&copy; {year} Liam Pulsifer. All rights reserved.</p>
          <PageViewsTracker />
        </div>
        <nav className="flex flex-wrap justify-center gap-x-5 gap-y-1 text-sm sm:justify-end">
          {SOCIAL_LINKS.map(({ label, href }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noreferrer"
              className="text-[var(--sea-ink-soft)] no-underline transition hover:text-[var(--sea-ink)]"
            >
              {label}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  )
}
