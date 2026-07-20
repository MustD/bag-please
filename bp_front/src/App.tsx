import {Navigate, Route, Routes} from 'react-router-dom'
import RouteGuard from '@/routes/RouteGuard'
import AdminGuard from '@/routes/AdminGuard'
import AppShell from '@/components/AppShell'
import AuthPage from '@/routes/AuthPage'
import HomePage from '@/routes/HomePage'
import ChangePasswordPage from '@/routes/ChangePasswordPage'
import AdminPage from '@/routes/AdminPage'

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/auth" element={<AuthPage/>}/>

      {/* Protected subtree — RouteGuard redirects unauthenticated users to /auth,
          AppShell adds the top AppBar + username chip to every guarded screen. */}
      <Route element={<RouteGuard/>}>
        <Route element={<AppShell/>}>
          <Route path="/" element={<HomePage/>}/>
          <Route path="/lists" element={<HomePage/>}/>
          <Route path="/account/password" element={<ChangePasswordPage/>}/>
          <Route path="/admin/*" element={<AdminGuard><AdminPage/></AdminGuard>}/>
          {/* Unknown client routes fall back into the guarded tree */}
          <Route path="*" element={<Navigate to="/" replace/>}/>
        </Route>
      </Route>
    </Routes>
  )
}
