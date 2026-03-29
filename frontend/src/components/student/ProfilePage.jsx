/*
 * WHO WRITES THIS: Frontend developer
 * WHAT THIS DOES: Redesigned student profile page with 5 collapsible subsection
 *                 cards — Personal Details, Bio, Social Links, Resume, Certifications.
 *                 Each subsection has its own SAVE button. Uses useProfileForm hook.
 * DEPENDS ON: useProfileForm, all Profile* sub-components, useToast, authStore
 */
import { useToast } from '../shared/useToast'
import { useProfileForm } from '../../hooks/useProfileForm'
import { SkeletonCard } from '../shared/Skeletons'
import ProfilePersonalDetails from './ProfilePersonalDetails'
import ProfileBio from './ProfileBio'
import ProfileSocialLinks from './ProfileSocialLinks'
import ProfileResume from './ProfileResume'
import ProfileCertifications from './ProfileCertifications'
import { useAuthStore } from '../../store/authStore'

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
      <section className="stack-base">
        <header>
          <h1 className="text-primary-hero">Profile</h1>
          <p className="text-secondary">Loading your profile…</p>
        </header>
        <div className="space-y-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </section>
    )
  }

  return (
    <section className="stack-base">
      <header className="mb-2">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-primary-hero">Profile</h1>
            <p className="text-secondary">
              Keep your profile updated for better match quality.
            </p>
          </div>

          {user?.name && (
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-[3px] border-2 border-ink bg-yellow text-lg font-bold shadow-[3px_3px_0_var(--border)]">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-semibold text-ink">{user.name}</p>
                <p className="text-xs text-ink/50">{user.email || user.role || 'Student'}</p>
              </div>
            </div>
          )}
        </div>
      </header>

      {sectionErrors.load && (
        <div className="brutal-panel-error text-xs text-ink">
          {sectionErrors.load}
        </div>
      )}

      <div className="space-y-6">
        <ProfilePersonalDetails
          personal={personal}
          setPersonal={setPersonal}
          saving={sectionSaving.personal}
          error={sectionErrors.personal}
          onSave={savePersonal}
        />

        <ProfileBio
          bio={bio}
          setBio={setBio}
          saving={sectionSaving.bio}
          error={sectionErrors.bio}
          onSave={saveBio}
        />

        <ProfileSocialLinks
          socialLinks={socialLinks}
          setSocialLinks={setSocialLinks}
          saving={sectionSaving.links}
          error={sectionErrors.links}
          onSave={saveSocialLinks}
        />

        <ProfileResume
          resume={resume}
          resumePublic={resumePublic}
          saving={sectionSaving.resume}
          error={sectionErrors.resume}
          onUpload={uploadResume}
          onRemove={removeResume}
          onTogglePublic={toggleResumePublic}
        />

        <ProfileCertifications
          certificates={certificates}
          certificatesPublic={certificatesPublic}
          saving={sectionSaving.certs}
          error={sectionErrors.certs}
          onUpload={uploadCertificate}
          onRemove={removeCertificate}
          onTogglePublic={toggleCertificatesPublic}
        />
      </div>
    </section>
  )
}