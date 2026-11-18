import { Loading, onSettled } from 'solid-js'
import Footer from './components/Footer'
import Header from './components/Header'
import { AuthProvider } from './lib/auth'
import { Router } from './router'
import './styles.css'

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
              <div class="flex-1">{props.children}</div>
              <Footer />
            </AuthProvider>
          </Loading>
        )}
    </Router>
  )
}
