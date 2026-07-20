import {useEffect, useState} from 'react'
import {useLocation, useNavigate} from 'react-router-dom'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import WelcomeBanner from '@/components/WelcomeBanner'
import {useAuth} from '@/lib/auth/AuthContext'

// Protected home placeholder — real app content (Today/Lists) arrives in
// Stories 5.5+. The username label and logout control live in the shared
// AppShell (Story 5.3); this screen carries the one-time welcome banner (FR5).
export default function HomePage() {
  const {username} = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  // Read the "just registered" signal exactly once into local state — the
  // single source of truth thereafter. It is set only on the register→login
  // path in AuthPage, never on ordinary login / silent refresh / expiry
  // re-login, so it can't appear then.
  const [showWelcome, setShowWelcome] = useState(
    () => Boolean((location.state as { welcome?: boolean } | null)?.welcome),
  )

  // Immediately scrub the history state so a re-render — or a reload that
  // restores history.state — can't resurrect the banner from location.state.
  useEffect(() => {
    if ((location.state as { welcome?: boolean } | null)?.welcome) {
      navigate(location.pathname, {replace: true, state: {}})
    }
    // Run once on mount; deliberately not reacting to later location changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <Box data-testid="home-page" sx={{flexGrow: 1, display: 'flex', flexDirection: 'column'}}>
      {showWelcome && username && (
        <WelcomeBanner username={username} onDismiss={() => setShowWelcome(false)}/>
      )}
      <Box
        sx={{
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
          p: 3,
        }}
      >
        <Typography variant="h4" color="text.primary">Bag Please</Typography>
        <Typography variant="body1" color="text.secondary">
          Your lists live here soon.
        </Typography>
      </Box>
    </Box>
  )
}
