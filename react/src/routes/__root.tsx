import { QueryClientProvider } from '@tanstack/react-query'
import {
  createRootRoute,
  HeadContent,
  Link,
  Scripts,
} from '@tanstack/react-router'
import { lazy, Suspense, useEffect } from 'react'
import Footer from '../components/Footer'
import Header from '../components/Header'
import { AuthProvider } from '../lib/auth'
import { SITE_DESCRIPTION, SITE_TITLE } from '../lib/site'
import { queryClient } from '../router'
import { getServerUser } from '../server/auth'

import appCss from '../styles.css?url'

const THEME_INIT_SCRIPT = `(function(){try{var prefersDark=window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.style.colorScheme=prefersDark?'dark':'light';}catch(e){}})();`

// Dev-only tooling, loaded lazily so the `import()` never enters the
// production bundle at all — every visitor was previously shipping the
// devtools panel on every page load. import.meta.env.DEV is a build-time
// constant, so Vite dead-code-eliminates this whole branch in production.
const TanStackDevtools = import.meta.env.DEV
  ? lazy(() =>
      import('@tanstack/react-devtools').then((m) => ({
        default: m.TanStackDevtools,
      })),
    )
  : null

const TanStackRouterDevtoolsPanel = import.meta.env.DEV
  ? lazy(() =>
      import('@tanstack/react-router-devtools').then((m) => ({
        default: m.TanStackRouterDevtoolsPanel,
      })),
    )
  : null

export const Route = createRootRoute({
  loader: async () => {
    try {
      const user = await getServerUser()
      return { user }
    } catch {
      return { user: null }
    }
  },
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: SITE_TITLE,
      },
      {
        name: 'description',
        content: SITE_DESCRIPTION,
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
      {
        rel: 'icon',
        type: 'image/png',
        href: '/favicon.png',
      },
    ],
  }),
  notFoundComponent: NotFound,
  shellComponent: RootDocument,
})

function NotFound() {
  return (
    <main className="page-wrap flex min-h-[calc(100dvh-8rem)] items-center justify-center px-4 py-16">
      <div className="island-shell rise-in w-full max-w-sm rounded-[2rem] px-8 py-10 text-center">
        <p className="island-kicker mb-3">404</p>
        <h1 className="display-title mb-4 text-2xl font-bold text-[var(--text)]">
          Page not found
        </h1>
        <p className="mb-8 text-sm text-[var(--text-muted)]">
          There's nothing here.
        </p>
        <Link
          to="/"
          className="rounded-full border border-[rgba(37,99,235,0.3)] bg-[rgba(59,130,246,0.1)] px-5 py-2.5 text-sm font-semibold text-[var(--blue-deep)] no-underline transition hover:-translate-y-0.5 hover:bg-[rgba(59,130,246,0.18)]"
        >
          Back to home
        </Link>
      </div>
    </main>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  const { user } = Route.useLoaderData()

  // Playwright can race React hydration on fast machines / slow dev servers.
  // This marker lets e2e tests wait until client-side event handlers are attached.
  useEffect(() => {
    document.body.dataset.hydrated = 'true'
  }, [])

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: trusted static theme init script */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <HeadContent />
      </head>
      <body className="font-sans antialiased [overflow-wrap:anywhere] selection:bg-[rgba(59,130,246,0.24)]">
        <QueryClientProvider client={queryClient}>
          <AuthProvider initialUser={user}>
            <Header />
            <div className="flex-1">{children}</div>
            <Footer />
          </AuthProvider>
        </QueryClientProvider>
        {TanStackDevtools && TanStackRouterDevtoolsPanel && (
          <Suspense fallback={null}>
            <TanStackDevtools
              config={{
                position: 'bottom-right',
              }}
              plugins={[
                {
                  name: 'Tanstack Router',
                  render: <TanStackRouterDevtoolsPanel />,
                },
              ]}
            />
          </Suspense>
        )}
        <Scripts />
      </body>
    </html>
  )
}
