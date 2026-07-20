import Alert from '@mui/material/Alert'
import IconButton from '@mui/material/IconButton'
import CloseIcon from '@mui/icons-material/Close'

interface WelcomeBannerProps {
  username: string
  onDismiss: () => void
}

// One-time post-registration welcome (Story 5.3, FR5). Teal-tinted banner shown
// at the top of the home content, below the app bar. Purely presentational —
// its lifetime (shown once, never persisted, gone on dismiss or navigation) is
// owned by HomePage via transient router + local state.
export default function WelcomeBanner({username, onDismiss}: WelcomeBannerProps) {
  return (
    <Alert
      severity="success"
      icon={false}
      variant="outlined"
      data-testid="welcome-banner"
      action={
        <IconButton
          aria-label="Dismiss welcome message"
          color="inherit"
          size="small"
          onClick={onDismiss}
          data-testid="welcome-banner-dismiss"
        >
          <CloseIcon fontSize="small"/>
        </IconButton>
      }
      sx={{
        m: 2,
        color: 'text.primary',
        borderColor: 'primary.main',
        bgcolor: theme => theme.custom.bp.accentSoft,
      }}
    >
      Welcome, {username}! You now have your own account.
    </Alert>
  )
}
