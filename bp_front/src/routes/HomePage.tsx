import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import {useAuth} from '@/lib/auth/AuthContext'

// Protected home placeholder — real app content arrives in Stories 5.5+.
export default function HomePage() {
  const {username} = useAuth()
  return (
    <Box
      data-testid="home-page"
      sx={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1,
        p: 3,
      }}
    >
      <Typography variant="h4" color="text.primary">Bag Please</Typography>
      <Typography variant="body1" color="text.secondary">Signed in as {username}</Typography>
    </Box>
  )
}
