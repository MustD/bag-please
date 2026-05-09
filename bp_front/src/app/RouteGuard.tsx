'use client'
import {useEffect} from 'react'
import {usePathname, useRouter} from 'next/navigation'
import {useAuth} from '@/lib/auth/AuthContext'

const PUBLIC_ROUTES = ['/auth', '/auth/register']

export default function RouteGuard({children}: React.PropsWithChildren) {
  const {username, isLoading} = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  const isPublic = PUBLIC_ROUTES.some(r => pathname === r)

  useEffect(() => {
    if (!isLoading && !username && !isPublic) {
      router.replace('/auth')
    }
  }, [username, isLoading, isPublic, router])

  if (isLoading && !isPublic) return null

  return <>{children}</>
}
