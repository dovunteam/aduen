import { expect, test } from '@playwright/test'

for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
  for (const locale of ['en', 'ms'] as const) {
    test(`core layouts fit ${viewport.width}px in ${locale}`, async ({ page }, testInfo) => {
      await page.setViewportSize(viewport)
      await page.goto('/')
      if (locale === 'ms') await page.getByRole('button', { name: 'BM', exact: true }).click()
      const checkLayout = async (name: string) => {
        await expect(page.locator('h1')).toBeVisible()
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
        await page.screenshot({ path: testInfo.outputPath(`${name}.png`), fullPage: true, animations: 'disabled' })
      }
      await checkLayout('welcome')
      await page.getByRole('link', { name: locale === 'en' ? 'Organise your case' : 'Susun kes anda' }).click()
      await expect(page.getByRole('heading', { name: locale === 'en' ? 'Before you begin' : 'Sebelum anda bermula' })).toBeInViewport()
      await page.getByLabel(locale === 'en' ? /I understand Buktiva's role/ : /Saya memahami peranan Buktiva/).check()
      await page.getByRole('button', { name: locale === 'en' ? 'Begin safety check' : 'Mulakan semakan keselamatan' }).click()
      await checkLayout('safety')
      await page.getByRole('button', { name: locale === 'en' ? /No urgent issue/ : /Tiada isu mendesak/ }).click()
      await checkLayout('case-details')
    })
  }
}
