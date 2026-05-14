import {expect, test} from '@playwright/test'
import path from 'path'

test.use({storageState: path.join(__dirname, '.auth/user.json')})

test('logout redirects to /auth and subsequent navigation redirects back', async ({page}) => {
  await page.goto('/')
  await expect(page).toHaveURL('/')

  await page.locator('button[aria-haspopup="true"]').click()
  await page.locator('[aria-label="logout"]').click()
  await expect(page).toHaveURL('/auth')

  await page.goto('/')
  await expect(page).toHaveURL('/auth')
})
