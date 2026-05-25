'use client'

import {useEffect} from 'react'
import {useRouter} from 'next/navigation'

export default function Error({error: _error}: { error: Error }) {
  const router = useRouter()
  useEffect(() => {
    router.replace('/lists')
  }, [router])
  return null
}
