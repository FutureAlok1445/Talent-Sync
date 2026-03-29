/*
 * WHO WRITES THIS: Frontend developer
 * WHAT THIS DOES: Social Links subsection — first input always visible,
 *                 '+' button adds more (max 6), '×' removes, URL validation on blur.
 * DEPENDS ON: useProfileForm state
 */
import { useState } from 'react'

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
    <div className="card-base" id="profile-social-links">
      <div className="mb-6 flex items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-[3px] border-2 border-ink bg-yellow text-sm font-bold shadow-[2px_2px_0_var(--border)]">
          3
        </span>
        <h2 className="text-xl font-bold text-ink">Social Links</h2>
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
                className="input-brutal flex-1"
                type="url"
              />
              {idx > 0 && (
                <button
                  type="button"
                  onClick={() => removeLink(idx)}
                  className="icon-btn shrink-0 text-red-600 hover:bg-red-50"
                  aria-label="Remove link"
                >
                  ×
                </button>
              )}
            </div>
            {linkErrors[idx] && (
              <p className="mt-1 text-xs text-red-600">{linkErrors[idx]}</p>
            )}
          </div>
        ))}
      </div>

      {socialLinks.length < MAX_LINKS && (
        <button
          type="button"
          onClick={addLink}
          className="mt-4 inline-flex items-center gap-1 rounded-[3px] border-2 border-yellow bg-transparent px-4 py-2 text-xs font-semibold uppercase tracking-wider text-ink transition-colors hover:bg-yellow/20"
        >
          <span className="text-base leading-none">+</span> Add Link
        </button>
      )}

      {error && (
        <p className="mt-3 text-xs font-medium text-red-600">{error}</p>
      )}

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="btn-primary btn-feedback"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}
