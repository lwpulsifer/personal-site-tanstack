import { Title } from '@solidjs/meta'
import { SITE_TITLE } from '../lib/site'
import { paths } from '../router'

export default function Home() {
  return (
    <main class="page-wrap px-4 pb-8 pt-14">
      <Title>{SITE_TITLE}</Title>
      <section class="island-shell rise-in relative overflow-hidden rounded-[2rem] px-6 py-10 sm:px-10 sm:py-14">
        <div class="flex flex-col items-center gap-8 md:flex-row md:items-start">
          <div class="flex-1">
            <p class="island-kicker mb-3">Welcome</p>
            <h1 class="display-title mb-5 text-4xl font-bold leading-[1.02] tracking-tight text-[var(--text)] sm:text-5xl">
              Hi, I'm Liam Pulsifer
            </h1>
            <p class="mb-6 max-w-2xl text-base leading-relaxed text-[var(--text-muted)] sm:text-lg">
              I'm a software engineer, writer, and amateur{' '}
              <a href="https://www.strava.com/athletes/47580246" target="_blank" rel="noreferrer">
                athlete
              </a>
              . When I'm not working at my day job at{' '}
              <a href="https://www.outschool.com/" target="_blank" rel="noreferrer">
                Outschool
              </a>
              , you can often find me reading, playing tennis, or riding my bike around the San
              Francisco Bay Area. I'm always looking for new connections, so don't be shy about
              getting in touch, and please feel free to peruse the various links on this site to get
              a sense of who I am and what I'm doing.
            </p>
            <div class="flex flex-wrap gap-3">
              <a
                href={paths.blog()}
                class="rounded-full border border-[rgba(37,99,235,0.3)] bg-[rgba(59,130,246,0.1)] px-5 py-2.5 text-sm font-semibold text-[var(--blue-deep)] no-underline transition hover:-translate-y-0.5 hover:bg-[rgba(59,130,246,0.18)]"
              >
                Check out my Blog
              </a>
            </div>
          </div>

          <div class="shrink-0">
            <picture>
              <source media="(min-width: 768px)" srcset="/roys_peak.webp" width={384} height={384} />
              <img
                src="/roys_peak-192.webp"
                alt="Me, at the top of Roy's Peak in Wanaka, New Zealand"
                width={192}
                height={192}
                fetchpriority="high"
                loading="eager"
                decoding="async"
                class="h-48 w-48 rounded-full object-cover shadow-lg ring-2 ring-[var(--border)] md:h-96 md:w-96"
              />
            </picture>
          </div>
        </div>
      </section>
    </main>
  )
}
