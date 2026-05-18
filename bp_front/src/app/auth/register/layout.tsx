'use client'
import {useEffect} from 'react'
import {useRouter} from 'next/navigation'
import {useAuth} from '@/lib/auth/AuthContext'

export default function RegisterLayout({children}: React.PropsWithChildren) {
  const {registrationEnabled} = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (registrationEnabled === false) {
      router.replace('/auth')
    }
  }, [registrationEnabled, router])

  if (registrationEnabled !== true) return null

  return <>{children}</>
}
