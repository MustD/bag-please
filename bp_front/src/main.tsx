import {StrictMode} from 'react'
import {createRoot} from 'react-dom/client'
import {BrowserRouter} from 'react-router-dom'
import {registerSW} from 'virtual:pwa-register'
import {ThemeProvider} from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import theme from '@/theme'
import {AuthProvider} from '@/lib/auth/AuthContext'
import ApolloAppProvider from '@/lib/apollo/ApolloProvider'
import App from '@/App'

// Story 7.14: register the auto-updating service worker before the app mounts.
// `immediate: true` registers without waiting for the window load event — a
// registered worker WITH a fetch handler is one of the three simultaneous
// WebAPK preconditions, so it must not be gated behind app startup.
//
// What `registerType: 'autoUpdate'` ACTUALLY does, read out of the generated
// client (node_modules/vite-plugin-pwa/dist/client/build/register.js) rather
// than assumed: on `activated` with `event.isUpdate || event.isExternal` and no
// `onNeedReload` supplied, it calls `window.location.reload()`. So a deploy
// reloads open tabs — `isExternal` meaning ANOTHER tab triggered the update.
// That is silent, so it meets UX-DR-E7-7's "no toast, no prompt, no banner",
// but it is NOT "deferred to next launch", and a reload mid-edit discards
// unsaved dialog input. Filed in deferred-work.md: suppressing it with
// `onNeedReload() {}` would deviate from the mechanism the epic mandates by
// name, so it is a decision for a human, not a patch.
//
// `onRegisterError` is wired because registration is the one WebAPK
// precondition that can fail at RUNTIME (insecure origin, blocked storage, a
// 404 or non-JS sw.js), and the virtual module otherwise swallows the rejection
// into a no-op — in a story whose whole premise is that a missing precondition
// fails with no error anywhere.
registerSW({
  immediate: true,
  onRegisterError(error) {
    console.error('Service worker registration failed — the app is not installable', error)
  },
})

// Provider order matters: Apollo's error link reads auth state (to refresh and
// clear the session), so it sits inside AuthProvider; the redirect on expiry is
// handled by RouteGuard within BrowserRouter.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline/>
      <AuthProvider>
        <BrowserRouter>
          <ApolloAppProvider>
            <App/>
          </ApolloAppProvider>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>,
)
