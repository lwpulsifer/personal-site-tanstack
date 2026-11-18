import { Title } from '@solidjs/meta'
import type { RouteDefinition } from '@solidjs/router'
import { httpStatus } from '@solidjs/web'
import { NotFound } from '../components/NotFound'

// httpStatus() sets the response status during SSR (no-op in the browser).
export const route = {
  preload: () => httpStatus(404),
} satisfies RouteDefinition

export default function NotFoundRoute() {
  return (
    <>
      <Title>Not Found | Liam Pulsifer</Title>
      <NotFound />
    </>
  )
}
