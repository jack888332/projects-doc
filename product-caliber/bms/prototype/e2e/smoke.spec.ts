import { expect, test, type Page } from '@playwright/test'

const runtimeErrors = (page: Page) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  return errors
}

const openRoute = async (page: Page, path: string) => {
  const errors = runtimeErrors(page)
  await page.goto(`/#${path}`)
  await expect(page.locator('#app')).toBeVisible()
  await expect(page.locator('.workspace')).toBeVisible()
  await page.waitForLoadState('networkidle')
  expect(errors).toEqual([])
}

test('共享组件陈列页可用', async ({ page }) => {
  await openRoute(page, '/__dev/ui')
  await expect(page.getByRole('heading', { name: '条件筛选与按钮' })).toBeVisible()
  await expect(page.locator('.data-table-frame')).toBeVisible()
})

for (const route of [
  { name: '营收总览', path: '/billing/revenue-overview' },
  { name: '应收账单', path: '/billing/receivable-bills' },
  { name: '返款账单', path: '/billing/refund-bills' },
  { name: '回款管理', path: '/billing/remittance' },
  { name: '生成任务', path: '/billing/tasks' },
  { name: '成本总览', path: '/cost/overview' },
]) {
  test(`${route.name}关键路由可用`, async ({ page }) => {
    await openRoute(page, route.path)
    await expect(page).toHaveURL(new RegExp(`#${route.path.replaceAll('/', '\\/')}$`))
    await expect(page.getByText(route.name, { exact: true }).first()).toBeVisible()
    await expect(page.locator('.data-table-frame').first()).toBeVisible()
  })
}
