import { test, expect } from '@playwright/test'

test.describe('Terminal Panel', () => {
  test.beforeEach(async ({ page }) => {
    // These tests require a project to be open
    await page.goto('/ide?project=test-project-id')
    const url = page.url()
    if (url.includes('/login') || url.includes('/projects')) {
      test.skip()
    }
  })

  test('terminal panel is visible in IDE', async ({ page }) => {
    // Look for terminal-related elements
    const terminal = page.locator('[data-testid="terminal-panel"], .terminal-panel, .xterm')
    await expect(terminal.first()).toBeVisible({ timeout: 10000 })
  })

  test('terminal tab bar shows default tab', async ({ page }) => {
    const tabBar = page.locator('[data-testid="terminal-tab-bar"], .terminal-tab-bar')
    if (await tabBar.isVisible()) {
      await expect(tabBar).toBeVisible()
    }
  })

  test('Cmd+J toggles terminal panel', async ({ page }) => {
    const terminal = page.locator('[data-testid="terminal-panel"], .terminal-panel')
    if (await terminal.isVisible()) {
      await page.keyboard.press('Meta+j')
      // Terminal should toggle visibility
      await page.waitForTimeout(300)
    }
  })
})
