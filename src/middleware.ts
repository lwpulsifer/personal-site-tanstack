// Server middleware chain: (event, next) => Response, fronting every request
// (page renders, server functions, API routes). Runs before render, so this is
// the place for response headers.
import type { StartMiddleware } from '@solidjs/vite-plugin'
import { createAPIHandler } from 'filesystem-routing/api'
import routes from 'virtual:file-routes'

// Published posts are immutable-ish: cache them like the React app's
// route-level `headers` did. A 200 here means the post is published (drafts 404).
const cachePublishedPosts: StartMiddleware = async (event, next) => {
  const res = await next()
  const { pathname } = new URL(event.request.url)
  if (res.status === 200 && /^\/blog\/[^/]+\/?$/.test(pathname)) {
    const headers = new Headers(res.headers)
    headers.set('cache-control', 'public, max-age=604800, s-maxage=604800')
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers })
  }
  return res
}

// createAPIHandler serves GET/POST/... exports of route modules (sitemap.xml,
// rss.xml) and passes everything else down the chain.
export default [createAPIHandler(routes), cachePublishedPosts] satisfies StartMiddleware[]
