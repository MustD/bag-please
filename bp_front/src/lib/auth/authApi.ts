let refreshPromise: Promise<{ accessToken: string }> | null = null

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

  refresh: async () => {
    if (refreshPromise) return refreshPromise
    refreshPromise = fetch('/api/auth/refresh', {method: 'POST'})
      .then(res => {
        if (!res.ok) throw new Error('Refresh failed')
        return res.json() as Promise<{ accessToken: string }>
      })
      .finally(() => {
        refreshPromise = null
      })
    return refreshPromise
  },
}
