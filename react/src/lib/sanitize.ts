import sanitizeHtml from 'sanitize-html'

export function sanitize(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      ...sanitizeHtml.defaults.allowedTags,
      'img',
      'h1',
      'h2',
      'span',
    ],
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      '*': ['class'],
      a: ['href', 'target', 'rel'],
      img: ['src', 'alt', 'class', 'width', 'height'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
  })
}
