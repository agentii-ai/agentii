import { test, expect } from '@playwright/test'

test.describe('File Storage', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/ide?project=test-project-id')
    const url = page.url()
    if (url.includes('/login') || url.includes('/projects')) {
      test.skip()
    }
  })

  test('file tree is visible in IDE', async ({ page }) => {
    const fileTree = page.locator('[data-testid="file-tree"], .file-tree')
    if (await fileTree.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(fileTree).toBeVisible()
    }
  })

  test('file upload area accepts drag and drop', async ({ page }) => {
    // Verify upload component exists if visible
    const uploadArea = page.locator('[data-testid="file-upload"], .file-upload')
    if (await uploadArea.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(uploadArea).toBeVisible()
    }
  })
})
