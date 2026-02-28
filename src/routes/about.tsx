import { useState } from 'react'

// export const Route = createFileRoute('/about')({
//   head: () => ({
//     meta: [{ title: `About | ${SITE_TITLE}` }],
//   }),
//   component: About,
// })

type TimelineEvent = {
  beginning: Date
  end?: Date | null
  title: string
  description: string | React.ReactNode
  location?: string
}

const events: TimelineEvent[] = [
  {
    beginning: new Date('July 1, 2022'),
    title: 'Promoted to Senior Software Engineer',
    description: `After a busy two years as a Software Engineer, I was bumped up to the Senior level. I now spend much more of my time designing features for IXL's web platform and collaborating with other teams to build them.`,
  },
  {
    beginning: new Date('August 18, 2020'),
    title: 'Moved to San Francisco',
    description: '',
    location: 'San Francisco, CA',
  },
  {
    beginning: new Date('July 7, 2020'),
    title: 'Joined IXL Learning',
    description: `I work as a Software Engineer on IXL Learning's Student Experience team — creating attractive interfaces for student practice and awards, writing performant Java services, and more.`,
  },
  {
    beginning: new Date('May 10, 2020'),
    title: 'Graduated from Duke University',
    description: `Graduated Magna Cum Laude with a B.S. in Computer Science and minors in German and Philosophy. Also played trombone in the Duke University Marching Band (yes, we're D.U.M.B).`,
    location: 'Durham, NC',
  },
  {
    beginning: new Date('September 1, 2019'),
    end: new Date('December 1, 2020'),
    title: 'Real Python Video Tutorial Creator',
    description: (
      <span>
        I created video tutorials on Python for{' '}
        <a href="https://www.realpython.com" target="_blank" rel="noreferrer">
          realpython.com
        </a>
        . My videos have been watched by thousands of Python learners and
        receive consistently great reviews (watch{' '}
        <a
          href="https://realpython.com/team/lwpulsifer/"
          target="_blank"
          rel="noreferrer"
        >
          here
        </a>
        ).
      </span>
    ),
  },
  {
    beginning: new Date('May 17, 2019'),
    title: 'Spent the Summer in Berlin',
    description: `An amazing time exploring Berlin, plus visits to London, Rotterdam, Madrid, Salamanca, and Stockholm.`,
    location: 'Europe writ large',
  },
  {
    beginning: new Date('January 7, 2018'),
    end: new Date('May 10, 2020'),
    title: 'Undergraduate Teaching Assistant',
    description: `TA for introductory programming and computer architecture courses at Duke. Taught weekly recitation sections, held office hours, and answered student questions.`,
  },
  {
    beginning: new Date('August 18, 2016'),
    title: 'Started at Duke University',
    description: '',
    location: 'Durham, NC',
  },
  {
    beginning: new Date('September 4, 1997'),
    title: 'Born',
    description: 'That was exciting!',
    location: 'Lexington, VA',
  },
]

const INITIAL_COUNT = 5
const INCREMENT = 3

function formatDate(d: Date) {
  return d.toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  })
}

function About() {
  const [visible, setVisible] = useState(INITIAL_COUNT)

  const sorted = [...events].sort(
    (a, b) => b.beginning.getTime() - a.beginning.getTime(),
  )
  const shown = sorted.slice(0, visible)
  const hasMore = visible < sorted.length

  return (
    <main className="page-wrap px-4 pb-12 pt-14">
      <section className="island-shell rounded-2xl p-6 sm:p-8">
        <p className="island-kicker mb-2">About Me</p>
        <h1 className="display-title mb-6 text-4xl font-bold text-[var(--text)] sm:text-5xl">
          Personal Timeline
        </h1>

        <ol className="relative space-y-0">
          {shown.map((event, i) => (
            <li key={event.title} className="flex gap-5">
              {/* Left column: timeline line + dot */}
              <div className="flex flex-col items-center">
                <div className="mt-1 h-3 w-3 shrink-0 rounded-full bg-[var(--blue)] ring-2 ring-[var(--bg)]" />
                {i < shown.length - 1 && (
                  <div className="mt-1 w-px flex-1 bg-[var(--border)]" />
                )}
              </div>

              {/* Right column: content */}
              <div className="min-w-0 flex-1 pb-8">
                <div className="mb-1 flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                  <span className="text-xs font-semibold text-[var(--accent)]">
                    {formatDate(event.beginning)}
                    {event.end ? ` → ${formatDate(event.end)}` : ''}
                  </span>
                  {event.location && (
                    <span className="text-xs text-[var(--text-muted)]">
                      {event.location}
                    </span>
                  )}
                </div>
                <h3 className="m-0 text-base font-semibold text-[var(--text)]">
                  {event.title}
                </h3>
                {event.description && (
                  <p className="mt-1.5 text-sm leading-relaxed text-[var(--text-muted)]">
                    {event.description}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>

        {(hasMore || visible > INITIAL_COUNT) && (
          <div className="mt-2 flex items-center gap-3">
            {hasMore && (
              <button
                onClick={() => setVisible((v) => v + INCREMENT)}
                className="rounded-full border border-[var(--chip-border)] bg-[var(--chip-bg)] px-4 py-1.5 text-sm font-semibold text-[var(--blue-deep)] transition hover:-translate-y-0.5"
              >
                Show more
              </button>
            )}
            {visible > INITIAL_COUNT && (
              <button
                onClick={() => {
                  setVisible(INITIAL_COUNT)
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
                className="text-sm text-[var(--text-muted)] underline"
              >
                Collapse
              </button>
            )}
          </div>
        )}
      </section>
    </main>
  )
}
