import {expect, test} from '@playwright/test'

import {loginApi} from './support/api'
import {addCategory, addItem, createListAndOpen, openListsViaMenu, PASSWORD, registerViaUi, uniqueUsername} from './support/ui'

// Installability E2E (Story 7.14, FR59 + NFR-E7-7). Chrome builds a WebAPK only
// when three preconditions hold SIMULTANEOUSLY — a linked manifest, PNG icons at
// 192 and 512, and a registered service worker with a fetch handler — and a
// missing one downgrades the offer to a bookmark shortcut with NO error
// anywhere. That silence is why each precondition is asserted here separately
// rather than inferred from one composite check.
//
// The install itself cannot be asserted from a browser: it is a device-side
// Chrome decision. These tests assert the preconditions and the API-exclusion
// invariant; the device verification is filed as a residual (deferred-work.md).
//
// Every artifact assertion reads the SERVED response on the production stack,
// never vite.config.ts: the manifest link, the precache manifest and the
// registration are all injected at BUILD time, so the source proves nothing.
// `page.request` is used for the three static artefacts on purpose — it reads
// what Caddy serves, bypassing both the SPA and the worker. It is verification
// of a shipped byte stream, not an API shortcut for a behaviour.
//
// Runs on both the chromium and mobile (Pixel 7) projects (see
// playwright.config.ts); the mobile gate is mandatory. Untagged, so +2 runs per
// test.

// Wait until a worker actually CONTROLS the page. `getRegistration()` resolving
// is not enough — a first load registers a worker that does not control the
// document until it claims it (registerType 'autoUpdate' ⇒ clientsClaim), so an
// assertion racing that window would test an uncontrolled page.
async function waitForController(page: import('@playwright/test').Page): Promise<void> {
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, undefined, {timeout: 15_000})
}

test('FR59 — the served manifest is application/manifest+json and declares every key an install needs', async ({page}) => {
  const response = await page.request.get('/manifest.webmanifest')
  expect(response.status()).toBe(200)
  // A wrong content type kills installability silently (AR-E7-15); the Caddyfile
  // pins it rather than trusting the base image's MIME table.
  expect(response.headers()['content-type']).toContain('application/manifest+json')

  const manifest = JSON.parse(await response.text())
  expect(manifest.id).toBe('/')
  expect(manifest.name).toBe('Bag Please')
  expect(manifest.short_name).toBe('Bag Please')
  expect(manifest.start_url).toBe('/')
  expect(manifest.scope).toBe('/')
  expect(manifest.display).toBe('standalone')
  expect(manifest.theme_color).toBe('#000000')
  // Asserted explicitly, not alongside theme_color: background_color is
  // Android's COLD-LAUNCH SPLASH colour, and the upstream recipe's '#ffffff'
  // would flash white before an all-black app (src/theme.ts is dark-only with
  // background.default '#000000' and no light variant).
  expect(manifest.background_color).toBe('#000000')

  // Chrome needs a 192 and a 512 PNG; the maskable variant is what stops the
  // adaptive-icon mask from letterboxing the artwork.
  expect(manifest.icons).toEqual([
    {src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png'},
    {src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png'},
    {src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable'},
  ])
})

test('FR59 — every manifest icon is served as a real PNG at the size it declares', async ({page}) => {
  const manifest = JSON.parse(await (await page.request.get('/manifest.webmanifest')).text())

  for (const icon of manifest.icons as {src: string; sizes: string}[]) {
    const response = await page.request.get(icon.src)
    expect(response.status(), `${icon.src} status`).toBe(200)
    const bytes = await response.body()
    // Read the format and the dimensions out of the bytes, not out of the file
    // name: an SVG renamed .png buys no WebAPK icon at all. PNG signature, then
    // the IHDR width/height big-endian at offsets 16 and 20.
    expect(bytes.subarray(0, 8).toString('hex'), `${icon.src} signature`).toBe('89504e470d0a1a0a')
    const [width, height] = [bytes.readUInt32BE(16), bytes.readUInt32BE(20)]
    expect(`${width}x${height}`, `${icon.src} IHDR`).toBe(icon.sizes)
  }
})

test('FR59 — the built page carries exactly one injected manifest link', async ({page}) => {
  await page.goto('/auth')
  await expect(page.getByTestId('auth-page')).toBeVisible()

  // index.html declares no manifest in source — the plugin injects the link at
  // build time, so this is the only place the claim can be checked.
  const link = page.locator('link[rel="manifest"]')
  await expect(link).toHaveCount(1)
  await expect(link).toHaveAttribute('href', '/manifest.webmanifest')
})

test('NFR-E7-7 — the worker reaches activated, controls the page, and answers navigations itself', async ({page}) => {
  await page.goto('/auth')
  await expect(page.getByTestId('auth-page')).toBeVisible()
  await waitForController(page)

  const state = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready
    return {scope: registration.scope, active: registration.active?.state ?? null}
  })
  expect(state.active).toBe('activated')
  // Root scope, not /assets/: a worker scoped below / cannot control /.
  expect(new URL(state.scope).pathname).toBe('/')

  // "Has a fetch handler" is the precondition Chrome actually checks, and a
  // registration object cannot show it. Cutting the network does: if the
  // document still loads, the navigation was answered by the worker's own fetch
  // handler out of its precache. (This proves a handler exists — it is NOT an
  // offline mode, which is explicitly out of scope: nothing here caches data.)
  await page.context().setOffline(true)
  try {
    await page.reload()
    await expect(page.getByTestId('auth-page')).toBeVisible()
  } finally {
    await page.context().setOffline(false)
  }
})

test('NFR-E7-7 — /api/graphiql stays the backend readiness check while the worker controls the page', async ({page}) => {
  await page.goto('/auth')
  await expect(page.getByTestId('auth-page')).toBeVisible()
  await waitForController(page)

  // GraphiQL is a NAVIGATION, so without navigateFallbackDenylist the worker
  // answers it with the precached SPA shell and this project's only
  // backend-readiness check starts silently lying. It is Bearer-guarded, so the
  // navigation carries an admin token — this is environment preparation for
  // reaching the screen, not a shortcut for the behaviour under test.
  await page.setExtraHTTPHeaders({Authorization: `Bearer ${await loginApi('admin', 'admin')}`})
  await page.goto('/api/graphiql')

  await expect(page).toHaveTitle('GraphiQL')
  // The SPA shell's root mount must be absent — that is the exact failure the
  // denylist prevents.
  await expect(page.locator('#root')).toHaveCount(0)
})

test('NFR-E7-7 — an authenticated session leaves no /api entry in Cache Storage', async ({page}, testInfo) => {
  const username = uniqueUsername('pwa', 'caches', testInfo.project.name)
  const listName = `PWA caches ${Date.now()}`
  await registerViaUi(page, username, PASSWORD)
  await waitForController(page)

  // Drive real traffic first: registration is auth REST, the lists index and the
  // detail are GraphQL queries, and the category/item adds are mutations. Only
  // then is an empty /api cache evidence of anything.
  await openListsViaMenu(page)
  await createListAndOpen(page, listName)
  await addCategory(page, 'Dairy')
  await addItem(page, 'Dairy', 'Milk')

  const cached = await page.evaluate(async () => {
    const urls: string[] = []
    for (const name of await caches.keys()) {
      const cache = await caches.open(name)
      for (const request of await cache.keys()) urls.push(request.url)
    }
    return urls
  })

  // runtimeCaching is empty, so nothing under /api may ever be written — not the
  // GraphQL endpoint, not auth REST. The precache is asserted non-empty so a
  // worker that cached NOTHING cannot pass this by accident.
  expect(cached.length).toBeGreaterThan(0)
  expect(cached.filter(url => new URL(url).pathname.startsWith('/api'))).toEqual([])
})
