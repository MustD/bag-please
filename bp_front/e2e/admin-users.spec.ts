import {expect, test} from '@playwright/test'
import path from 'path'

test.use({storageState: path.join(__dirname, '.auth/user.json')})

test('create user — new row appears in table without page reload', async ({page}) => {
  const uniqueUser = `e2e_create_${Date.now()}`

  await page.goto('/admin/users')
  await page.getByRole('button', {name: 'Create user'}).click()

  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Username').fill(uniqueUser)
  await dialog.getByLabel('Password').fill('testpass123')
  await dialog.getByRole('button', {name: 'Create'}).click()

  await expect(page.getByRole('cell', {name: uniqueUser})).toBeVisible()
})

test('delete user — row removed from table after confirmation', async ({page}) => {
  const uniqueUser = `e2e_delete_${Date.now()}`

  await page.goto('/admin/users')

  // Create the user first via UI
  await page.getByRole('button', {name: 'Create user'}).click()
  const createDialog = page.getByRole('dialog')
  await createDialog.getByLabel('Username').fill(uniqueUser)
  await createDialog.getByLabel('Password').fill('testpass123')
  await createDialog.getByRole('button', {name: 'Create'}).click()
  await expect(page.getByRole('cell', {name: uniqueUser})).toBeVisible()

  // Delete the user
  const row = page.getByRole('row', {name: new RegExp(uniqueUser)})
  await row.getByTitle('Delete user').click()

  const deleteDialog = page.getByRole('dialog')
  await deleteDialog.getByRole('button', {name: 'Delete'}).click()

  await expect(page.getByRole('cell', {name: uniqueUser})).not.toBeVisible()
})

test('reset password — dialog closes without error alert', async ({page}) => {
  const uniqueUser = `e2e_reset_${Date.now()}`

  await page.goto('/admin/users')

  // Create a user to reset
  await page.getByRole('button', {name: 'Create user'}).click()
  const createDialog = page.getByRole('dialog')
  await createDialog.getByLabel('Username').fill(uniqueUser)
  await createDialog.getByLabel('Password').fill('testpass123')
  await createDialog.getByRole('button', {name: 'Create'}).click()
  await expect(page.getByRole('cell', {name: uniqueUser})).toBeVisible()

  // Reset the password
  const row = page.getByRole('row', {name: new RegExp(uniqueUser)})
  await row.getByTitle('Reset password').click()

  const resetDialog = page.getByRole('dialog')
  await resetDialog.getByLabel('New password').fill('newpassword456')
  await resetDialog.getByRole('button', {name: 'Reset'}).click()

  await expect(page.getByRole('dialog')).not.toBeVisible()
})

test('navigation menu shows "User Management" for admin', async ({page}) => {
  await page.goto('/')
  await page.locator('button[aria-haspopup="true"]').click()
  await expect(page.getByText('User Management')).toBeVisible()
})
