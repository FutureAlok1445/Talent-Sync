import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { normalizeRole } from '../../utils/roleUtils'

export default function ProtectedRoute({ requiredRole, children }) {
  const location = useLocation()
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const user = useAuthStore((state) => state.user)

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (requiredRole && normalizeRole(user?.role) !== normalizeRole(requiredRole)) {
    return <Navigate to="/dashboard" replace />
  }

  if (children) {
    return children
  }

  return <Outlet />
}
