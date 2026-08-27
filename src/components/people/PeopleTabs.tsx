import { Link } from '@tanstack/react-router'

const tabClassName =
  'rounded-full px-3 py-1 text-sm font-semibold text-[var(--text)] transition hover:bg-[var(--hover-bg)]'
const activeTabClassName =
  'rounded-full bg-[var(--blue-deep)] px-3 py-1 text-sm font-semibold text-white'

export function PeopleTabs() {
  return (
    <nav className="mb-4 flex gap-2">
      <Link
        to="/people"
        activeOptions={{ exact: true }}
        data-testid="people-tab-graph"
        className={tabClassName}
        activeProps={{ className: activeTabClassName }}
      >
        Graph
      </Link>
      <Link
        to="/people/quiz"
        data-testid="people-tab-quiz"
        className={tabClassName}
        activeProps={{ className: activeTabClassName }}
      >
        Quiz
      </Link>
    </nav>
  )
}
