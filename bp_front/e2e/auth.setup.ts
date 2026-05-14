import {expect, test as setup} from '@playwright/test'
import fs from 'fs'
import path from 'path'

const authFile = path.join(__dirname, '.auth/user.json')

setup('authenticate as admin', async ({page}) => {
  fs.mkdirSync(path.join(__dirname, '.auth'), {recursive: true})
  const response = await page.request.post('/api/auth/login', {
    data: {username: 'admin', password: 'admin'},
  })
  expect(response.ok()).toBeTruthy()
  await page.context().storageState({path: authFile})
})
