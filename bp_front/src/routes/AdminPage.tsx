import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

// Admin area placeholder — real admin UI arrives in Story 5.4.
export default function AdminPage() {
  return (
    <Box
      data-testid="admin-page"
      sx={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 3,
      }}
    >
      <Typography variant="h4" color="text.primary">Admin</Typography>
    </Box>
  )
}
