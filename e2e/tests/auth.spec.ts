import { test, expect } from '@playwright/test'

const TEST_EMAIL = 'e2e-admin@example.com'
const TEST_PASSWORD = 'e2e-test-password-123!'

test.describe('login page', () => {
  test('shows the sign-in form', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByLabel('Email')).toBeVisible()
    await expect(page.getByLabel('Password')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
  })

  test('shows an error for invalid credentials', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill('nobody@example.com')
    await page.getByLabel('Password').fill('wrongpassword')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByText(/invalid login credentials/i)).toBeVisible()
  })

  test('redirects to home on successful login', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill(TEST_EMAIL)
    await page.getByLabel('Password').fill(TEST_PASSWORD)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL('/')
  })

  test('shows admin controls after login', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill(TEST_EMAIL)
    await page.getByLabel('Password').fill(TEST_PASSWORD)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL('/')
    await page.goto('/blog')
    await expect(page.getByRole('button', { name: '+ New Post' })).toBeVisible()
  })
})

test.describe('logout', () => {
  test('visiting /logout clears the session', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill(TEST_EMAIL)
    await page.getByLabel('Password').fill(TEST_PASSWORD)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL('/')

    // Wait for the async signOut() to finish before navigating away
    await page.goto('/logout')
    await expect(page.getByText("You're signed out")).toBeVisible()

    await page.goto('/blog')
    await expect(page.getByRole('button', { name: '+ New Post' })).not.toBeVisible()
  })
})
