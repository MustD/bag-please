'use client'

import {useState} from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import {authApi} from '@/lib/auth/authApi'
import {useAuth} from '@/lib/auth/AuthContext'

export default function ChangePasswordPage() {
  const {accessToken} = useAuth()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [currentError, setCurrentError] = useState('')
  const [newPasswordError, setNewPasswordError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    setCurrentError('')
    setNewPasswordError('')
    setSuccessMessage('')
    let valid = true
    if (!currentPassword) {
      setCurrentError('Enter current password');
      valid = false
    }
    if (!newPassword) {
      setNewPasswordError('Enter new password');
      valid = false
    }
    if (!valid || !accessToken) return

    setIsSubmitting(true)
    try {
      await authApi.changePassword(currentPassword, newPassword, accessToken)
      setSuccessMessage('Password changed successfully.')
      setCurrentPassword('')
      setNewPassword('')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Password change failed'
      setCurrentError(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Box component="form" noValidate onSubmit={handleSubmit}>
      <Stack sx={{maxWidth: 360, mx: 'auto', px: 2, py: 5}} spacing={2}>
        <Typography variant="h6">Change Password</Typography>
        {successMessage && (
          <Alert severity="success">{successMessage}</Alert>
        )}
        <TextField
          label="Current password"
          type="password"
          id="current-password"
          name="current-password"
          value={currentPassword}
          error={!!currentError}
          helperText={currentError}
          onChange={(e) => {
            setCurrentPassword(e.target.value);
            setCurrentError('');
            setSuccessMessage('')
          }}
        />
        <TextField
          label="New password"
          type="password"
          id="new-password"
          name="new-password"
          value={newPassword}
          error={!!newPasswordError}
          helperText={newPasswordError}
          onChange={(e) => {
            setNewPassword(e.target.value);
            setNewPasswordError('');
            setSuccessMessage('')
          }}
        />
        <Button type="submit" variant="contained" disabled={isSubmitting}>
          {isSubmitting ? <CircularProgress size={20} color="inherit"/> : 'Change Password'}
        </Button>
      </Stack>
    </Box>
  )
}
