export interface JwtClaims {
  username: string
  role: 'admin' | 'user'
}

// Decodes a JWT payload and validates the claims this app relies on. Returns
// null for a malformed token or one missing/with-an-unknown `username`/`role`,
// so callers can treat that uniformly as "not a usable session".
export function parseJwt(token: string): JwtClaims | null {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const payload = JSON.parse(atob(base64)) as { username?: unknown; role?: unknown }
    if (typeof payload.username !== 'string' || payload.username.length === 0) return null
    if (payload.role !== 'admin' && payload.role !== 'user') return null
    return {username: payload.username, role: payload.role}
  } catch {
    return null
  }
}
