import { test, expect } from '@playwright/test'

test('sitemap.xml returns valid XML with expected URLs', async ({ request }) => {
  const response = await request.get('/sitemap.xml')

  expect(response.status()).toBe(200)
  expect(response.headers()['content-type']).toContain('application/xml')

  const body = await response.text()

  expect(body).toContain('<?xml version="1.0"')
  expect(body).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"')

  // Static pages
  expect(body).toContain('https://liampulsifer.com/')
  expect(body).toContain('https://liampulsifer.com/blog')
  expect(body).toContain('https://liampulsifer.com/fun')

  // Should include exactly the 2 published seed posts (not the draft)
  const blogPostUrls = body.match(/https:\/\/liampulsifer\.com\/blog\/[\w-]+/g) ?? []
  expect(blogPostUrls).toHaveLength(2)
  expect(body).toContain('https://liampulsifer.com/blog/hello-world')
  expect(body).toContain('https://liampulsifer.com/blog/second-post')
  expect(body).not.toContain('https://liampulsifer.com/blog/draft-post')
})
