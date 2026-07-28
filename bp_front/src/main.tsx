import {StrictMode} from 'react'
import {createRoot} from 'react-dom/client'
import {BrowserRouter} from 'react-router-dom'
import {ThemeProvider} from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import theme from '@/theme'
import {AuthProvider} from '@/lib/auth/AuthContext'
import ApolloAppProvider from '@/lib/apollo/ApolloProvider'
import App from '@/App'

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
