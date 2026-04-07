import { FileText, Save } from 'lucide-react'

const MAX_BIO = 406
const WARN_THRESHOLD = 380

export default function ProfileBio({ bio, setBio, saving, error, onSave }) {
  const charCount = bio.length
  const isWarn = charCount > WARN_THRESHOLD

  return (
    <div
      className="profile-section-card"
      style={{ '--card-accent': '#00B8D9' }}
      id="profile-bio"
    >
      <div className="profile-section-header">
        <div className="profile-section-icon" style={{ background: 'linear-gradient(135deg, #00B8D9, #0097B2)' }}>
          <FileText size={18} />
        </div>
        <div>
          <h2 className="font-heading text-base font-bold" style={{ color: 'var(--text-primary)' }}>
            Bio
          </h2>
          <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            Tell recruiters about yourself
          </p>
        </div>
      </div>

      <div className="relative">
        <textarea
          value={bio}
          onChange={(e) => {
            if (e.target.value.length <= MAX_BIO) {
              setBio(e.target.value)
            }
          }}
          placeholder="Tell recruiters a bit about yourself..."
          maxLength={MAX_BIO}
          rows={5}
          className="profile-input resize-none"
          style={{ minHeight: '130px', borderRadius: '10px' }}
        />
        <span
          className="absolute bottom-3 right-3 font-mono text-[11px] transition-colors"
          style={{
            color: isWarn ? 'var(--danger)' : 'var(--text-muted)',
            fontWeight: isWarn ? '700' : '400',
          }}
        >
          {charCount} / {MAX_BIO}
        </span>
      </div>

      {error && (
        <p className="mt-3 text-[12px] font-medium" style={{ color: 'var(--danger)' }}>{error}</p>
      )}

      <div className="mt-6 flex justify-end pt-4" style={{ borderTop: '1px solid var(--border)' }}>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="profile-save-btn"
        >
          <Save size={14} />
          {saving ? 'Saving…' : 'Save Bio'}
        </button>
      </div>
    </div>
  )
}
