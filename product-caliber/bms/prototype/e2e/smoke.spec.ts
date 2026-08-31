import { expect, test, type Page } from '@playwright/test'
import { UI_DEFAULTS } from '../src/shared/config/uiDefaults.js'

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

test('行操作菜单无需 hover 即可通过键盘打开', async ({ page }) => {
  await openRoute(page, '/billing/receivable-bills')
  const menuButton = page.getByRole('button', { name: '更多操作' }).first()
  await menuButton.focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('.row-action-popper:visible')).toBeVisible()
})

test('列表列宽按内容适配并仅在最大宽度后截断', async ({ page }) => {
  await openRoute(page, '/billing/revenue-overview')
  const table = page.locator('.receivable-summary-table')
  const firstRowCells = table.locator('.el-table__body tr').first().locator('td')
  const customerCell = firstRowCells.nth(0).locator('.cell')
  const shopCell = firstRowCells.nth(1).locator('.cell')

  await expect.poll(() => customerCell.evaluate((cell) => cell.closest('td')?.getBoundingClientRect().width)).toBe(260)
  await expect.poll(() => shopCell.evaluate((cell) => cell.scrollWidth <= cell.clientWidth)).toBe(true)
  expect(await customerCell.evaluate((cell) => {
    const range = document.createRange()
    range.selectNodeContents(cell)
    const style = getComputedStyle(cell)
    const availableTextWidth = cell.clientWidth
      - Number.parseFloat(style.paddingLeft)
      - Number.parseFloat(style.paddingRight)
    return range.getBoundingClientRect().width > availableTextWidth
  })).toBe(true)
})

test('账单配置费项规则保留宽弹窗和声明的最小列宽', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await openRoute(page, '/billing/config')
  await page.getByRole('button', { name: '新建配置' }).click()

  const dialog = page.locator('.module-dialog-wide')
  const matrix = dialog.locator('.matrix-wrap').first()
  await expect(dialog).toBeVisible()
  await matrix.getByRole('button', { name: '添加' }).click()

  await expect.poll(() => dialog.evaluate((element) => element.getBoundingClientRect().width)).toBeGreaterThan(960)
  await expect.poll(() => matrix.evaluate((element) => element.getBoundingClientRect().width)).toBeGreaterThan(400)

  const table = matrix.locator('.el-table')
  const feeHeader = table.getByRole('columnheader', { name: '费项', exact: true })
  const currencyHeader = table.getByRole('columnheader', { name: '结算币种', exact: true })
  await expect.poll(() => feeHeader.evaluate((element) => element.getBoundingClientRect().width)).toBeGreaterThanOrEqual(180)
  await expect.poll(() => currencyHeader.evaluate((element) => element.getBoundingClientRect().width)).toBeGreaterThanOrEqual(180)
})

for (const viewport of UI_DEFAULTS.verification.viewports) {
  test(`${viewport.name}共享布局不产生页面级横向溢出`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await openRoute(page, '/billing/revenue-overview')

    await expect(page.locator('html')).toHaveAttribute(
      'data-ui-layout',
      viewport.width <= UI_DEFAULTS.viewport.narrowMaxWidth ? 'narrow' : 'wide',
    )
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true)
    await expect(page.locator('.data-table-frame').first()).toBeVisible()
  })
}

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
