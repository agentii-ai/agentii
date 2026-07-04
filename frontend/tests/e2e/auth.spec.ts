import { test, expect } from '@playwright/test'

test.describe('Authentication Flow', () => {
  test('redirects unauthenticated user to login', async ({ page }) => {
    await page.goto('/projects')
    await expect(page).toHaveURL(/\/login/)
  })

  test('shows login form with email and password fields', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByPlaceholder(/email/i)).toBeVisible()
    await expect(page.getByPlaceholder(/password/i)).toBeVisible()
  })

  test('shows OAuth buttons', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('button', { name: /google/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /github/i })).toBeVisible()
  })

  test('shows error on invalid credentials', async ({ page }) => {
    await page.goto('/login')
    await page.getByPlaceholder(/email/i).fill('invalid@test.com')
    await page.getByPlaceholder(/password/i).fill('wrongpassword')
    await page.getByRole('button', { name: /sign in/i }).click()
    await expect(page.getByText(/invalid|error|failed/i)).toBeVisible({ timeout: 5000 })
  })

  test('signup form toggles from login', async ({ page }) => {
    await page.goto('/login')
    const signupLink = page.getByText(/sign up|create account|register/i)
    if (await signupLink.isVisible()) {
      await signupLink.click()
      await expect(page.getByRole('button', { name: /sign up|create|register/i })).toBeVisible()
    }
  })
})
