'use client'
import {styled} from '@mui/material/styles'
import BottomNavigation from '@mui/material/BottomNavigation'
import BottomNavigationAction from '@mui/material/BottomNavigationAction'
import {usePathname, useRouter} from 'next/navigation'
import TodayIcon from '@mui/icons-material/Today'
import ListIcon from '@mui/icons-material/List'
import PeopleIcon from '@mui/icons-material/People'

const TAB_MAP: Record<string, number> = {
  '/list': 0,
  '/lists': 1,
  '/household': 2,
}

const StyledBottomNavigation = styled(BottomNavigation)(({theme}) => ({
  position: 'fixed',
  bottom: 0,
  left: 0,
  right: 0,
  zIndex: theme.zIndex.appBar,
  backgroundColor: theme.custom.bp.navBg,
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)',
  borderTop: `1px solid ${theme.palette.divider}`,
}))

export default function BPBottomNav() {
  const pathname = usePathname()
  const router = useRouter()

  const activeTab = Object.entries(TAB_MAP).find(([path]) => pathname === path || pathname.startsWith(path + '/'))?.[1] ?? false

  return (
    <StyledBottomNavigation
      value={activeTab}
      onChange={(_, newValue) => {
        const path = Object.entries(TAB_MAP).find(([, v]) => v === newValue)?.[0]
        if (path) router.push(path === '/list' ? '/lists' : path)
      }}
    >
      <BottomNavigationAction label="Today" icon={<TodayIcon/>} value={0}/>
      <BottomNavigationAction label="Lists" icon={<ListIcon/>} value={1}/>
      <BottomNavigationAction label="Household" icon={<PeopleIcon/>} value={2}/>
    </StyledBottomNavigation>
  )
}
