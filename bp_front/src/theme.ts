import {createTheme} from '@mui/material/styles'

// Module augmentation — exposes theme.custom.bp.* with type safety so later
// stories can reach the design tokens that don't map onto MUI's palette.
declare module '@mui/material/styles' {
  interface Theme {
    custom: {
      bp: {
        bg2: string
        card2: string
        navBg: string
        sheetBg: string
        accentSoft: string
        stripe: string
      }
    }
  }

  interface ThemeOptions {
    custom?: {
      bp?: Partial<Theme['custom']['bp']>
    }
  }
}

// Dark palette, seeded from design/theme.js (dark) + the dark teal accent.
// Epic 5 ships dark-mode only (the design's own default); a plain MUI
// ThemeProvider dark theme is intentional — CssVarsProvider is not required.
const theme = createTheme({
  palette: {
    mode: 'dark',
    background: {
      default: '#000000',
      paper: '#1C1C1E',
    },
    primary: {
      main: '#4DC9BB',
    },
    error: {
      main: '#FF453A',
    },
    success: {
      main: '#30D158',
    },
    warning: {
      main: '#FFD60A',
    },
    text: {
      primary: '#FFFFFF',
      secondary: 'rgba(235,235,245,0.6)',
    },
    divider: 'rgba(84,84,88,0.5)',
  },
  typography: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    body1: {
      fontSize: '1.0625rem',
      lineHeight: 1.3,
    },
    body2: {
      fontSize: '0.8125rem',
      lineHeight: 1.4,
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {root: {borderRadius: 8, textTransform: 'none'}},
    },
    MuiTextField: {defaultProps: {variant: 'outlined'}},
    MuiAppBar: {defaultProps: {elevation: 0}},
  },
  custom: {
    bp: {
      bg2: '#0E0E10',
      card2: '#2C2C2E',
      navBg: 'rgba(0,0,0,0.78)',
      sheetBg: '#1C1C1E',
      accentSoft: 'rgba(77,201,187,0.18)',
      stripe: 'rgba(255,255,255,0.03)',
    },
  },
})

export default theme
