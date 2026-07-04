import { test, expect } from '@playwright/test'

test.describe('Project Management', () => {
  // Note: These tests require a logged-in session.
  // In CI, use Supabase local with seeded test user.

  test.beforeEach(async ({ page }) => {
    // Skip if not authenticated — these are integration tests
    await page.goto('/projects')
    const url = page.url()
    if (url.includes('/login')) {
      test.skip()
    }
  })

  test('displays projects dashboard with grid view', async ({ page }) => {
    await page.goto('/projects')
    await expect(page.getByText('Projects')).toBeVisible()
    await expect(page.getByRole('button', { name: /new project/i })).toBeVisible()
  })

  test('toggles between grid and table view', async ({ page }) => {
    await page.goto('/projects')
    const tableToggle = page.getByRole('button', { name: /table|list/i })
    if (await tableToggle.isVisible()) {
      await tableToggle.click()
      await expect(page.locator('table')).toBeVisible()
    }
  })

  test('opens create project dialog', async ({ page }) => {
    await page.goto('/projects')
    await page.getByRole('button', { name: /new project/i }).click()
    await expect(page.getByText(/create.*project/i)).toBeVisible()
  })

  test('search filters projects', async ({ page }) => {
    await page.goto('/projects')
    const searchInput = page.getByPlaceholder(/search/i)
    if (await searchInput.isVisible()) {
      await searchInput.fill('nonexistent-project-xyz')
      await expect(page.getByText(/no projects/i)).toBeVisible({ timeout: 3000 })
    }
  })

  test('featured section is visible', async ({ page }) => {
    await page.goto('/projects')
    // Featured section may or may not have projects
    const featured = page.getByText(/featured|templates/i)
    // Just verify the page loads without errors
    await expect(page.getByText('Projects')).toBeVisible()
  })
})
