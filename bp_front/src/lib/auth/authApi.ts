let refreshPromise: Promise<{ accessToken: string }> | null = null

// Cap the silent refresh so a hung (not merely refused) backend can't leave the
// app stuck rendering nothing while the bootstrap `isLoading` never resolves.
const REFRESH_TIMEOUT_MS = 8000

// Fetch-based REST client for the backend auth endpoints (/api/auth/*).
// The refresh token lives in an httpOnly cookie the browser sends automatically;
// the access token returned here is held in memory only (see AuthContext).
export const authApi = {
  login: async (username: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({username, password}),
    })
    if (!res.ok) {
      if (res.status === 429) throw new Error('Too many login attempts. Please try again later.')
      throw new Error('Invalid username or password')
    }
    return res.json() as Promise<{ accessToken: string; username: string; role: string }>
  },

  logout: async () => {
    await fetch('/api/auth/logout', {method: 'POST'}).catch(() => {
    })
  },

  register: async (username: string, password: string) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({username, password}),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({})) as { error?: string }
      throw new Error(data.error ?? 'Registration failed')
    }
    return res.json() as Promise<{ username: string; role: string }>
  },

  changePassword: async (currentPassword: string, newPassword: string, accessToken: string) => {
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({currentPassword, newPassword}),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({})) as { error?: string }
      throw new Error(data.error ?? res.statusText ?? 'Password change failed')
    }
  },

  getConfig: async (): Promise<{ registrationEnabled: boolean }> => {
    const res = await fetch('/api/auth/config')
    if (!res.ok) throw new Error('Failed to fetch config')
    return res.json()
  },

  // Single-flight: concurrent callers share one in-flight refresh request.
  refresh: async () => {
    if (refreshPromise) return refreshPromise
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), REFRESH_TIMEOUT_MS)
    refreshPromise = fetch('/api/auth/refresh', {method: 'POST', signal: controller.signal})
      .then(res => {
        if (!res.ok) throw new Error('Refresh failed')
        return res.json() as Promise<{ accessToken: string }>
      })
      .finally(() => {
        clearTimeout(timeout)
        refreshPromise = null
      })
    return refreshPromise
  },
}
