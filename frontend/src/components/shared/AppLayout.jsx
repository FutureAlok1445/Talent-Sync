/*
 * WHO WRITES THIS: Frontend developer
 * WHAT THIS DOES: Root layout for the authenticated workspace.
 *                 Architecture: [TOPBAR fixed 56px] / [MAIN CONTENT + CAREER AI PANEL side-by-side]
 *                 Custom cursor lives in AppShell.jsx — not touched here.
 * DEPENDS ON: AppNavbar, CareerAIPanel, PageTransition, uiStore
 */
import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import AppNavbar from './AppNavbar'
import PageTransition from './PageTransition'
import CareerAIPanel from './CareerAIPanel'
import { useAuthStore } from '../../store/authStore'
import { useUIStore } from '../../store/uiStore'
import { useMatchStore } from '../../store/matchStore'
import { useApplicationStore } from '../../store/applicationStore'
import { matchService } from '../../services/matchService'
import { applicationService } from '../../services/applicationService'
import { normalizeRole } from '../../utils/roleUtils'

const BANNER_SESSION_KEY = 'ts-profile-banner-dismissed'

function useBannerState() {
  const [dismissed, setDismissed] = useState(() => {
    try { return sessionStorage.getItem(BANNER_SESSION_KEY) === '1' } catch { return false }
  })

  const dismiss = () => {
    setDismissed(true)
    try { sessionStorage.setItem(BANNER_SESSION_KEY, '1') } catch {}
  }

  return [dismissed, dismiss]
}

export default function AppLayout() {
  const user = useAuthStore((state) => state.user)
  const role = normalizeRole(user?.role)
  const [bannerDismissed, dismissBanner] = useBannerState()
  const { toggleAIPanel, setAIPanelOpen } = useUIStore()

  const setMatches = useMatchStore((state) => state.setMatches)
  const setApplications = useApplicationStore((state) => state.setApplications)

  // Fetch initial badges logic
  useEffect(() => {
    let active = true
    if (role === 'STUDENT') {
      Promise.all([
        matchService.getMyMatches(50),
        applicationService.getMyApplications()
      ]).then(([matches, applications]) => {
        if (!active) return
        setMatches(matches)
        setApplications(applications)
      }).catch(() => {})
    }
    return () => { active = false }
  }, [role, setMatches, setApplications])

  // Apply persisted theme on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('ts-theme') || 'light'
      document.documentElement.classList.toggle('dark', saved === 'dark')
    } catch {}
  }, [])

  // Keyboard shortcuts: Cmd+/ → open Career AI, Escape → close
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault()
        toggleAIPanel()
      }
      if (e.key === 'Escape') {
        setAIPanelOpen(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [toggleAIPanel, setAIPanelOpen])

  // Show banner for student role when not dismissed
  // In a real app, completion < 80% would be the condition
  const showBanner = role === 'STUDENT' && !bannerDismissed

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-(--bg-base) text-(--text-primary)">
      {/* Fixed topbar — sticky top-0 handled inside AppNavbar */}
      <AppNavbar showBanner={showBanner} onDismissBanner={dismissBanner} />

      {/* Body: main content + AI panel */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <main className="min-h-0 flex-1 overflow-y-auto page-content">
          <PageTransition>
            <Outlet />
          </PageTransition>
        </main>

        {/* Career AI Panel — fixed right, 380px default */}
        {role === 'STUDENT' && <CareerAIPanel />}
      </div>
    </div>
  )
}