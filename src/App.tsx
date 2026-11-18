import type { JSX } from '@solidjs/web'
import { Loading, onSettled } from 'solid-js'
import Footer from './components/Footer'
import Header from './components/Header'
import { AuthProvider } from './lib/auth'
import { useNavigationState } from './lib/navigation'
import { Router } from './router'
import './styles.css'

// Dims the old page while the next route is loading (the router holds it on
// screen until its data settles), so the click visibly did something.
function RouteContent(props: { children: JSX.Element }) {
  const nav = useNavigationState()
  return (
    <div
      data-testid="route-content"
      class="route-content flex-1"
      aria-busy={nav.isRouting() ? 'true' : 'false'}
    >
      {props.children}
    </div>
  )
}

export default function App() {
  // Playwright can race hydration; this marker lets e2e tests wait until
  // client-side handlers are attached (same contract as the React app).
  onSettled(() => {
    document.body.dataset.hydrated = 'true'
  })

  return (
    <Router>
        {(props) => (
          <Loading fallback={<main class="page-wrap px-4 pt-14">Loading…</main>}>
            <AuthProvider>
              <Header />
              <RouteContent>{props.children}</RouteContent>
              <Footer />
            </AuthProvider>
          </Loading>
        )}
    </Router>
  )
}
