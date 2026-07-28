import {type ReactNode, useEffect} from 'react'
import {useNavigate} from 'react-router-dom'
import {useAuth} from '@/lib/auth/AuthContext'

// Admin guard scaffold (FR31). Redirects non-admins away from /admin/*. This
// sits inside the auth-guarded subtree, so by the time it runs the user is
// already authenticated — it only enforces the role. Dedicated admin E2E
// coverage lands in Story 5.4 (no admin UI to land on yet).
export default function AdminGuard({children}: { children: ReactNode }) {
  const {role} = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (role !== 'admin') {
      navigate('/', {replace: true})
    }
  }, [role, navigate])

  if (role !== 'admin') return null

  return <>{children}</>
}
