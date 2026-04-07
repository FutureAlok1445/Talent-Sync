import { useToast } from '../shared/useToast'
import { useProfileForm } from '../../hooks/useProfileForm'
import { SkeletonCard } from '../shared/Skeletons'
import ProfilePersonalDetails from './ProfilePersonalDetails'
import ProfileBio from './ProfileBio'
import ProfileSocialLinks from './ProfileSocialLinks'
import ProfileResume from './ProfileResume'
import ProfileCertifications from './ProfileCertifications'
import { useAuthStore } from '../../store/authStore'
import { CheckCircle2, Circle, Sparkles } from 'lucide-react'

/* ── SVG Circular Progress Ring ── */
function ProgressRing({ score }) {
  const radius = 45
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference

  // Color based on score
  const getGradientId = () => {
    if (score >= 80) return 'gradient-green'
    if (score >= 50) return 'gradient-yellow'
    return 'gradient-orange'
  }

  return (
    <div className="relative flex items-center justify-center">
      <svg width="120" height="120" viewBox="0 0 120 120" className="-rotate-90">
        <defs>
          <linearGradient id="gradient-green" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#22C55E" />
            <stop offset="100%" stopColor="#16A34A" />
          </linearGradient>
          <linearGradient id="gradient-yellow" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFE135" />
            <stop offset="100%" stopColor="#FFB800" />
          </linearGradient>
          <linearGradient id="gradient-orange" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFB800" />
            <stop offset="100%" stopColor="#FF8C00" />
          </linearGradient>
        </defs>
        {/* Background track */}
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="var(--bg-subtle)"
          strokeWidth="8"
        />
        {/* Progress arc */}
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke={`url(#${getGradientId()})`}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="progress-ring-circle"
        />
      </svg>
      {/* Center label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-heading text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          {score}%
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
          complete
        </span>
      </div>
    </div>
  )
}

export default function ProfilePage() {
  const toast = useToast()
  const user = useAuthStore((s) => s.user)

  const {
    loading,
    sectionSaving,
    sectionErrors,
    personal, setPersonal,
    bio, setBio,
    socialLinks, setSocialLinks,
    resume, resumePublic,
    certificates, certificatesPublic,
    savePersonal,
    saveBio,
    saveSocialLinks,
    uploadResume, removeResume, toggleResumePublic,
    uploadCertificate, removeCertificate, toggleCertificatesPublic,
  } = useProfileForm(toast)

  if (loading) {
    return (
      <section className="w-full max-w-none pb-12">
        <header className="mb-8">
          <h1 className="font-heading text-[26px] font-bold text-(--text-primary)">Profile</h1>
          <p className="font-sans text-[14px] text-(--text-secondary)">Loading your profile…</p>
        </header>
        <div className="space-y-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </section>
    )
  }

  // Calculate completion percentage
  const calcCompletion = () => {
    let score = 0
    if (personal?.fullName) score += 20
    if (personal?.college && personal?.cgpa) score += 20
    if (personal?.skills?.length > 0) score += 20
    if (bio) score += 10
    if (resume?.url) score += 30
    return score
  }

  const completionScore = calcCompletion()

  // Section cards with staggered animation delays
  const sections = [
    { delay: '0s', component: (
      <ProfilePersonalDetails
        personal={personal}
        setPersonal={setPersonal}
        saving={sectionSaving.personal}
        error={sectionErrors.personal}
        onSave={savePersonal}
      />
    )},
    { delay: '0.08s', component: (
      <ProfileBio
        bio={bio}
        setBio={setBio}
        saving={sectionSaving.bio}
        error={sectionErrors.bio}
        onSave={saveBio}
      />
    )},
    { delay: '0.16s', component: (
      <ProfileSocialLinks
        socialLinks={socialLinks}
        setSocialLinks={setSocialLinks}
        saving={sectionSaving.links}
        error={sectionErrors.links}
        onSave={saveSocialLinks}
      />
    )},
    { delay: '0.24s', component: (
      <ProfileResume
        resume={resume}
        resumePublic={resumePublic}
        saving={sectionSaving.resume}
        error={sectionErrors.resume}
        onUpload={uploadResume}
        onRemove={removeResume}
        onTogglePublic={toggleResumePublic}
      />
    )},
    { delay: '0.32s', component: (
      <ProfileCertifications
        certificates={certificates}
        certificatesPublic={certificatesPublic}
        saving={sectionSaving.certs}
        error={sectionErrors.certs}
        onUpload={uploadCertificate}
        onRemove={removeCertificate}
        onTogglePublic={toggleCertificatesPublic}
      />
    )},
  ]

  return (
    <div className="flex flex-col gap-8 pb-12 w-full max-w-none">
      {/* ── Premium Hero Header ── */}
      <header className="profile-header-gradient">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            {/* Avatar with animated gradient ring */}
            {user?.name && (
              <div className="relative">
                <div className="avatar-ring rounded-full p-[3px]">
                  <div
                    className="flex h-14 w-14 items-center justify-center rounded-full text-xl font-bold"
                    style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}
                  >
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                </div>
                {/* Online indicator */}
                <div
                  className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2"
                  style={{ background: 'var(--success)', borderColor: 'var(--bg-card)' }}
                />
              </div>
            )}
            <div>
              <h1 className="font-heading text-[26px] font-bold" style={{ color: 'var(--text-primary)' }}>
                {user?.name ? `${user.name}'s Profile` : 'Profile'}
              </h1>
              <p className="font-sans text-[14px]" style={{ color: 'var(--text-secondary)' }}>
                Keep your profile updated for better match quality
              </p>
            </div>
          </div>

          {/* Completion mini badge */}
          <div
            className="flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-semibold"
            style={{
              background: completionScore >= 80
                ? 'rgba(34, 197, 94, 0.1)'
                : completionScore >= 50
                ? 'rgba(255, 225, 53, 0.1)'
                : 'rgba(255, 140, 0, 0.1)',
              color: completionScore >= 80
                ? 'var(--success)'
                : completionScore >= 50
                ? 'var(--accent-yellow)'
                : '#FF8C00',
              border: `1px solid ${completionScore >= 80
                ? 'rgba(34, 197, 94, 0.2)'
                : completionScore >= 50
                ? 'rgba(255, 225, 53, 0.2)'
                : 'rgba(255, 140, 0, 0.2)'}`,
            }}
          >
            <Sparkles size={14} />
            {completionScore}% Complete
          </div>
        </div>
      </header>

      {sectionErrors.load && (
        <div className="rounded-[8px] bg-red-500/10 border border-red-500/20 p-4 text-xs tracking-wide text-red-500">
          {sectionErrors.load}
        </div>
      )}

      <div className="flex flex-col lg:flex-row items-start gap-8">
        {/* Left Column (65%) — Section Cards with staggered animations */}
        <div className="w-full lg:w-[65%] flex flex-col gap-6">
          {sections.map((section, idx) => (
            <div
              key={idx}
              className="profile-card-enter"
              style={{ animationDelay: section.delay }}
            >
              {section.component}
            </div>
          ))}
        </div>

        {/* Right Column (35%) — Glassmorphic Sticky Completion Card */}
        <div className="w-full lg:w-[35%] sticky top-[80px] sidebar-slide-in">
          <div
            className="glass-card flex flex-col gap-5 rounded-2xl p-6"
          >
            <h2 className="font-heading text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
              Profile Completion
            </h2>

            {/* SVG Progress Ring */}
            <div className="flex justify-center py-2">
              <ProgressRing score={completionScore} />
            </div>

            <p className="font-sans text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Companies rely on AI similarity matching to discover top candidates.
              Completing your profile greatly improves your match rate accuracy.
            </p>

            {/* Checklist */}
            <div className="flex flex-col gap-1">
              <div
                className="checklist-item"
                style={{ color: personal?.skills?.length ? 'var(--success)' : 'var(--text-muted)' }}
              >
                <span className="check-icon">
                  {personal?.skills?.length ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                </span>
                Add top skills
              </div>
              <div
                className="checklist-item"
                style={{ color: resume?.url ? 'var(--success)' : 'var(--text-muted)' }}
              >
                <span className="check-icon">
                  {resume?.url ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                </span>
                Upload your resume
              </div>
              <div
                className="checklist-item"
                style={{ color: bio ? 'var(--success)' : 'var(--text-muted)' }}
              >
                <span className="check-icon">
                  {bio ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                </span>
                Write a short bio
              </div>
            </div>

            {/* Quick tip */}
            {completionScore < 100 && (
              <div
                className="mt-1 rounded-lg p-3 text-[12px] leading-relaxed"
                style={{
                  background: 'rgba(255, 225, 53, 0.06)',
                  border: '1px solid rgba(255, 225, 53, 0.12)',
                  color: 'var(--text-secondary)',
                }}
              >
                <strong style={{ color: 'var(--accent-yellow)' }}>💡 Tip:</strong>{' '}
                Profiles with 80%+ completion get <strong>3× more matches</strong> from recruiters.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SEO */}
      <div className="hidden" aria-hidden="true">
        <title>Student Profile | TalentSync</title>
        <meta name="description" content="Manage your personal details, bio, resume, and certifications to improve your AI match quality." />
      </div>
    </div>
  )
}
