import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { normalizeRole } from '../../utils/roleUtils'

export default function RoleRedirect() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const user = useAuthStore((state) => state.user)

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  const role = normalizeRole(user?.role)

  if (role === 'RECRUITER') {
    return <Navigate to="/recruiter/dashboard" replace />
  }

  if (role !== 'STUDENT') {
    return <Navigate to="/login" replace />
  }

  // New students who haven't completed onboarding go to onboarding first
  if (user?.onboardingComplete === false) {
    return <Navigate to="/student/onboarding" replace />
  }

  return <Navigate to="/student/dashboard" replace />
}
