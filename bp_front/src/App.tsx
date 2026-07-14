import {Navigate, Route, Routes} from 'react-router-dom'
import RouteGuard from '@/routes/RouteGuard'
import AdminGuard from '@/routes/AdminGuard'
import AuthPage from '@/routes/AuthPage'
import HomePage from '@/routes/HomePage'
import AdminPage from '@/routes/AdminPage'

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/auth" element={<AuthPage/>}/>

      {/* Protected subtree — RouteGuard redirects unauthenticated users to /auth */}
      <Route element={<RouteGuard/>}>
        <Route path="/" element={<HomePage/>}/>
        <Route path="/lists" element={<HomePage/>}/>
        <Route path="/admin/*" element={<AdminGuard><AdminPage/></AdminGuard>}/>
        {/* Unknown client routes fall back into the guarded tree */}
        <Route path="*" element={<Navigate to="/" replace/>}/>
      </Route>
    </Routes>
  )
}
