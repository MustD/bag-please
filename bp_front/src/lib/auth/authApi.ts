let refreshPromise: Promise<{ accessToken: string }> | null = null

export const authApi = {
  login: async (username: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({username, password}),
    })
    if (!res.ok) throw new Error('Login failed')
    return res.json() as Promise<{ accessToken: string; username: string; role: string }>
  },

  logout: async () => {
    await fetch('/api/auth/logout', {method: 'POST'}).catch(() => {
    })
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
