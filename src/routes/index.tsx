import { createFileRoute, Link } from '@tanstack/react-router'
import { SITE_TITLE } from '#/lib/site'

export const Route = createFileRoute('/')({
  head: () => ({
    meta: [{ title: SITE_TITLE }],
  }),
  component: Home,
})

function Home() {
  return (
    <main className="page-wrap px-4 pb-8 pt-14">
      <section className="island-shell rise-in relative overflow-hidden rounded-[2rem] px-6 py-10 sm:px-10 sm:py-14">
        <div className="flex flex-col items-center gap-8 md:flex-row md:items-start">
          <div className="flex-1">
            <p className="island-kicker mb-3">Welcome</p>
            <h1 className="display-title mb-5 text-4xl font-bold leading-[1.02] tracking-tight text-[var(--text)] sm:text-5xl">
              Hi, I'm Liam Pulsifer
            </h1>
            <p className="mb-6 max-w-2xl text-base leading-relaxed text-[var(--text-muted)] sm:text-lg">
              I'm a software engineer, writer, and amateur{' '}
              <a
                href="https://www.strava.com/athletes/47580246"
                target="_blank"
                rel="noreferrer"
              >
                athlete
              </a>
              . When I'm not working at my day job at{' '}
              <a href="https://www.ixl.com/" target="_blank" rel="noreferrer">
                IXL Learning
              </a>
              , you can often find me reading, playing tennis, or riding my bike
              around the San Francisco Bay Area. I'm always looking for new
              connections, so don't be shy about getting in touch, and please
              feel free to peruse the various links on this site to get a sense
              of who I am and what I'm doing.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/blog"
                className="rounded-full border border-[rgba(37,99,235,0.3)] bg-[rgba(59,130,246,0.1)] px-5 py-2.5 text-sm font-semibold text-[var(--blue-deep)] no-underline transition hover:-translate-y-0.5 hover:bg-[rgba(59,130,246,0.18)]"
              >
                Read the Blog
              </Link>
              <Link
                to="/about"
                className="rounded-full border border-[rgba(17,24,39,0.2)] bg-white/50 px-5 py-2.5 text-sm font-semibold text-[var(--text)] no-underline transition hover:-translate-y-0.5 hover:border-[rgba(17,24,39,0.35)]"
              >
                About Me
              </Link>
            </div>
          </div>

          <div className="shrink-0">
            <img
              src="/grad_cropped.jpg"
              alt="Liam Pulsifer"
              className="h-48 w-48 rounded-full object-cover shadow-lg ring-2 ring-[var(--border)]"
            />
          </div>
        </div>
      </section>
    </main>
  )
}
