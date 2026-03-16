import { test, expect } from '@playwright/test'
import { ensureHydrated, fillStable } from '../utils/ui'
import { AUTH_EMAIL, AUTH_PASSWORD } from '../utils/credentials'

test.describe('login page', () => {
  test('shows the sign-in form', async ({ page }) => {
    await page.goto('/login')
    await ensureHydrated(page)
    await expect(page.getByTestId('login-email')).toBeVisible()
    await expect(page.getByTestId('login-password')).toBeVisible()
    await expect(page.getByTestId('login-submit')).toBeVisible()
  })

  test('shows an error for invalid credentials', async ({ page }) => {
    await page.goto('/login')
    await ensureHydrated(page)
    await fillStable(page.getByTestId('login-email'), 'nobody@example.com')
    await fillStable(page.getByTestId('login-password'), 'wrongpassword')
    await page.getByTestId('login-submit').click()
    await expect(page.getByTestId('login-error')).toBeVisible()
    await expect(page.getByTestId('login-error')).toContainText(/invalid/i)
  })

  test('redirects to home on successful login', async ({ page }) => {
    await page.goto('/login')
    await ensureHydrated(page)
    await fillStable(page.getByTestId('login-email'), AUTH_EMAIL, 15_000)
    await fillStable(page.getByTestId('login-password'), AUTH_PASSWORD, 15_000)
    await page.getByTestId('login-submit').click()
    await expect(page).toHaveURL('/', { timeout: 20_000 })
  })

  test('shows admin controls after login', async ({ page }) => {
    await page.goto('/login')
    await ensureHydrated(page)
    await fillStable(page.getByTestId('login-email'), AUTH_EMAIL, 15_000)
    await fillStable(page.getByTestId('login-password'), AUTH_PASSWORD, 15_000)
    await page.getByTestId('login-submit').click()
    await expect(page).toHaveURL('/', { timeout: 20_000 })
    await page.goto('/blog')
    await ensureHydrated(page)
    await expect(page.getByTestId('new-post-btn')).toBeVisible()
  })
})

test.describe('logout', () => {
  test('visiting /logout clears the session', async ({ page }) => {
    await page.goto('/login')
    await ensureHydrated(page)
    await fillStable(page.getByTestId('login-email'), AUTH_EMAIL, 15_000)
    await fillStable(page.getByTestId('login-password'), AUTH_PASSWORD, 15_000)
    await page.getByTestId('login-submit').click()
    await expect(page).toHaveURL('/', { timeout: 20_000 })

    // Wait for the async signOut() to finish before navigating away
    await page.goto('/logout')
    await expect(page.getByTestId('signed-out-msg')).toBeVisible()

    await page.goto('/blog')
    await ensureHydrated(page)
    await expect(page.getByTestId('new-post-btn')).toHaveCount(0)
  })
})
