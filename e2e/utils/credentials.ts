// Keep e2e test credentials centralized so global setup/teardown and specs stay in sync.

export const ADMIN_EMAIL = 'e2e-admin@example.com'
export const ADMIN_PASSWORD = 'e2e-test-password-123!'

// Use a separate user for auth page tests so logging in/out in parallel
// can't invalidate the admin session used by authenticated fixtures.
export const AUTH_EMAIL = 'e2e-auth@example.com'
export const AUTH_PASSWORD = 'e2e-auth-password-123!'

