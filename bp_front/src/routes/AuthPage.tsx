import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

// Placeholder auth screen — the full sign-in / registration UI lands in Story 5.2.
export default function AuthPage() {
  return (
    <Box
      data-testid="auth-page"
      sx={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1,
        p: 3,
        textAlign: 'center',
      }}
    >
      <Typography variant="h4" color="text.primary">Bag Please</Typography>
      <Typography variant="body1" color="text.secondary">Sign in (coming in Story 5.2)</Typography>
    </Box>
  )
}
