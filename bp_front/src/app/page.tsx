'use client'

import {Suspense, useEffect} from 'react'
import {useRouter} from 'next/navigation'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import {useQuery} from '@apollo/client/react'
import {listsQuery} from '@/lib/list/Queries'
import {useAuth} from '@/lib/auth/AuthContext'

function HomeContent() {
  const router = useRouter()
  const {username, isLoading: authLoading} = useAuth()
  const {data, loading: listsLoading} = useQuery(listsQuery, {
    skip: !username || authLoading,
  })

  useEffect(() => {
    if (authLoading || listsLoading || !data) return
    const lists = [...(data?.lists?.lists ?? [])]
    if (lists.length === 0) {
      router.replace('/lists')
      return
    }
    const oldest = lists.sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )[0]
    router.replace(`/list/${oldest.id}`)
  }, [authLoading, listsLoading, data, router])

  return (
    <Box sx={{display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh'}}>
      <CircularProgress/>
    </Box>
  )
}

export default function Home() {
  return (
    <Suspense fallback={null}>
      <HomeContent/>
    </Suspense>
  )
}
