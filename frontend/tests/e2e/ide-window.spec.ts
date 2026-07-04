import { test, expect } from '@playwright/test'

test.describe('IDE Window - US1', () => {
  test('loads IDE page with file tree', async ({ page }) => {
    await page.goto('/ide/test-project')
    await expect(page.getByRole('toolbar', { name: 'Activity Bar' })).toBeVisible()
    await expect(page.getByText('agentii.md')).toBeVisible()
  })

  test('clicking file opens tab and renders content', async ({ page }) => {
    await page.goto('/ide/test-project')
    await page.getByText('agentii.md').click()
    await expect(page.getByText('Agentii Project')).toBeVisible()
  })

  test('clicking csv file opens table viewer', async ({ page }) => {
    await page.goto('/ide/test-project')
    await page.getByText('data.csv').click()
    await expect(page.getByText('Date')).toBeVisible()
    await expect(page.getByText('Ticker')).toBeVisible()
  })

  test('multiple tabs can be opened and switched', async ({ page }) => {
    await page.goto('/ide/test-project')
    await page.getByText('agentii.md').click()
    await page.getByText('config.json').click()
    await expect(page.getByText('agentii.md').first()).toBeVisible()
    await expect(page.getByText('config.json').first()).toBeVisible()
  })

  test('close tab removes it', async ({ page }) => {
    await page.goto('/ide/test-project')
    await page.getByText('agentii.md').click()
    await page.getByLabel('Close tab').click()
    await expect(page.getByText('Open a file from the file tree')).toBeVisible()
  })

  test('activity bar switches side panels', async ({ page }) => {
    await page.goto('/ide/test-project')
    await page.getByLabel('Search').click()
    await expect(page.getByPlaceholder('Search files...')).toBeVisible()
  })
})
