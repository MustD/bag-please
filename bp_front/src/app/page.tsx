'use client'

import {Suspense, useEffect, useState} from 'react'
import {useRouter, useSearchParams} from 'next/navigation'
import {Box, Link, Paper} from '@mui/material'
import Typography from '@mui/material/Typography'
import {useAuth} from '@/lib/auth/AuthContext'
import WelcomeBanner from '@/app/WelcomeBanner'

function HomeContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const {username} = useAuth()
  const [showBanner, setShowBanner] = useState(() => searchParams?.get('welcome') === '1')

  useEffect(() => {
    if (showBanner) {
      router.replace('/')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional fire-once: clean URL after reading ?welcome=1 at mount
  }, [])

  return (
    <Box>
      {showBanner && username && (
        <WelcomeBanner username={username} onDismiss={() => setShowBanner(false)}/>
      )}
      <Paper sx={{p: 1}}>
        <Typography>Welcome to the bag-please app.</Typography>
        <Typography>Work in progress.</Typography>
        <Typography>
          Check out our&nbsp;
          <Link target="_blank" href="https://github.com/MustD/bag-please">github</Link>
        </Typography>
      </Paper>
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
