'use client'
import {Inter} from 'next/font/google'
import {createTheme} from '@mui/material/styles'

const inter = Inter({subsets: ['latin']})

const theme = createTheme({
  palette: {
    mode: 'dark',
    background: {default: '#0e0e10', paper: '#1a1a1d'},
    primary: {main: '#4db6a8', dark: '#3a9d96'},
    error: {main: '#d9534f'},
    text: {primary: '#e8e8e8', secondary: '#9e9e9e'},
    divider: '#2e2e32',
  },
  typography: {
    fontFamily: inter.style.fontFamily,
  },
  components: {
    MuiButton: {styleOverrides: {root: {borderRadius: 6, textTransform: 'none'}}},
    MuiTextField: {defaultProps: {variant: 'outlined'}},
    MuiPaper: {styleOverrides: {root: {border: '1px solid', borderColor: '#2e2e32'}}},
    MuiAppBar: {defaultProps: {elevation: 0}},
  },
})

export default theme
