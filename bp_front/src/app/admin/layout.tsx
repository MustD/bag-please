'use client'
import {useEffect} from 'react'
import {useRouter} from 'next/navigation'
import {useAuth} from '@/lib/auth/AuthContext'

export default function AdminLayout({children}: React.PropsWithChildren) {
  const {role, isLoading} = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && role !== 'admin') {
      router.replace('/')
    }
  }, [role, isLoading, router])

  if (isLoading) return null
  if (role !== 'admin') return null

  return <>{children}</>
}
