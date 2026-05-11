'use client'

import {useState} from 'react'
import {useRouter} from 'next/navigation'
import NextLink from 'next/link'
import {Box, Button, CircularProgress, Link, Stack, TextField, Typography} from '@mui/material'
import {useAuth} from '@/lib/auth/AuthContext'
import {authApi} from '@/lib/auth/authApi'

export default function RegisterPage() {
  const {setAuth} = useAuth()
  const router = useRouter()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [usernameError, setUsernameError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    let valid = true
    if (!username) {
      setUsernameError('Enter username')
      valid = false
    }
    if (!password) {
      setPasswordError('Enter password')
      valid = false
    }
    if (!valid) return

    setIsSubmitting(true)
    try {
      await authApi.register(username, password)
      const data = await authApi.login(username, password)
      setAuth({username: data.username, role: data.role as 'admin' | 'user', accessToken: data.accessToken})
      router.push('/?welcome=1')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Registration failed'
      setUsernameError(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Box component="form" noValidate onSubmit={handleSubmit}>
      <Stack sx={{maxWidth: 360, mx: 'auto', px: 2, py: 5}} spacing={2}>
        <Typography variant="h6">Create account</Typography>
        <TextField
          id="username"
          name="username"
          label="Username"
          value={username}
          error={!!usernameError}
          helperText={usernameError}
          onChange={(e) => {
            setUsername(e.target.value)
            setUsernameError('')
          }}
        />
        <TextField
          id="password"
          name="password"
          label="Password"
          type="password"
          value={password}
          error={!!passwordError}
          helperText={passwordError}
          onChange={(e) => {
            setPassword(e.target.value)
            setPasswordError('')
          }}
        />
        <Button type="submit" variant="contained" disabled={isSubmitting}>
          {isSubmitting ? <CircularProgress size={20} color="inherit"/> : 'Register'}
        </Button>
        <Link component={NextLink} href="/auth">Back to sign in</Link>
      </Stack>
    </Box>
  )
}
