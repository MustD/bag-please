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
// WebAPK preconditions, so it must not be gated behind app startup. There is no
// callback: updates apply silently on next launch (UX-DR-E7-7).
registerSW({immediate: true})

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
