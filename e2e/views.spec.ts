import { test, expect, _electron as electron } from '@playwright/test'

test('calendar views: week/month/day, visibility toggle, screenshots', async () => {
  const app = await electron.launch({ args: ['.'], env: { ...process.env, MULTICALS_MOCK: '1' } })
  const page = await app.firstWindow()
  await page.setViewportSize({ width: 1200, height: 800 })
  // Screenshots capture web contents only, not the native vibrancy behind the transparent sidebar.
  // Paint a stand-in so the shots resemble the real window.
  await page.addStyleTag({
    content: 'html{background:#ebe9ec}@media (prefers-color-scheme:dark){html{background:#2c2b2f}}'
  })
  const blocks = page.getByTestId('event-block')

  // Week view (default) shows events from both isolated accounts.
  await expect(page.getByTestId('view-switch-week')).toHaveAttribute('aria-selected', 'true')
  await expect(blocks.filter({ hasText: 'Daily standup' }).first()).toBeVisible()
  await expect(blocks.filter({ hasText: 'Gym' })).toHaveCount(1)
  await expect(page.locator('[data-testid="event-block"][data-account-id="work"]').first()).toBeAttached()
  await expect(page.locator('[data-testid="event-block"][data-account-id="personal"]').first()).toBeAttached()
  await expect(page.getByTestId('sidebar-account-work')).toContainText('me@work.example')
  await expect(page.getByTestId('sidebar-account-personal')).toContainText('Holidays')
  await expect(page.getByTestId('sidebar-account-work')).not.toContainText('Holidays')
  await page.screenshot({ path: 'e2e/screens/unit6-week.png' })

  await page.getByTestId('view-switch-month').click()
  await expect(page.locator('.mg-cell')).toHaveCount(42)
  await expect(blocks.filter({ hasText: 'Sprint planning' })).toHaveCount(1)
  await page.screenshot({ path: 'e2e/screens/unit6-month.png' })

  await page.getByTestId('view-switch-day').click()
  await expect(page.locator('.tg-col')).toHaveCount(1)
  await expect(blocks.filter({ hasText: 'Gym' })).toHaveCount(1)
  await page.keyboard.press('ArrowRight')
  await expect(blocks.filter({ hasText: 'Gym' })).toHaveCount(0)
  await page.keyboard.press('t')
  await expect(blocks.filter({ hasText: 'Gym' })).toHaveCount(1)

  // Hiding the personal calendar removes only its events.
  await page.getByTestId('view-switch-week').click()
  await page.getByTestId('sidebar-calendar-personal-p-main').uncheck()
  await expect(blocks.filter({ hasText: 'Gym' })).toHaveCount(0)
  await expect(blocks.filter({ hasText: 'Daily standup' }).first()).toBeVisible()
  await page.getByTestId('sidebar-calendar-personal-p-main').check()
  await expect(blocks.filter({ hasText: 'Gym' })).toHaveCount(1)

  // emulateMedia flips CSS only; themeSource also darkens the native sidebar vibrancy.
  await app.evaluate(({ nativeTheme }) => { nativeTheme.themeSource = 'dark' })
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.waitForTimeout(300)
  await page.screenshot({ path: 'e2e/screens/unit6-dark.png' })
  await app.close()
})
