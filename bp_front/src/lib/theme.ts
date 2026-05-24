import {createTheme} from '@mui/material/styles'

// TypeScript module augmentation — enables theme.custom.bp.* with type safety
declare module '@mui/material/styles' {
  interface Theme {
    custom: {
      bp: {
        bg2: string
        card: string
        ter: string
        navBg: string
        accentSoft: string
      }
    }
  }
  interface ThemeOptions {
    custom?: {
      bp?: Partial<Theme['custom']['bp']>
    }
  }
}

// Contrast exceptions (document here, not in components):
// - Primary teal #2AA396: 3.04:1 against white — passes WCAG AA for UI components
//   and large text (≥18px bold / ≥24px regular) ONLY. Never use for body text < 18px.
// - Error red #FF3B30: 4.02:1 against white — marginal for body text.
//   Never use for text under 18px.

// darkPalette stub — uncomment and wire to CssVarsProvider when per-user themes are needed:
// const darkPalette = {
//   background: { default: '#0e0e10', paper: '#1a1a1d' },
//   primary: { main: '#4db6a8', dark: '#3a9d96' },
//   error: { main: '#d9534f' },
//   success: { main: '#30b568' },
//   text: { primary: '#e8e8e8', secondary: '#9e9e9e' },
//   divider: '#2e2e32',
// }

const theme = createTheme({
  palette: {
    mode: 'light',
    background: {
      default: '#F2F2F7',
      paper: '#FFFFFF',
    },
    primary: {
      main: '#2AA396',
    },
    error: {
      main: '#FF3B30',
    },
    success: {
      main: '#34C759',
    },
    text: {
      primary: '#000000',
      secondary: 'rgba(60,60,67,0.6)',
    },
    divider: 'rgba(60,60,67,0.18)',
  },
  typography: {
    fontFamily: 'Roboto, sans-serif',
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
      styleOverrides: {root: {borderRadius: 6, textTransform: 'none'}},
    },
    MuiTextField: {defaultProps: {variant: 'outlined'}},
    MuiPaper: {
      styleOverrides: {root: {border: '1px solid', borderColor: 'rgba(60,60,67,0.18)'}},
    },
    MuiAppBar: {defaultProps: {elevation: 0}},
  },
  custom: {
    bp: {
      bg2: '#E5E5EA',
      card: '#FFFFFF',
      ter: 'rgba(60,60,67,0.3)',
      navBg: 'rgba(242,242,247,0.82)',
      accentSoft: '#D6EAE8',
    },
  },
})

export default theme
