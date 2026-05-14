'use client'

import {Suspense, useState} from 'react'
import {useRouter, useSearchParams} from 'next/navigation'
import NextLink from 'next/link'
import {Alert, Box, Button, CircularProgress, Link, Stack, TextField, Typography} from '@mui/material'
import {useAuth} from '@/lib/auth/AuthContext'
import {authApi} from '@/lib/auth/authApi'

function LoginForm() {
  const searchParams = useSearchParams()
  const expired = searchParams?.get('expired') === '1'
  const {setAuth} = useAuth()
  const router = useRouter()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [usernameError, setUsernameError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [serverError, setServerError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    setServerError('')
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
      const data = await authApi.login(username, password)
      setAuth({username: data.username, role: data.role as 'admin' | 'user', accessToken: data.accessToken})
      router.push('/')
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Invalid username or password')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Box component="form" noValidate onSubmit={handleSubmit}>
      <Stack sx={{maxWidth: 360, mx: 'auto', px: 2, py: 5}} spacing={2}>
        {expired && (
          <Alert severity="warning">Your session has expired. Please sign in again.</Alert>
        )}
        <Typography variant="h6">Sign in</Typography>
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
            setServerError('')
          }}
        />
        <TextField
          id="password"
          name="password"
          label="Password"
          type="password"
          value={password}
          error={!!passwordError || !!serverError}
          helperText={passwordError || serverError}
          onChange={(e) => {
            setPassword(e.target.value)
            setPasswordError('')
            setServerError('')
          }}
        />
        <Button type="submit" variant="contained" disabled={isSubmitting}>
          {isSubmitting ? <CircularProgress size={20} color="inherit"/> : 'Sign in'}
        </Button>
        <Link component={NextLink} href="/auth/register">Register</Link>
      </Stack>
    </Box>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm/>
    </Suspense>
  )
}
