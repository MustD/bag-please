import {expect, test} from '@playwright/test'

test('unauthenticated user visiting / is redirected to /auth', async ({page}) => {
  await page.goto('/')
  await expect(page).toHaveURL('/auth')
})

test('valid login redirects to / and shows UserChip', async ({page}) => {
  await page.goto('/auth')
  await page.fill('#username', 'admin')
  await page.fill('#password', 'admin')
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL('/')
  await expect(page.getByRole('banner').getByText('admin')).toBeVisible()
})

test('invalid login shows error below password field', async ({page}) => {
  await page.goto('/auth')
  await page.fill('#username', 'admin')
  await page.fill('#password', 'wrongpassword')
  await page.click('button[type="submit"]')
  await expect(page.locator('#password-helper-text')).toBeVisible()
  await expect(page).toHaveURL('/auth')
})

test('registration with new username auto-logs in and shows WelcomeBanner', async ({page}) => {
  const uniqueUser = `testuser_${Date.now()}`
  await page.goto('/auth/register')
  await page.fill('#username', uniqueUser)
  await page.fill('#password', 'password123')
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL('/')
  await expect(page.locator('text=You now have your own account')).toBeVisible()
})

test('registration with taken username shows error below username field', async ({page}) => {
  await page.goto('/auth/register')
  await page.fill('#username', 'admin')
  await page.fill('#password', 'anypassword')
  await page.click('button[type="submit"]')
  await expect(page.locator('#username-helper-text')).toBeVisible()
  await expect(page.locator('#username-helper-text')).toContainText('Invalid credentials')
})

test('session expiry alert is visible when ?expired=1', async ({page}) => {
  await page.goto('/auth?expired=1')
  await expect(page.locator('text=session has expired')).toBeVisible()
})
