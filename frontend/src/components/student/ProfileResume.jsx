/*
 * WHO WRITES THIS: Frontend developer
 * WHAT THIS DOES: Resume subsection — drag/drop upload area, file info display,
 *                 remove button, Public/Private toggle. Uploads via backend.
 * DEPENDS ON: useProfileForm state
 */
import { useCallback, useRef, useState } from 'react'

const MAX_SIZE = 5 * 1024 * 1024 // 5MB

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
    <div className="card-base" id="profile-resume">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-[3px] border-2 border-ink bg-yellow text-sm font-bold shadow-[2px_2px_0_var(--border)]">
            4
          </span>
          <h2 className="text-xl font-bold text-ink">Resume</h2>
        </div>
        <VisibilityToggle
          isPublic={resumePublic}
          onToggle={onTogglePublic}
          label="resume"
        />
      </div>

      {resume ? (
        <div className="flex items-center justify-between rounded-[4px] border-2 border-ink bg-[var(--bg-soft)] p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[3px] border-2 border-ink bg-white text-lg">
              📄
            </div>
            <div>
              <p className="text-sm font-semibold text-ink">
                {resume.name || resume.fileName || 'Resume.pdf'}
              </p>
              <p className="text-xs text-ink/60">
                {formatFileSize(resume.size || resume.fileSize)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onRemove}
            disabled={saving}
            className="icon-btn text-red-600 hover:bg-red-50"
            aria-label="Remove resume"
          >
            ✕
          </button>
        </div>
      ) : (
        <div
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onClick={() => inputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-[4px] border-2 border-dashed p-10 text-center transition-colors ${
            dragOver
              ? 'border-yellow bg-yellow/10'
              : 'border-ink/40 bg-[var(--bg-soft)] hover:border-ink hover:bg-[var(--bg-soft)]'
          }`}
        >
          <span className="mb-2 text-3xl">⬆</span>
          <p className="text-sm font-semibold text-ink">
            Drag & drop your resume or click to browse
          </p>
          <p className="mt-1 text-xs text-ink/50">PDF only • Max 5MB</p>
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
        <p className="mt-3 text-xs font-medium text-red-600">
          {fileError || error}
        </p>
      )}

      {saving && (
        <p className="mt-3 text-xs font-medium text-ink/60">Uploading…</p>
      )}
    </div>
  )
}
