import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { QueryClientProvider } from '@tanstack/react-query'
import { useEffect } from 'react'
import Footer from '../components/Footer'
import Header from '../components/Header'
import { AuthProvider } from '../lib/auth'
import { getServerUser } from '../server/auth'
import { queryClient } from '../router'
import { SITE_DESCRIPTION, SITE_TITLE } from '../lib/site'

import appCss from '../styles.css?url'

const THEME_INIT_SCRIPT = `(function(){try{var prefersDark=window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.style.colorScheme=prefersDark?'dark':'light';}catch(e){}})();`

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
  shellComponent: RootDocument,
})

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
        <Scripts />
      </body>
    </html>
  )
}
