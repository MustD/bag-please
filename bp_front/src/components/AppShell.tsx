import {type MouseEvent, useState} from 'react'
import {Link as RouterLink, Outlet, useLocation, useNavigate} from 'react-router-dom'
import AppBar from '@mui/material/AppBar'
import Avatar from '@mui/material/Avatar'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Link from '@mui/material/Link'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings'
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted'
import LockResetIcon from '@mui/icons-material/LockReset'
import LogoutIcon from '@mui/icons-material/Logout'
import {authApi} from '@/lib/auth/authApi'
import {useAuth} from '@/lib/auth/AuthContext'
import {useHomePath} from '@/lib/lists/homePath'

// Authenticated app shell (Story 5.3). Renders the top AppBar with the username
// identity chip on every guarded screen (FR12) and an <Outlet/> for the page
// content. Mounted inside RouteGuard, so `username`/`role` are already resolved
// when this renders — no loading flash (AC #1). The "Change password" menu item
// is hidden for the admin account, which the backend 403-forbids from that
// endpoint (AC #7); the "Admin" item is shown only for the admin role (the sole
// entry point to /admin — Story 5.4, FR30/FR31); Logout is always present.
export default function AppShell() {
  const {username, role, clearAuth} = useAuth()
  const navigate = useNavigate()
  const {pathname} = useLocation()

  // Where `/` would take us, OBSERVED from the shared resolver (Story 7.5,
  // FR57) — cache-only, so the app bar never issues the membership-gated lists
  // request itself. This shell does not re-derive home (AR-E7-8); it only
  // compares. `null` means "not resolved yet", which deliberately reads as NOT
  // already-home: the link stays live rather than becoming a dead control.
  //
  // Consequence, measured and knowingly accepted: on a COLD page load of the
  // home route the app bar reads an empty cache for the ~100ms until whichever
  // page owns the lists query resolves it, so the link is live in that window
  // and a click inside it still costs the FR57 history entry. Closing it would
  // mean the app bar issuing its own request, which the intent forbids. Any test
  // asserting the inert state must therefore SYNCHRONISE on `aria-current`
  // rather than race it — two of the six new specs failed 2-of-6 runs before
  // they did. Filed for `md` in deferred-work.md.
  const homePath = useHomePath('observe')
  // Trailing-slash tolerant: react-router matches `/lists/` to the `/lists`
  // route, so a bare string compare would silently drop the guard on a
  // hand-typed URL.
  const trimSlash = (path: string) => path.replace(/\/+$/, '')
  const alreadyHome = homePath !== null && trimSlash(homePath) === trimSlash(pathname)

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [loggingOut, setLoggingOut] = useState(false)
  const menuOpen = Boolean(anchorEl)

  const openMenu = (event: MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget)
  const closeMenu = () => setAnchorEl(null)

  const goToLists = () => {
    closeMenu()
    navigate('/lists')
  }

  const goToChangePassword = () => {
    closeMenu()
    navigate('/account/password')
  }

  const goToAdmin = () => {
    closeMenu()
    navigate('/admin')
  }

  // Invalidate the server session (refresh token) then clear in-memory auth;
  // clearAuth() flips username to null, which makes RouteGuard redirect to
  // /auth — no manual navigation here. Guard against a double-fire logout
  // (Story 5.2 review fix): the in-flight flag disables the item next render,
  // so re-check it synchronously too.
  const handleLogout = async () => {
    closeMenu()
    if (loggingOut) return
    setLoggingOut(true)
    try {
      await authApi.logout()
      clearAuth()
    } finally {
      setLoggingOut(false)
    }
  }

  const initial = username ? username.charAt(0).toUpperCase() : '?'

  return (
    <Box sx={{minHeight: '100dvh', display: 'flex', flexDirection: 'column'}}>
      <AppBar
        position="sticky"
        data-testid="app-bar"
        sx={{
          bgcolor: theme => theme.custom.bp.navBg,
          backdropFilter: 'blur(20px)',
          borderBottom: theme => `1px solid ${theme.palette.divider}`,
        }}
      >
        <Toolbar>
          {/* Home link (Story 6.2, FR57). `flexGrow: 1` lives on the wrapper, not
              the Link: on the Link it would stretch the anchor across the empty
              toolbar, making the whole bar navigate home. `minWidth: 0` lets this
              flex child shrink at ~360px instead of pushing the username chip off
              screen. All home resolution stays behind `to="/"` and useHomePath.

              When the resolved home IS the current route the click is suppressed
              with preventDefault() and nothing else changes (Story 7.5): react-
              router's Link runs this onClick first and skips its own navigation
              when the event was defaultPrevented, and Enter on an anchor
              dispatches a click, so keyboard activation is covered by the same
              line. INERT MUST MEAN INERT-BUT-PRESENT (AR-E7-8): the element keeps
              its href, its link role, its focusability, its focus ring and its
              type scale — never a Button, aria-disabled, tabIndex={-1} or an
              unmount, because on /admin and /account/password this link is the
              screen's only in-app exit besides the user menu. `aria-current` is
              the sole added attribute; it is how the state reaches assistive
              technology without changing the role. */}
          <Box sx={{flexGrow: 1, minWidth: 0}}>
            <Link
              component={RouterLink}
              to="/"
              variant="h6"
              color="text.primary"
              underline="hover"
              data-testid="app-bar-home"
              aria-current={alreadyHome ? 'page' : undefined}
              onClick={alreadyHome ? (event: MouseEvent<HTMLAnchorElement>) => {
                // Only a plain primary activation is suppressed. Ctrl/Cmd/Shift/
                // Alt+click means "open home in a new tab/window", which is a
                // real request and must keep working — react-router's own Link
                // guards the identical way, and middle click never reaches
                // onClick at all (it fires `auxclick`), so without this check the
                // two mouse gestures would behave inconsistently. Enter on a
                // focused anchor dispatches a click with button 0, so keyboard
                // activation is still suppressed.
                if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
                  event.preventDefault()
                }
              } : undefined}
              sx={{
                fontWeight: 600,
                // `minWidth: 0` on the wrapper lets this shrink; without nowrap it
                // would wrap below ~340px (or under a large minimum font size) and
                // grow the bar to two lines.
                whiteSpace: 'nowrap',
                borderRadius: 1,
                // MUI v9's Link tracks keyboard focus itself and applies
                // .Mui-focusVisible; the native selector is kept as a fallback.
                '&.Mui-focusVisible, &:focus-visible': {
                  outline: theme => `2px solid ${theme.palette.primary.main}`,
                  outlineOffset: 3,
                },
              }}
            >
              Bag Please
            </Link>
          </Box>

          <Button
            onClick={openMenu}
            color="inherit"
            data-testid="user-menu-button"
            aria-label="Account menu"
            aria-haspopup="true"
            aria-controls={menuOpen ? 'user-menu' : undefined}
            aria-expanded={menuOpen}
            sx={{textTransform: 'none', gap: 1, px: 1}}
          >
            <Box data-testid="user-chip" sx={{display: 'flex', alignItems: 'center', gap: 1}}>
              <Avatar
                sx={{
                  width: 32,
                  height: 32,
                  fontSize: '0.9rem',
                  bgcolor: 'primary.main',
                  color: 'background.default',
                }}
              >
                {initial}
              </Avatar>
              <Typography
                variant="body1"
                color="text.primary"
                noWrap
                sx={{maxWidth: {xs: 140, sm: 220}}}
              >
                {username}
              </Typography>
            </Box>
          </Button>

          <Menu
            id="user-menu"
            anchorEl={anchorEl}
            open={menuOpen}
            onClose={closeMenu}
            anchorOrigin={{vertical: 'bottom', horizontal: 'right'}}
            transformOrigin={{vertical: 'top', horizontal: 'right'}}
          >
            <MenuItem data-testid="menu-lists" onClick={goToLists}>
              <ListItemIcon>
                <FormatListBulletedIcon fontSize="small"/>
              </ListItemIcon>
              <ListItemText>Lists</ListItemText>
            </MenuItem>
            {role !== 'admin' && (
              <MenuItem data-testid="menu-change-password" onClick={goToChangePassword}>
                <ListItemIcon>
                  <LockResetIcon fontSize="small"/>
                </ListItemIcon>
                <ListItemText>Change password</ListItemText>
              </MenuItem>
            )}
            {role === 'admin' && (
              <MenuItem data-testid="menu-admin" onClick={goToAdmin}>
                <ListItemIcon>
                  <AdminPanelSettingsIcon fontSize="small"/>
                </ListItemIcon>
                <ListItemText>Admin</ListItemText>
              </MenuItem>
            )}
            <MenuItem data-testid="menu-logout" onClick={handleLogout} disabled={loggingOut}>
              <ListItemIcon>
                <LogoutIcon fontSize="small"/>
              </ListItemIcon>
              <ListItemText>Logout</ListItemText>
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Box component="main" sx={{flexGrow: 1, display: 'flex', flexDirection: 'column'}}>
        <Outlet/>
      </Box>
    </Box>
  )
}
