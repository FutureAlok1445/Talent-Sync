import { useCallback, useRef, useState } from 'react'
import { FileText, Upload, X } from 'lucide-react'

const MAX_SIZE = 5 * 1024 * 1024 // 5MB

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

function formatFileSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function ProfileResume({
  resume,
  resumePublic,
  saving,
  error,
  onUpload,
  onRemove,
  onTogglePublic,
}) {
  const inputRef = useRef(null)
  const [dragOver, setDragOver] = useState(false)
  const [fileError, setFileError] = useState('')

  const handleFile = useCallback(
    (file) => {
      setFileError('')
      if (!file) return

      if (file.type !== 'application/pdf') {
        setFileError('Only PDF files are accepted.')
        return
      }
      if (file.size > MAX_SIZE) {
        setFileError('File exceeds 5MB limit.')
        return
      }
      onUpload(file)
    },
    [onUpload]
  )

  const onDrop = useCallback(
    (e) => {
      e.preventDefault()
      setDragOver(false)
      const file = e.dataTransfer?.files?.[0]
      handleFile(file)
    },
    [handleFile]
  )

  const onDragOver = (e) => {
    e.preventDefault()
    setDragOver(true)
  }

  const onDragLeave = () => setDragOver(false)

  return (
    <div
      className="profile-section-card"
      style={{ '--card-accent': '#22C55E' }}
      id="profile-resume"
    >
      <div className="profile-section-header" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div className="flex items-center gap-3">
          <div className="profile-section-icon" style={{ background: 'linear-gradient(135deg, #22C55E, #16A34A)' }}>
            <Upload size={18} />
          </div>
          <div>
            <h2 className="font-heading text-base font-bold" style={{ color: 'var(--text-primary)' }}>
              Resume
            </h2>
            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              Upload your latest resume
            </p>
          </div>
        </div>
        <VisibilityToggle
          isPublic={resumePublic}
          onToggle={onTogglePublic}
          label="resume"
        />
      </div>

      {resume ? (
        <div className="profile-file-card">
          <div className="flex items-center gap-4">
            <div
              className="flex h-11 w-11 items-center justify-center rounded-lg"
              style={{
                background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.15), rgba(22, 163, 106, 0.08))',
                color: 'var(--success)',
              }}
            >
              <FileText size={20} />
            </div>
            <div>
              <p className="font-sans text-[14px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                {resume.name || resume.fileName || 'Resume.pdf'}
              </p>
              <p className="font-sans text-[12px]" style={{ color: 'var(--text-muted)' }}>
                {formatFileSize(resume.size || resume.fileSize)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onRemove}
            disabled={saving}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors"
            style={{ color: 'var(--text-muted)' }}
            aria-label="Remove resume"
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
        </div>
      ) : (
        <div
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onClick={() => inputRef.current?.click()}
          className={`profile-dropzone ${dragOver ? 'dragging' : ''}`}
        >
          <span className="dropzone-icon mb-3" style={{ color: 'var(--text-secondary)' }}>
            <Upload size={28} />
          </span>
          <p className="font-sans text-[14px] font-semibold" style={{ color: 'var(--text-primary)' }}>
            Drag & drop your resume or click to browse
          </p>
          <p className="mt-1.5 font-sans text-[12px]" style={{ color: 'var(--text-muted)' }}>
            PDF only • Max 5MB
          </p>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,application/pdf"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </div>
      )}

      {(fileError || error) && (
        <p className="mt-3 text-[12px] font-medium" style={{ color: 'var(--danger)' }}>
          {fileError || error}
        </p>
      )}

      {saving && (
        <p className="mt-3 text-[12px] font-medium" style={{ color: 'var(--text-muted)' }}>Uploading…</p>
      )}
    </div>
  )
}
