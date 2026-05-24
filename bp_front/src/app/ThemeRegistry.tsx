'use client'
import {ThemeProvider} from '@mui/material'
import {AppRouterCacheProvider} from '@mui/material-nextjs/v13-appRouter'
import theme from '@/lib/theme'

export default function ThemeRegistry({children}: {children: React.ReactNode}) {
  return (
    <AppRouterCacheProvider>
      <ThemeProvider theme={theme}>
        {children}
      </ThemeProvider>
    </AppRouterCacheProvider>
  )
}
