import {expect, test} from '@playwright/test'
import path from 'path'

test.use({storageState: path.join(__dirname, '.auth/user.json')})

let originalRegistrationEnabled = true

async function getAccessToken(page: import('@playwright/test').Page) {
  const res = await page.request.post('/api/auth/refresh')
  const {accessToken} = await res.json()
  return accessToken as string
}

async function setRegistrationViaApi(page: import('@playwright/test').Page, enabled: boolean) {
  const accessToken = await getAccessToken(page)
  await page.request.post('/api/graphql', {
    headers: {'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json'},
    data: JSON.stringify({
      query: `mutation { setRegistrationEnabled(enabled: ${enabled}) { registrationEnabled } }`,
    }),
  })
}

test.beforeAll(async ({browser}) => {
  const ctx = await browser.newContext({
    storageState: path.join(__dirname, '.auth/user.json'),
  })
  try {
    const p = await ctx.newPage()
    const accessToken = await getAccessToken(p)
    const configRes = await p.request.get('/api/auth/config', {
      headers: {'Authorization': `Bearer ${accessToken}`},
    })
    const config = await configRes.json()
    originalRegistrationEnabled = config.registrationEnabled
  } finally {
    await ctx.close()
  }
})

test.afterAll(async ({browser}) => {
  const ctx = await browser.newContext({
    storageState: path.join(__dirname, '.auth/user.json'),
  })
  try {
    const p = await ctx.newPage()
    await setRegistrationViaApi(p, originalRegistrationEnabled)
  } finally {
    await ctx.close()
  }
})

test('disable registration — login screen shows "Contact your admin" and no Register link', async ({page}) => {
  // Set known precondition via API
  await setRegistrationViaApi(page, true)

  await page.goto('/admin/users')

  // Wait for Apollo query to load (switch becomes enabled)
  const regSwitch = page.getByLabel('Allow public registration')
  await expect(regSwitch).not.toBeDisabled()
  await expect(regSwitch).toBeChecked()

  // Toggle OFF and wait for mutation to commit server-side
  const mutationDone = page.waitForResponse(r => r.url().includes('/api/graphql') && r.status() === 200)
  await page.getByLabel('Allow public registration').click()
  await mutationDone
  await expect(regSwitch).not.toBeChecked()

  await page.goto('/auth')
  await expect(page.getByText('Contact your admin to get access')).toBeVisible()
  await expect(page.getByRole('link', {name: 'Register'})).not.toBeVisible()
})

test('enable registration — login screen shows Register link and no "Contact your admin"', async ({page}) => {
  // Set known precondition via API
  await setRegistrationViaApi(page, false)

  await page.goto('/admin/users')

  // Wait for Apollo query to load (switch becomes enabled)
  const regSwitch = page.getByLabel('Allow public registration')
  await expect(regSwitch).not.toBeDisabled()
  await expect(regSwitch).not.toBeChecked()

  // Toggle ON and wait for mutation to commit server-side
  const mutationDone = page.waitForResponse(r => r.url().includes('/api/graphql') && r.status() === 200)
  await page.getByLabel('Allow public registration').click()
  await mutationDone
  await expect(regSwitch).toBeChecked()

  await page.goto('/auth')
  await expect(page.getByRole('link', {name: 'Register'})).toBeVisible()
  await expect(page.getByText('Contact your admin to get access')).not.toBeVisible()
})
