import { useRef } from 'react'
import { Award, FileBadge, Plus, X } from 'lucide-react'

function VisibilityToggle({ isPublic, onToggle, label }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="text-[11px] font-semibold uppercase tracking-widest"
        style={{ color: isPublic ? 'var(--text-muted)' : 'var(--text-primary)' }}
      >
        Private
      </span>
      <button
        type="button"
        onClick={onToggle}
        className="profile-toggle"
        data-active={isPublic ? 'true' : 'false'}
        aria-label={`Toggle ${label} visibility`}
      >
        <span className="toggle-knob" />
      </button>
      <span
        className="text-[11px] font-semibold uppercase tracking-widest"
        style={{ color: isPublic ? 'var(--text-primary)' : 'var(--text-muted)' }}
      >
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
  if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) return <FileBadge size={20} />
  if (ext === 'pdf') return <FileBadge size={20} />
  return <FileBadge size={20} />
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
    <div
      className="profile-section-card"
      style={{ '--card-accent': '#F59E0B' }}
      id="profile-certifications"
    >
      <div className="profile-section-header" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div className="flex items-center gap-3">
          <div className="profile-section-icon" style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)' }}>
            <Award size={18} />
          </div>
          <div>
            <h2 className="font-heading text-base font-bold" style={{ color: 'var(--text-primary)' }}>
              Certifications
            </h2>
            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              Showcase your achievements
            </p>
          </div>
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
              className="profile-file-card"
            >
              <div className="flex items-center gap-3">
                {cert.url &&
                /\.(jpg|jpeg|png|webp|gif)$/i.test(cert.url) ? (
                  <img
                    src={cert.url}
                    alt={cert.name}
                    className="h-11 w-11 shrink-0 rounded-lg object-cover"
                    style={{ border: '1px solid var(--border)' }}
                  />
                ) : (
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg"
                    style={{
                      background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(217, 119, 6, 0.08))',
                      color: 'var(--warning)',
                    }}
                  >
                    {getFileIcon(cert.name)}
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <p className="truncate font-sans text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {cert.name || 'Certificate'}
                  </p>
                  <p className="font-sans text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    {formatDate(cert.uploadedAt || cert.createdAt)}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onRemove(cert.id)}
                disabled={saving}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors"
                style={{ color: 'var(--text-muted)' }}
                aria-label={`Delete ${cert.name}`}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'
                  e.currentTarget.style.color = 'var(--danger)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = 'var(--text-muted)'
                }}
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={saving}
        className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-[13px] font-medium transition-all"
        style={{
          border: '2px dashed var(--border-strong)',
          background: 'var(--bg-base)',
          color: 'var(--text-secondary)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'var(--accent-yellow)'
          e.currentTarget.style.background = 'rgba(255, 225, 53, 0.03)'
          e.currentTarget.style.color = 'var(--text-primary)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'var(--border-strong)'
          e.currentTarget.style.background = 'var(--bg-base)'
          e.currentTarget.style.color = 'var(--text-secondary)'
        }}
      >
        <Plus size={16} /> Add Certificate
      </button>

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.webp"
        className="hidden"
        onChange={handleFile}
      />

      {error && (
        <p className="mt-3 text-[12px] font-medium" style={{ color: 'var(--danger)' }}>{error}</p>
      )}

      {saving && (
        <p className="mt-3 text-[12px] font-medium" style={{ color: 'var(--text-muted)' }}>Uploading…</p>
      )}
    </div>
  )
}
