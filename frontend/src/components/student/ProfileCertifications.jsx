/*
 * WHO WRITES THIS: Frontend developer
 * WHAT THIS DOES: Certifications subsection — grid of cert cards with
 *                 thumbnails, upload button, delete, Public/Private toggle.
 * DEPENDS ON: useProfileForm state
 */
import { useRef } from 'react'

function VisibilityToggle({ isPublic, onToggle, label }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`text-xs font-semibold uppercase tracking-wider ${isPublic ? 'text-ink/40' : 'text-ink'}`}>
        Private
      </span>
      <button
        type="button"
        onClick={onToggle}
        className={`relative h-7 w-12 shrink-0 rounded-full border-2 border-ink transition-colors ${
          isPublic ? 'bg-yellow' : 'bg-ink/20'
        }`}
        aria-label={`Toggle ${label} visibility`}
      >
        <span
          className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full border-2 border-ink bg-white shadow-[1px_1px_0_var(--border)] transition-transform ${
            isPublic ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
      <span className={`text-xs font-semibold uppercase tracking-wider ${isPublic ? 'text-ink' : 'text-ink/40'}`}>
        Public
      </span>
    </div>
  )
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(dateStr))
  } catch {
    return dateStr
  }
}

function getFileIcon(name) {
  const ext = String(name || '').split('.').pop()?.toLowerCase()
  if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) return '🖼'
  if (ext === 'pdf') return '📄'
  return '📎'
}

export default function ProfileCertifications({
  certificates,
  certificatesPublic,
  saving,
  error,
  onUpload,
  onRemove,
  onTogglePublic,
}) {
  const inputRef = useRef(null)

  const handleFile = (e) => {
    const file = e.target.files?.[0]
    if (file) onUpload(file)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="card-base" id="profile-certifications">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-[3px] border-2 border-ink bg-yellow text-sm font-bold shadow-[2px_2px_0_var(--border)]">
            5
          </span>
          <h2 className="text-xl font-bold text-ink">Certifications</h2>
        </div>
        <VisibilityToggle
          isPublic={certificatesPublic}
          onToggle={onTogglePublic}
          label="certifications"
        />
      </div>

      {certificates.length > 0 && (
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          {certificates.map((cert) => (
            <div
              key={cert.id}
              className="flex items-center gap-3 rounded-[4px] border-2 border-ink bg-[var(--bg-soft)] p-3 transition-shadow hover:shadow-[3px_3px_0_var(--border)]"
            >
              {cert.url &&
              /\.(jpg|jpeg|png|webp|gif)$/i.test(cert.url) ? (
                <img
                  src={cert.url}
                  alt={cert.name}
                  className="h-12 w-12 shrink-0 rounded-[3px] border-2 border-ink object-cover"
                />
              ) : (
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[3px] border-2 border-ink bg-white text-xl">
                  {getFileIcon(cert.name)}
                </div>
              )}

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">
                  {cert.name || 'Certificate'}
                </p>
                <p className="text-xs text-ink/50">
                  {formatDate(cert.uploadedAt || cert.createdAt)}
                </p>
              </div>

              <button
                type="button"
                onClick={() => onRemove(cert.id)}
                disabled={saving}
                className="icon-btn shrink-0 text-red-600 hover:bg-red-50"
                aria-label={`Delete ${cert.name}`}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={saving}
        className="flex w-full items-center justify-center gap-2 rounded-[4px] border-2 border-dashed border-ink/40 bg-[var(--bg-soft)] hover:border-ink hover:bg-[var(--bg-soft)] p-4 text-xs font-semibold uppercase tracking-wider text-ink transition-colors disabled:opacity-60"
      >
        <span className="text-base">+</span> Add Certificate
      </button>

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.webp"
        className="hidden"
        onChange={handleFile}
      />

      {error && (
        <p className="mt-3 text-xs font-medium text-red-600">{error}</p>
      )}

      {saving && (
        <p className="mt-3 text-xs font-medium text-ink/60">Uploading…</p>
      )}
    </div>
  )
}
