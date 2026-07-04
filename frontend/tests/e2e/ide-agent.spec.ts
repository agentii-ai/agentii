import { test, expect } from '@playwright/test'

test.describe('IDE Terminal Panel - US2', () => {
  test('terminal panel toggles with button', async ({ page }) => {
    await page.goto('/ide/test-project')
    // Terminal panel is hidden by default
    await expect(page.getByLabel('Minimize terminal panel')).not.toBeVisible()
    // Toggle it on
    await page.getByLabel('Toggle Terminal').click()
    await expect(page.getByLabel('Minimize terminal panel')).toBeVisible()
    await expect(page.getByText('Terminal')).toBeVisible()
  })

  test('terminal panel toggles with Cmd+J', async ({ page }) => {
    await page.goto('/ide/test-project')
    await page.keyboard.press('Meta+j')
    await expect(page.getByText('Terminal')).toBeVisible()
    await page.keyboard.press('Meta+j')
    await expect(page.getByLabel('Minimize terminal panel')).not.toBeVisible()
  })

  test('terminal panel shows xterm container', async ({ page }) => {
    await page.goto('/ide/test-project')
    await page.getByLabel('Toggle Terminal').click()
    // xterm.js renders into a div with class xterm
    await expect(page.locator('.xterm')).toBeVisible()
  })

  test('minimize button hides terminal panel', async ({ page }) => {
    await page.goto('/ide/test-project')
    await page.getByLabel('Toggle Terminal').click()
    await expect(page.getByText('Terminal')).toBeVisible()
    await page.getByLabel('Minimize terminal panel').click()
    await expect(page.getByLabel('Minimize terminal panel')).not.toBeVisible()
  })
})
