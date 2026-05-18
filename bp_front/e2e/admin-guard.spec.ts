import {expect, test} from '@playwright/test'
import path from 'path'

test('non-admin user navigating to /admin/users is redirected to /', async ({browser}) => {
  const uniqueUser = `guardtest_${Date.now()}`

  // Obtain admin access token
  const adminCtx = await browser.newContext({
    storageState: path.join(__dirname, '.auth/user.json'),
  })
  const adminPage = await adminCtx.newPage()
  const tokenRes = await adminPage.request.post('/api/auth/refresh')
  const {accessToken} = await tokenRes.json()

  // Create a regular user via GraphQL
  await adminPage.request.post('/api/graphql', {
    headers: {'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json'},
    data: JSON.stringify({
      query: `mutation { createUser(username: "${uniqueUser}", password: "testpass123") { id } }`,
    }),
  })
  await adminCtx.close()

  // Login as the regular user
  const userCtx = await browser.newContext()
  const userPage = await userCtx.newPage()
  await userPage.request.post('/api/auth/login', {
    data: {username: uniqueUser, password: 'testpass123'},
  })

  await userPage.goto('/admin/users')
  await expect(userPage).toHaveURL('/')

  await userCtx.close()
})

test('non-admin user navigation menu does NOT show "User Management"', async ({browser}) => {
  const uniqueUser = `guardnav_${Date.now()}`

  // Obtain admin access token
  const adminCtx = await browser.newContext({
    storageState: path.join(__dirname, '.auth/user.json'),
  })
  const adminPage = await adminCtx.newPage()
  const tokenRes = await adminPage.request.post('/api/auth/refresh')
  const {accessToken} = await tokenRes.json()

  // Create a regular user via GraphQL
  await adminPage.request.post('/api/graphql', {
    headers: {'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json'},
    data: JSON.stringify({
      query: `mutation { createUser(username: "${uniqueUser}", password: "testpass123") { id } }`,
    }),
  })
  await adminCtx.close()

  // Login as the regular user
  const userCtx = await browser.newContext()
  const userPage = await userCtx.newPage()
  await userPage.request.post('/api/auth/login', {
    data: {username: uniqueUser, password: 'testpass123'},
  })

  await userPage.goto('/')
  await userPage.locator('button[aria-haspopup="true"]').click()
  await expect(userPage.getByText('User Management')).not.toBeVisible()

  await userCtx.close()
})
