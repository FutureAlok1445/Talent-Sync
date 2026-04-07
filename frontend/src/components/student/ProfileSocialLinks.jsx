import { useState } from 'react'
import { Link2, Plus, X, Save } from 'lucide-react'

const MAX_LINKS = 6

function isValidUrl(str) {
  try {
    const url = new URL(str)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export default function ProfileSocialLinks({
  socialLinks,
  setSocialLinks,
  saving,
  error,
  onSave,
}) {
  const [linkErrors, setLinkErrors] = useState({})

  const updateLink = (idx, val) => {
    setSocialLinks((prev) => prev.map((l, i) => (i === idx ? val : l)))
    if (linkErrors[idx]) {
      setLinkErrors((prev) => ({ ...prev, [idx]: null }))
    }
  }

  const addLink = () => {
    if (socialLinks.length < MAX_LINKS) {
      setSocialLinks((prev) => [...prev, ''])
    }
  }

  const removeLink = (idx) => {
    setSocialLinks((prev) => prev.filter((_, i) => i !== idx))
    setLinkErrors((prev) => {
      const next = { ...prev }
      delete next[idx]
      return next
    })
  }

  const validateLink = (idx) => {
    const val = socialLinks[idx]?.trim()
    if (val && !isValidUrl(val)) {
      setLinkErrors((prev) => ({ ...prev, [idx]: 'Invalid URL format' }))
    }
  }

  return (
    <div
      className="profile-section-card"
      style={{ '--card-accent': '#A855F7' }}
      id="profile-social-links"
    >
      <div className="profile-section-header">
        <div className="profile-section-icon" style={{ background: 'linear-gradient(135deg, #A855F7, #9333EA)' }}>
          <Link2 size={18} />
        </div>
        <div>
          <h2 className="font-heading text-base font-bold" style={{ color: 'var(--text-primary)' }}>
            Social Links
          </h2>
          <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            Connect your online presence
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {socialLinks.map((link, idx) => (
          <div key={idx}>
            <div className="flex items-center gap-2">
              <input
                value={link}
                onChange={(e) => updateLink(idx, e.target.value)}
                onBlur={() => validateLink(idx)}
                placeholder={
                  idx === 0
                    ? 'https://linkedin.com/in/...'
                    : 'https://github.com/...'
                }
                className="profile-input flex-1"
                type="url"
              />
              {idx > 0 && (
                <button
                  type="button"
                  onClick={() => removeLink(idx)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors"
                  style={{ color: 'var(--text-muted)' }}
                  aria-label="Remove link"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'
                    e.currentTarget.style.color = 'var(--danger)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent'
                    e.currentTarget.style.color = 'var(--text-muted)'
                  }}
                >
                  <X size={16} />
                </button>
              )}
            </div>
            {linkErrors[idx] && (
              <p className="mt-1.5 text-[12px] font-medium" style={{ color: 'var(--danger)' }}>{linkErrors[idx]}</p>
            )}
          </div>
        ))}
      </div>

      {socialLinks.length < MAX_LINKS && (
        <button
          type="button"
          onClick={addLink}
          className="mt-4 flex w-fit items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-all"
          style={{
            color: 'var(--text-secondary)',
            border: '1px dashed var(--border)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--accent-yellow)'
            e.currentTarget.style.color = 'var(--text-primary)'
            e.currentTarget.style.background = 'rgba(255, 225, 53, 0.05)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border)'
            e.currentTarget.style.color = 'var(--text-secondary)'
            e.currentTarget.style.background = 'transparent'
          }}
        >
          <Plus size={14} /> Add Link
        </button>
      )}

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
          {saving ? 'Saving…' : 'Save Links'}
        </button>
      </div>
    </div>
  )
}
