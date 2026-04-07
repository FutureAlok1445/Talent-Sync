import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Activity, ArrowUpDown, CalendarDays, Eye, Loader2, Mail, Pencil, Plus, Search, SlidersHorizontal, Trash2, X } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { analyticsService } from '../../services/analyticsService'
import { jobService } from '../../services/jobService'
import { useAuthStore } from '../../store/authStore'
import { getRecruiterFunnel } from '../../utils/formatters'
import EmptyState from '../shared/EmptyState'
import { SkeletonCard } from '../shared/Skeletons'
import { useToast } from '../shared/useToast'

const EXPERIENCE_OPTIONS = [
  { label: 'Fresher', value: 'FRESHER' },
  { label: 'Intern', value: 'INTERN' },
  { label: 'Junior', value: 'JUNIOR' },
  { label: 'Mid', value: 'MID' },
  { label: 'Senior', value: 'SENIOR' },
]

const JOB_TYPE_OPTIONS = [
  { label: 'Full-Time', value: 'FULL_TIME' },
  { label: 'Part-Time', value: 'PART_TIME' },
  { label: 'Internship', value: 'INTERNSHIP' },
  { label: 'Contract', value: 'CONTRACT' },
]

const WORK_MODE_OPTIONS = [
  { label: 'Remote', value: 'REMOTE' },
  { label: 'Hybrid', value: 'HYBRID' },
  { label: 'On-Site', value: 'ONSITE' },
]

const SORT_OPTIONS = [
  { label: 'Recently Updated', value: 'updated_desc' },
  { label: 'Most Applicants', value: 'applications_desc' },
  { label: 'Openings: High to Low', value: 'openings_desc' },
  { label: 'Role Title (A-Z)', value: 'title_asc' },
]

const APPLICANT_FILTER_OPTIONS = [
  { label: 'Any Applicants', value: '0' },
  { label: 'At least 5', value: '5' },
  { label: 'At least 10', value: '10' },
  { label: 'At least 25', value: '25' },
]

const MotionElement = motion

function toFriendlyMessage(error, fallback) {
  const status = error?.response?.status
  if (status === 401 || status === 403) return 'Your session has expired. Please sign in again.'
  if (status === 404) return 'The selected job could not be found.'
  if (status === 429) return 'Too many requests right now. Please retry in a moment.'
  return fallback
}

function getJobsFromPayload(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.items)) return payload.items
  return []
}

function getOptionLabel(options, value, fallback = 'Not set') {
  return options.find((item) => item.value === value)?.label || value || fallback
}

function toTimestamp(value) {
  if (!value) return 0
  const stamp = new Date(value).getTime()
  return Number.isFinite(stamp) ? stamp : 0
}

function formatRelativeTime(value) {
  const stamp = toTimestamp(value)
  if (!stamp) return 'recently'

  const diffMs = Date.now() - stamp
  if (diffMs < 60 * 1000) return 'just now'

  const diffMinutes = Math.floor(diffMs / (60 * 1000))
  if (diffMinutes < 60) return `${diffMinutes}m ago`

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}h ago`

  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`

  return new Date(stamp).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
  })
}

function getInitials(value) {
  const raw = String(value || '').trim()
  if (!raw) return 'TS'
  const parts = raw.split(/\s+/).filter(Boolean)
  if (!parts.length) return 'TS'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase()
}

function formatSalaryRange(min, max) {
  const hasMin = Number.isFinite(Number(min))
  const hasMax = Number.isFinite(Number(max))
  if (!hasMin && !hasMax) return 'Not disclosed'
  if (hasMin && hasMax) return `INR ${Number(min).toLocaleString('en-IN')} - INR ${Number(max).toLocaleString('en-IN')}`
  if (hasMin) return `From INR ${Number(min).toLocaleString('en-IN')}`
  return `Up to INR ${Number(max).toLocaleString('en-IN')}`
}

function formatDeadline(value) {
  if (!value) return 'Not set'
  const stamp = new Date(value)
  if (Number.isNaN(stamp.getTime())) return 'Not set'
  return stamp.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function getCompanyLabel(job, recruiter) {
  return String(
    job?.companyName
    || job?.company
    || recruiter?.companyName
    || 'Company Not Provided',
  )
}

function normalizeEditForm(job) {
  return {
    title: String(job?.title || ''),
    jobType: String(job?.jobType || ''),
    workMode: String(job?.workMode || ''),
    experienceLevel: String(job?.experienceLevel || ''),
    location: String(job?.location || ''),
    openings: String(job?.openings ?? 1),
    salaryMin: job?.salaryMin ?? '',
    salaryMax: job?.salaryMax ?? '',
    duration: String(job?.duration || ''),
  }
}

function validateEditForm(form) {
  if (!form.title || form.title.trim().length < 3) {
    return 'Title must be at least 3 characters.'
  }
  if (!form.jobType) {
    return 'Select a job type.'
  }
  if (!form.workMode) {
    return 'Select a work mode.'
  }
  if (!form.experienceLevel) {
    return 'Select an experience level.'
  }
  if (form.workMode !== 'REMOTE' && !form.location?.trim()) {
    return 'Location is required for non-remote roles.'
  }

  const openings = Number(form.openings)
  if (!Number.isFinite(openings) || openings < 1) {
    return 'Openings must be at least 1.'
  }

  const hasMin = form.salaryMin !== '' && form.salaryMin != null
  const hasMax = form.salaryMax !== '' && form.salaryMax != null
  if (hasMin && hasMax && Number(form.salaryMin) >= Number(form.salaryMax)) {
    return 'Max salary must be greater than min salary.'
  }

  return null
}

function PremiumModal({
  open,
  title,
  subtitle,
  onClose,
  maxWidth = 'max-w-4xl',
  children,
}) {
  useEffect(() => {
    if (!open) return undefined

    const handleEscape = (event) => {
      if (event.key === 'Escape') onClose?.()
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [onClose, open])

  return (
    <AnimatePresence>
      {open ? (
        <MotionElement.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) onClose?.()
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          <MotionElement.div
            className={`w-full ${maxWidth} overflow-hidden rounded-2xl border border-(--border) bg-(--bg-card)/95 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl`}
            onMouseDown={(event) => event.stopPropagation()}
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 10 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex items-start justify-between gap-4 border-b border-(--border) px-5 py-4">
              <div className="min-w-0">
                <h3 className="truncate font-heading text-[19px] font-bold text-(--text-primary)">{title}</h3>
                {subtitle ? <p className="mt-1 text-[12px] text-(--text-secondary)">{subtitle}</p> : null}
              </div>

              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-(--border) bg-(--bg-subtle) text-(--text-secondary) transition-colors hover:border-(--border-strong) hover:text-(--text-primary)"
                aria-label="Close"
              >
                <X size={15} />
              </button>
            </div>

            <div className="max-h-[76vh] overflow-y-auto p-5">{children}</div>
          </MotionElement.div>
        </MotionElement.div>
      ) : null}
    </AnimatePresence>
  )
}

const MetricCard = memo(function MetricCard({ label, value, hint, tone = 'neutral' }) {
  const toneClass =
    tone === 'positive'
      ? 'border-(--success)/35 bg-(--success)/10'
      : tone === 'accent'
      ? 'border-(--accent-cyan)/45 bg-(--accent-cyan)/10'
      : tone === 'warning'
      ? 'border-(--warning)/35 bg-(--warning)/10'
      : 'border-(--border) bg-(--bg-card)'

  return (
    <article className={`rounded-lg border p-4 ${toneClass}`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-(--text-muted)">{label}</p>
      <p className="mt-2 font-mono text-[30px] font-bold leading-none text-(--text-primary)">{value}</p>
      <p className="mt-2 text-[12px] text-(--text-secondary)">{hint}</p>
    </article>
  )
})

const FunnelSparkline = memo(function FunnelSparkline({ funnel }) {
  if (!Array.isArray(funnel) || funnel.length === 0) return null

  const maxCount = Math.max(1, ...funnel.map((stage) => Number(stage.count) || 0))

  return (
    <div className="grid gap-2">
      {funnel.map((stage) => {
        const count = Number(stage.count) || 0
        const width = Math.max(10, Math.round((count / maxCount) * 100))
        return (
          <div key={stage.key} className="grid grid-cols-[88px_1fr_40px] items-center gap-2">
            <span className="text-[11px] uppercase tracking-widest text-(--text-muted)">{stage.label}</span>
            <div className="h-2 rounded-full bg-(--bg-subtle)">
              <div
                className="h-2 rounded-full bg-linear-to-r from-(--accent-cyan) to-(--success)"
                style={{ width: `${width}%` }}
              />
            </div>
            <span className="text-right text-[12px] font-semibold text-(--text-primary)">{count}</span>
          </div>
        )
      })}
    </div>
  )
})

const JobListItem = memo(function JobListItem({
  job,
  recruiter,
  onViewCandidates,
  onViewDetails,
  onEdit,
  onDelete,
  deleting,
}) {
  const companyName = getCompanyLabel(job, recruiter)
  const recruiterName = String(recruiter?.fullName || job.recruiterName || 'Recruiter')
  const recruiterEmail = String(recruiter?.email || job.recruiterEmail || 'email@company.com')
  const recruiterAvatar = recruiter?.avatarUrl || recruiter?.photoUrl || recruiter?.avatar || ''

  const location = job.location || (job.workMode === 'REMOTE' ? 'Remote' : 'Location not set')
  const applications = Number(job.applicationCount) || 0
  const openings = Number(job.openings) || 1
  const workModeLabel = getOptionLabel(WORK_MODE_OPTIONS, job.workMode, 'Work mode not set')
  const experienceLabel = getOptionLabel(EXPERIENCE_OPTIONS, job.experienceLevel, 'Experience not set')
  const jobTypeLabel = getOptionLabel(JOB_TYPE_OPTIONS, job.jobType, 'Type not set')
  const updatedLabel = formatRelativeTime(job.updatedAt || job.createdAt)
  const description = String(job.description || 'No description added yet.')

  return (
    <article className="group flex flex-col gap-4 rounded-xl border border-(--border) bg-(--bg-card) p-5 transition-all hover:border-(--border-strong) hover:shadow-[0_10px_30px_rgba(0,0,0,0.16)]">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-heading text-[18px] font-bold text-(--text-primary)">{companyName}</p>
          <div className="mt-3 flex items-center gap-3 rounded-lg border border-(--border) bg-(--bg-subtle) px-3 py-2.5">
            {recruiterAvatar ? (
              <img
                src={recruiterAvatar}
                alt={recruiterName}
                className="h-10 w-10 rounded-full border border-(--border) object-cover"
              />
            ) : (
              <span className="flex h-10 w-10 items-center justify-center rounded-full border border-(--border) bg-(--bg-base) font-heading text-[12px] font-bold text-(--text-primary)">
                {getInitials(recruiterName || recruiterEmail)}
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-(--text-primary)">{recruiterName}</p>
              <p className="truncate text-[11px] text-(--text-secondary)">
                <Mail size={11} className="mr-1 inline-block" />
                {recruiterEmail}
              </p>
            </div>
          </div>
        </div>

        <span className={`self-start rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest ${
          job.isActive
            ? 'bg-(--success)/15 text-(--success) border border-(--success)/30'
            : 'bg-(--danger)/15 text-(--danger) border border-(--danger)/30'
        }`}>
          {job.isActive ? 'Active' : 'Closed'}
        </span>
      </div>

      <div className="space-y-1.5">
        <p className="text-[17px] font-bold text-(--text-primary)">{job.title}</p>
        <p
          className="text-[13px] leading-5 text-(--text-secondary)"
          style={{
            display: '-webkit-box',
            overflow: 'hidden',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {description}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-(--border) bg-(--bg-base) px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-(--text-secondary)">
          {jobTypeLabel}
        </span>
        <span className="rounded-full border border-(--border) bg-(--bg-base) px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-(--text-secondary)">
          {location}
        </span>
        <span className="rounded-full border border-(--border) bg-(--bg-base) px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-(--text-secondary)">
          {workModeLabel}
        </span>
        <span className="rounded-full border border-(--border) bg-(--bg-base) px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-(--text-secondary)">
          {experienceLabel}
        </span>
        <span className="rounded-full border border-(--border) bg-(--bg-base) px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-(--text-secondary)">
          {openings} opening{openings > 1 ? 's' : ''}
        </span>
        <span className="text-[11px] text-(--text-muted)">Updated {updatedLabel}</span>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onViewCandidates(job.id)}
          className="rounded-md border border-(--border-strong) bg-(--bg-base) px-3 py-2 font-sans text-[12px] font-medium text-(--text-primary) transition-colors hover:bg-(--text-primary) hover:text-(--bg-base)"
        >
          View Candidates ({applications})
        </button>
        <button
          type="button"
          onClick={() => onViewDetails(job)}
          className="inline-flex items-center gap-1.5 rounded-md border border-(--border) bg-(--bg-subtle) px-3 py-2 font-sans text-[12px] font-medium text-(--text-primary) transition-colors hover:border-(--border-strong) hover:bg-(--bg-base)"
        >
          <Eye size={13} /> View Details
        </button>
        <button
          type="button"
          onClick={() => onEdit(job)}
          className="inline-flex items-center gap-1.5 rounded-md border border-(--border) bg-(--bg-base) px-3 py-2 font-sans text-[12px] font-medium text-(--text-secondary) transition-colors hover:border-(--border-strong) hover:text-(--text-primary)"
        >
          <Pencil size={13} /> Edit
        </button>
        <button
          type="button"
          onClick={() => onDelete(job)}
          disabled={deleting}
          className="inline-flex items-center gap-1.5 rounded-md border border-(--danger)/40 bg-(--danger)/10 px-3 py-2 font-sans text-[12px] font-medium text-(--danger) transition-colors hover:bg-(--danger)/20 disabled:opacity-60"
        >
          {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
          Delete
        </button>
      </div>
    </article>
  )
})

function EditJobModal({
  open,
  form,
  error,
  saving,
  onChange,
  onClose,
  onSave,
}) {
  if (!open) return null

  const inputClass = 'w-full rounded-md border border-(--border) bg-(--bg-base) px-3 py-2 text-[13px] text-(--text-primary) placeholder:text-(--text-muted) focus:border-(--border-strong) focus:outline-none transition-colors'
  const labelClass = 'mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-(--text-muted)'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-2xl rounded-lg border border-(--border) bg-(--bg-card) shadow-2xl">
        <div className="flex items-center justify-between border-b border-(--border) px-5 py-4">
          <div>
            <h3 className="font-heading text-[18px] font-bold text-(--text-primary)">Edit Job Posting</h3>
            <p className="text-[12px] text-(--text-secondary)">Update your existing job details.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-(--border) bg-(--bg-subtle) p-2 text-(--text-secondary) hover:text-(--text-primary)"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {error && (
            <div className="rounded-md border border-(--danger)/40 bg-(--danger)/10 px-3 py-2 text-[12px] text-(--danger)">
              {error}
            </div>
          )}

          <div>
            <label className={labelClass}>Job Title</label>
            <input
              value={form.title}
              onChange={(e) => onChange('title', e.target.value)}
              className={inputClass}
              maxLength={100}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>Job Type</label>
              <select
                value={form.jobType}
                onChange={(e) => onChange('jobType', e.target.value)}
                className={inputClass}
              >
                <option value="">Select</option>
                {JOB_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Work Mode</label>
              <select
                value={form.workMode}
                onChange={(e) => onChange('workMode', e.target.value)}
                className={inputClass}
              >
                <option value="">Select</option>
                {WORK_MODE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Experience</label>
              <select
                value={form.experienceLevel}
                onChange={(e) => onChange('experienceLevel', e.target.value)}
                className={inputClass}
              >
                <option value="">Select</option>
                {EXPERIENCE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Location</label>
              <input
                value={form.location}
                onChange={(e) => onChange('location', e.target.value)}
                disabled={form.workMode === 'REMOTE'}
                className={`${inputClass} ${form.workMode === 'REMOTE' ? 'opacity-60 cursor-not-allowed bg-(--bg-subtle)' : ''}`}
                placeholder={form.workMode === 'REMOTE' ? 'Not required for remote' : 'e.g. Bangalore'}
              />
            </div>
            <div>
              <label className={labelClass}>Openings</label>
              <input
                type="number"
                min={1}
                value={form.openings}
                onChange={(e) => onChange('openings', e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Salary Min</label>
              <input
                type="number"
                min={0}
                value={form.salaryMin}
                onChange={(e) => onChange('salaryMin', e.target.value)}
                className={inputClass}
                placeholder="Optional"
              />
            </div>
            <div>
              <label className={labelClass}>Salary Max</label>
              <input
                type="number"
                min={0}
                value={form.salaryMax}
                onChange={(e) => onChange('salaryMax', e.target.value)}
                className={inputClass}
                placeholder="Optional"
              />
            </div>
          </div>

          {form.jobType === 'INTERNSHIP' && (
            <div>
              <label className={labelClass}>Duration</label>
              <input
                value={form.duration}
                onChange={(e) => onChange('duration', e.target.value)}
                className={inputClass}
                placeholder="e.g. 3 months"
              />
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-(--border) px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-(--border) bg-(--bg-subtle) px-4 py-2 text-[12px] font-semibold uppercase tracking-widest text-(--text-primary)"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-md bg-(--text-primary) px-4 py-2 text-[12px] font-semibold uppercase tracking-widest text-(--bg-base) disabled:opacity-60"
          >
            {saving && <Loader2 size={13} className="animate-spin" />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  )
}

function DeleteConfirmModal({ open, title, loading, onCancel, onConfirm }) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-lg border border-(--border) bg-(--bg-card) p-5">
        <h3 className="font-heading text-[18px] font-bold text-(--text-primary)">Delete Job Posting</h3>
        <p className="mt-2 text-[13px] text-(--text-secondary)">
          Are you sure you want to delete
          <span className="font-semibold text-(--text-primary)"> {title || 'this job'} </span>
          ? This will remove it from active postings.
        </p>

        <div className="mt-5 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-(--border) bg-(--bg-subtle) px-4 py-2 text-[12px] font-semibold uppercase tracking-widest text-(--text-primary)"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-md border border-(--danger)/50 bg-(--danger)/15 px-4 py-2 text-[12px] font-semibold uppercase tracking-widest text-(--danger) disabled:opacity-60"
          >
            {loading && <Loader2 size={13} className="animate-spin" />}
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

function JobDetailsModal({ open, job, recruiter, onClose }) {
  if (!job) return null

  const companyName = getCompanyLabel(job, recruiter)
  const recruiterName = String(recruiter?.fullName || job.recruiterName || 'Recruiter')
  const recruiterEmail = String(recruiter?.email || job.recruiterEmail || 'email@company.com')
  const location = job.location || (job.workMode === 'REMOTE' ? 'Remote' : 'Not set')
  const jobTypeLabel = getOptionLabel(JOB_TYPE_OPTIONS, job.jobType, 'Not set')
  const workModeLabel = getOptionLabel(WORK_MODE_OPTIONS, job.workMode, 'Not set')
  const experienceLabel = getOptionLabel(EXPERIENCE_OPTIONS, job.experienceLevel, 'Not set')

  return (
    <PremiumModal
      open={open}
      onClose={onClose}
      title={job.title || 'Job Details'}
      subtitle={`${companyName} • ${recruiterName}`}
      maxWidth="max-w-4xl"
    >
      <div className="space-y-5">
        <div className="rounded-xl border border-(--border) bg-(--bg-base) p-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-(--text-muted)">Recruiter</p>
          <p className="text-[14px] font-semibold text-(--text-primary)">{recruiterName}</p>
          <p className="text-[12px] text-(--text-secondary)">{recruiterEmail}</p>
        </div>

        <div className="rounded-xl border border-(--border) bg-(--bg-base) p-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-(--text-muted)">Full Description</p>
          <p className="whitespace-pre-wrap text-[13px] leading-6 text-(--text-primary)">{job.description || 'No description available.'}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-lg border border-(--border) bg-(--bg-base) px-3.5 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-(--text-muted)">Job Type</p>
            <p className="mt-1 text-[13px] font-semibold text-(--text-primary)">{jobTypeLabel}</p>
          </div>
          <div className="rounded-lg border border-(--border) bg-(--bg-base) px-3.5 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-(--text-muted)">Work Mode</p>
            <p className="mt-1 text-[13px] font-semibold text-(--text-primary)">{workModeLabel}</p>
          </div>
          <div className="rounded-lg border border-(--border) bg-(--bg-base) px-3.5 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-(--text-muted)">Location</p>
            <p className="mt-1 text-[13px] font-semibold text-(--text-primary)">{location}</p>
          </div>
          <div className="rounded-lg border border-(--border) bg-(--bg-base) px-3.5 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-(--text-muted)">Experience</p>
            <p className="mt-1 text-[13px] font-semibold text-(--text-primary)">{experienceLabel}</p>
          </div>
          <div className="rounded-lg border border-(--border) bg-(--bg-base) px-3.5 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-(--text-muted)">Openings</p>
            <p className="mt-1 text-[13px] font-semibold text-(--text-primary)">{Number(job.openings) || 1}</p>
          </div>
          <div className="rounded-lg border border-(--border) bg-(--bg-base) px-3.5 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-(--text-muted)">Salary Range</p>
            <p className="mt-1 text-[13px] font-semibold text-(--text-primary)">{formatSalaryRange(job.salaryMin, job.salaryMax)}</p>
          </div>
        </div>

        <div className="rounded-xl border border-(--border) bg-(--bg-base) p-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-(--text-muted)">Required Skills</p>
          {Array.isArray(job.skills) && job.skills.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {job.skills.map((skill) => (
                <span
                  key={`${job.id}-${skill}`}
                  className="rounded-full border border-(--border) bg-(--bg-subtle) px-2.5 py-1 text-[11px] font-medium text-(--text-primary)"
                >
                  {skill}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-[12px] text-(--text-secondary)">No skills specified.</p>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-(--border) bg-(--bg-base) p-4">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-(--text-muted)">Deadline</p>
            <p className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-(--text-primary)">
              <CalendarDays size={13} /> {formatDeadline(job.deadline)}
            </p>
          </div>
          <div className="rounded-xl border border-(--border) bg-(--bg-base) p-4">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-(--text-muted)">Company Overview</p>
            <p className="text-[13px] text-(--text-primary)">{job.aboutCompany || 'No company overview provided.'}</p>
          </div>
        </div>
      </div>
    </PremiumModal>
  )
}

export default function RecruiterDashboard() {
  const navigate = useNavigate()
  const toast = useToast()
  const user = useAuthStore((state) => state.user)

  const [jobs, setJobs] = useState([])
  const [funnel, setFunnel] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadTick, setReloadTick] = useState(0)

  const [editingJob, setEditingJob] = useState(null)
  const [editForm, setEditForm] = useState(() => normalizeEditForm(null))
  const [editError, setEditError] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deletingJobId, setDeletingJobId] = useState('')
  const [detailsJob, setDetailsJob] = useState(null)

  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('updated_desc')
  const [jobTypeFilter, setJobTypeFilter] = useState('ALL')
  const [workModeFilter, setWorkModeFilter] = useState('ALL')
  const [experienceFilter, setExperienceFilter] = useState('ALL')
  const [applicantFilter, setApplicantFilter] = useState('0')

  const recruiterIdentity = useMemo(() => ({
    fullName: String(user?.name || '').trim(),
    email: String(user?.email || '').trim(),
    companyName: String(user?.companyName || '').trim(),
    avatarUrl: user?.avatarUrl || user?.photoUrl || user?.avatar || '',
  }), [user])

  const onViewCandidates = useCallback((jobId) => {
    const id = String(jobId || '').trim()
    navigate(id ? `/recruiter/candidates?jobId=${encodeURIComponent(id)}` : '/recruiter/candidates')
  }, [navigate])

  const openEditModal = useCallback((job) => {
    setEditingJob(job)
    setEditForm(normalizeEditForm(job))
    setEditError('')
  }, [])

  const closeEditModal = useCallback(() => {
    if (savingEdit) return
    setEditingJob(null)
    setEditError('')
  }, [savingEdit])

  const handleEditChange = useCallback((field, value) => {
    setEditForm((prev) => {
      const next = { ...prev, [field]: value }
      if (field === 'workMode' && value === 'REMOTE') {
        next.location = ''
      }
      if (field === 'jobType' && value !== 'INTERNSHIP') {
        next.duration = ''
      }
      return next
    })
    if (editError) setEditError('')
  }, [editError])

  const requestDelete = useCallback((job) => {
    setDeleteTarget(job)
  }, [])

  const openDetailsModal = useCallback((job) => {
    setDetailsJob(job)
  }, [])

  const closeDetailsModal = useCallback(() => {
    setDetailsJob(null)
  }, [])

  useEffect(() => {
    let active = true

    const load = async () => {
      setLoading(true)
      setError('')

      const [jobResult, analyticsResult] = await Promise.allSettled([
        jobService.getMyJobs({ is_active: true }),
        analyticsService.getRecruiterAnalytics(),
      ])
      if (!active) return

      const jobPayload = jobResult.status === 'fulfilled' ? jobResult.value : []
      const analyticsPayload = analyticsResult.status === 'fulfilled' ? analyticsResult.value : {}

      setJobs(getJobsFromPayload(jobPayload))
      setFunnel(getRecruiterFunnel(analyticsPayload?.totals || {}))

      if (jobResult.status === 'rejected') {
        setError(toFriendlyMessage(jobResult.reason, 'Some recruiter data could not be loaded.'))
      }

      setLoading(false)
    }

    load().catch((loadError) => {
      if (!active) return
      setJobs([])
      setFunnel([])
      setError(toFriendlyMessage(loadError, 'Unable to load jobs right now.'))
      setLoading(false)
    })

    return () => {
      active = false
    }
  }, [reloadTick])

  const onSaveEdit = useCallback(async () => {
    if (!editingJob) return

    const validationError = validateEditForm(editForm)
    if (validationError) {
      setEditError(validationError)
      return
    }

    const payload = {
      title: editForm.title.trim(),
      jobType: editForm.jobType,
      workMode: editForm.workMode,
      experienceLevel: editForm.experienceLevel,
      location: editForm.workMode === 'REMOTE' ? null : (editForm.location.trim() || null),
      openings: Number(editForm.openings),
      salaryMin: editForm.salaryMin === '' ? null : Number(editForm.salaryMin),
      salaryMax: editForm.salaryMax === '' ? null : Number(editForm.salaryMax),
      duration: editForm.jobType === 'INTERNSHIP' ? (editForm.duration.trim() || null) : null,
    }

    setSavingEdit(true)
    setEditError('')
    try {
      const updated = await jobService.updateJob(editingJob.id, payload)
      setJobs((prev) => prev.map((job) => (job.id === editingJob.id ? { ...job, ...updated } : job)))
      toast.success('Job updated successfully.')
      setEditingJob(null)
    } catch (saveError) {
      setEditError(toFriendlyMessage(saveError, 'Unable to update this job right now.'))
    } finally {
      setSavingEdit(false)
    }
  }, [editForm, editingJob, toast])

  const onConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return

    setDeletingJobId(deleteTarget.id)
    try {
      await jobService.closeJob(deleteTarget.id)
      setJobs((prev) => prev.filter((job) => job.id !== deleteTarget.id))
      setDeleteTarget(null)
      toast.success('Job posting deleted.')
      setReloadTick((value) => value + 1)
    } catch (deleteError) {
      toast.error(toFriendlyMessage(deleteError, 'Unable to delete this job right now.'))
    } finally {
      setDeletingJobId('')
    }
  }, [deleteTarget, toast])

  const filteredJobs = useMemo(() => {
    const searchTerm = searchQuery.trim().toLowerCase()
    const minimumApplicants = Number(applicantFilter) || 0

    const list = jobs.filter((job) => {
      if (jobTypeFilter !== 'ALL' && job.jobType !== jobTypeFilter) return false
      if (workModeFilter !== 'ALL' && job.workMode !== workModeFilter) return false
      if (experienceFilter !== 'ALL' && job.experienceLevel !== experienceFilter) return false

      const applicants = Number(job.applicationCount) || 0
      if (applicants < minimumApplicants) return false

      if (!searchTerm) return true

      const searchBlob = [
        job.title,
        job.location,
        job.jobType,
        job.workMode,
        job.experienceLevel,
        ...(Array.isArray(job.skills) ? job.skills : []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return searchBlob.includes(searchTerm)
    })

    return [...list].sort((left, right) => {
      if (sortBy === 'applications_desc') {
        return (Number(right.applicationCount) || 0) - (Number(left.applicationCount) || 0)
      }
      if (sortBy === 'openings_desc') {
        return (Number(right.openings) || 0) - (Number(left.openings) || 0)
      }
      if (sortBy === 'title_asc') {
        return String(left.title || '').localeCompare(String(right.title || ''))
      }
      return toTimestamp(right.updatedAt || right.createdAt) - toTimestamp(left.updatedAt || left.createdAt)
    })
  }, [applicantFilter, experienceFilter, jobTypeFilter, jobs, searchQuery, sortBy, workModeFilter])

  const hasActiveFilters =
    searchQuery.trim().length > 0
    || jobTypeFilter !== 'ALL'
    || workModeFilter !== 'ALL'
    || experienceFilter !== 'ALL'
    || applicantFilter !== '0'
    || sortBy !== 'updated_desc'

  const clearFilters = useCallback(() => {
    setSearchQuery('')
    setSortBy('updated_desc')
    setJobTypeFilter('ALL')
    setWorkModeFilter('ALL')
    setExperienceFilter('ALL')
    setApplicantFilter('0')
  }, [])

  const dashboardMetrics = useMemo(() => {
    const activeRoles = filteredJobs.length
    const totalApplications = filteredJobs.reduce((sum, job) => sum + (Number(job.applicationCount) || 0), 0)
    const avgApplications = activeRoles ? (totalApplications / activeRoles).toFixed(1) : '0.0'
    const remoteRoles = filteredJobs.filter((job) => job.workMode === 'REMOTE').length
    const internshipRoles = filteredJobs.filter((job) => job.jobType === 'INTERNSHIP').length

    let topRole = null
    for (const job of filteredJobs) {
      if (!topRole || (Number(job.applicationCount) || 0) > (Number(topRole.applicationCount) || 0)) {
        topRole = job
      }
    }

    const appliedCount = Number(funnel.find((stage) => stage.key === 'APPLIED')?.count) || 0
    const shortlistedCount = Number(funnel.find((stage) => stage.key === 'SHORTLISTED')?.count) || 0
    const selectedCount = Number(funnel.find((stage) => stage.key === 'SELECTED')?.count) || 0
    const shortlistRate = appliedCount ? Math.round((shortlistedCount / appliedCount) * 100) : 0
    const offerRate = shortlistedCount ? Math.round((selectedCount / shortlistedCount) * 100) : 0

    return {
      activeRoles,
      totalApplications,
      avgApplications,
      remoteRoles,
      internshipRoles,
      topRole,
      appliedCount,
      shortlistRate,
      offerRate,
    }
  }, [filteredJobs, funnel])

  const lastUpdatedJob = useMemo(() => {
    if (!jobs.length) return null

    return [...jobs].sort(
      (left, right) => toTimestamp(right.updatedAt || right.createdAt) - toTimestamp(left.updatedAt || left.createdAt),
    )[0]
  }, [jobs])

  const activityItems = useMemo(() => {
    const items = []

    if (dashboardMetrics.topRole) {
      const applicants = Number(dashboardMetrics.topRole.applicationCount) || 0
      items.push({
        key: 'top-role',
        title: 'Top demand role',
        detail: `${dashboardMetrics.topRole.title} currently has ${applicants} applicant${applicants === 1 ? '' : 's'}.`,
      })
    }

    if (lastUpdatedJob) {
      items.push({
        key: 'last-updated',
        title: 'Recent update',
        detail: `${lastUpdatedJob.title} was updated ${formatRelativeTime(lastUpdatedJob.updatedAt || lastUpdatedJob.createdAt)}.`,
      })
    }

    if (dashboardMetrics.appliedCount > 0) {
      items.push({
        key: 'conversion',
        title: 'Pipeline conversion',
        detail: `${dashboardMetrics.shortlistRate}% shortlisted from applied, ${dashboardMetrics.offerRate}% selected from shortlisted.`,
      })
    }

    return items.slice(0, 3)
  }, [dashboardMetrics, lastUpdatedJob])

  const controlInputClass = 'w-full rounded-md border border-(--border) bg-(--bg-base) px-3 py-2 text-[12px] text-(--text-primary) placeholder:text-(--text-muted) focus:border-(--border-strong) focus:outline-none transition-colors'

  return (
    <div className="flex flex-col gap-7 pb-12 w-full max-w-none">
      <header className="relative overflow-hidden rounded-xl border border-(--border) bg-linear-to-br from-(--bg-card) via-(--bg-card) to-(--bg-subtle) p-5">
        <div className="pointer-events-none absolute -right-8 -top-10 h-36 w-36 rounded-full bg-(--accent-cyan)/15 blur-2xl" />
        <div className="pointer-events-none absolute -left-8 -bottom-10 h-28 w-28 rounded-full bg-(--success)/15 blur-2xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-heading text-[26px] font-bold text-(--text-primary)">Recruiter Dashboard</h1>
            <p className="font-sans text-[14px] text-(--text-secondary)">Track hiring momentum, manage postings faster, and focus on high-conversion roles.</p>
            {!loading && !error ? (
              <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-(--text-secondary)">
                <span className="rounded-full border border-(--border) bg-(--bg-base) px-2.5 py-1">
                  {dashboardMetrics.activeRoles} active role{dashboardMetrics.activeRoles === 1 ? '' : 's'}
                </span>
                <span className="rounded-full border border-(--border) bg-(--bg-base) px-2.5 py-1">
                  {dashboardMetrics.totalApplications} total applicant{dashboardMetrics.totalApplications === 1 ? '' : 's'}
                </span>
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => navigate('/recruiter/post-job')}
            className="flex items-center justify-center gap-2 rounded-md bg-(--text-primary) px-4 py-2 font-sans text-[13px] font-medium text-(--bg-base) transition-opacity hover:opacity-90"
          >
            <Plus size={16} /> Post New Job
          </button>
        </div>
      </header>

      {loading ? (
        <div className="flex flex-col gap-4">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : null}

      {!loading && error ? (
        <EmptyState
          title="Unable to load jobs"
          subtitle={error}
          actionLabel="Retry"
          onAction={() => setReloadTick((value) => value + 1)}
          icon="!"
        />
      ) : null}

      {!loading && !error && jobs.length === 0 ? (
        <EmptyState
          title="No active jobs"
          subtitle="Create your first posting to start receiving candidates."
          actionLabel="Post First Job"
          onAction={() => navigate('/recruiter/post-job')}
          icon="*"
        />
      ) : null}

      {!loading && !error && jobs.length > 0 ? (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Active Roles"
              value={dashboardMetrics.activeRoles}
              hint={`${jobs.length} total active role${jobs.length === 1 ? '' : 's'} in your account`}
              tone="accent"
            />
            <MetricCard
              label="Total Applicants"
              value={dashboardMetrics.totalApplications}
              hint={`Average ${dashboardMetrics.avgApplications} applicant${dashboardMetrics.avgApplications === '1.0' ? '' : 's'} per role`}
              tone="positive"
            />
            <MetricCard
              label="Remote Roles"
              value={dashboardMetrics.remoteRoles}
              hint={dashboardMetrics.activeRoles
                ? `${Math.round((dashboardMetrics.remoteRoles / dashboardMetrics.activeRoles) * 100)}% of filtered postings`
                : 'No roles match current filters'}
              tone="neutral"
            />
            <MetricCard
              label="Internships"
              value={dashboardMetrics.internshipRoles}
              hint={dashboardMetrics.activeRoles
                ? `${Math.round((dashboardMetrics.internshipRoles / dashboardMetrics.activeRoles) * 100)}% of filtered postings`
                : 'No roles match current filters'}
              tone="warning"
            />
          </section>

          <section className="grid gap-4 xl:grid-cols-[1.7fr_1fr]">
            <article className="rounded-xl border border-(--border) bg-(--bg-card) p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="font-sans text-[11px] font-semibold uppercase tracking-widest text-(--text-muted)">Hiring Funnel</p>
                <span className="text-[11px] text-(--text-secondary)">{dashboardMetrics.shortlistRate}% shortlist rate</span>
              </div>

              {funnel.length > 0 ? (
                <>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {funnel.map((stage) => (
                      <div
                        key={stage.key}
                        className="rounded-lg border border-(--border) bg-(--bg-subtle) p-3"
                        style={{ borderTop: '3px solid var(--accent-cyan)' }}
                      >
                        <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.16em] text-(--text-muted)">
                          {stage.label}
                        </p>
                        <p className="mt-2 font-mono text-[28px] font-bold leading-none text-(--text-primary)">
                          {stage.count}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4">
                    <FunnelSparkline funnel={funnel} />
                  </div>
                </>
              ) : (
                <p className="text-[13px] text-(--text-secondary)">Funnel data will appear as applications progress.</p>
              )}
            </article>

            <article className="rounded-xl border border-(--border) bg-(--bg-card) p-4">
              <div className="mb-3 flex items-center gap-2">
                <Activity size={14} className="text-(--accent-cyan)" />
                <p className="font-sans text-[11px] font-semibold uppercase tracking-widest text-(--text-muted)">Recent Activity</p>
              </div>

              <div className="space-y-3">
                {activityItems.length > 0 ? activityItems.map((item) => (
                  <div key={item.key} className="rounded-md border border-(--border) bg-(--bg-subtle) p-3">
                    <p className="text-[12px] font-semibold text-(--text-primary)">{item.title}</p>
                    <p className="mt-1 text-[12px] text-(--text-secondary)">{item.detail}</p>
                  </div>
                )) : (
                  <p className="text-[12px] text-(--text-secondary)">Postings and funnel activity will show here as data grows.</p>
                )}
              </div>
            </article>
          </section>

          <section className="flex flex-col gap-4">
            <article className="rounded-xl border border-(--border) bg-(--bg-card) p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal size={14} className="text-(--accent-cyan)" />
                  <p className="font-sans text-[11px] font-semibold uppercase tracking-widest text-(--text-muted)">My Postings</p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[12px] text-(--text-secondary)">{filteredJobs.length} of {jobs.length} role{jobs.length === 1 ? '' : 's'}</span>
                  <button
                    type="button"
                    onClick={clearFilters}
                    disabled={!hasActiveFilters}
                    className="rounded-md border border-(--border) bg-(--bg-subtle) px-3 py-2 text-[11px] font-semibold uppercase tracking-widest text-(--text-primary) disabled:opacity-50"
                  >
                    Reset Filters
                  </button>
                </div>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="md:col-span-2 xl:col-span-2">
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.16em] text-(--text-muted)">Search Roles</label>
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-(--text-muted)" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className={`${controlInputClass} pl-9`}
                      placeholder="Search by title, location, or skills"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.16em] text-(--text-muted)">Sort</label>
                  <div className="relative">
                    <ArrowUpDown size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-(--text-muted)" />
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className={`${controlInputClass} pl-9`}
                    >
                      {SORT_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.16em] text-(--text-muted)">Applicant Filter</label>
                  <select
                    value={applicantFilter}
                    onChange={(e) => setApplicantFilter(e.target.value)}
                    className={controlInputClass}
                  >
                    {APPLICANT_FILTER_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.16em] text-(--text-muted)">Job Type</label>
                  <select
                    value={jobTypeFilter}
                    onChange={(e) => setJobTypeFilter(e.target.value)}
                    className={controlInputClass}
                  >
                    <option value="ALL">All Types</option>
                    {JOB_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.16em] text-(--text-muted)">Work Mode</label>
                  <select
                    value={workModeFilter}
                    onChange={(e) => setWorkModeFilter(e.target.value)}
                    className={controlInputClass}
                  >
                    <option value="ALL">All Modes</option>
                    {WORK_MODE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.16em] text-(--text-muted)">Experience</label>
                  <select
                    value={experienceFilter}
                    onChange={(e) => setExperienceFilter(e.target.value)}
                    className={controlInputClass}
                  >
                    <option value="ALL">All Levels</option>
                    {EXPERIENCE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </article>

            {filteredJobs.length > 0 ? (
              <div className="flex flex-col gap-3">
                {filteredJobs.map((job) => (
                  <JobListItem
                    key={job.id}
                    job={job}
                    recruiter={recruiterIdentity}
                    onViewCandidates={onViewCandidates}
                    onViewDetails={openDetailsModal}
                    onEdit={openEditModal}
                    onDelete={requestDelete}
                    deleting={deletingJobId === job.id}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-(--border) bg-(--bg-card) px-4 py-6 text-center">
                <p className="text-[14px] font-semibold text-(--text-primary)">No postings match current filters</p>
                <p className="mt-1 text-[12px] text-(--text-secondary)">Adjust your filters to view more active roles.</p>
                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-4 rounded-md border border-(--border) bg-(--bg-subtle) px-3 py-2 text-[11px] font-semibold uppercase tracking-widest text-(--text-primary)"
                >
                  Clear Filters
                </button>
              </div>
            )}
          </section>
        </>
      ) : null}

      <JobDetailsModal
        open={Boolean(detailsJob)}
        job={detailsJob}
        recruiter={recruiterIdentity}
        onClose={closeDetailsModal}
      />

      <EditJobModal
        open={Boolean(editingJob)}
        form={editForm}
        error={editError}
        saving={savingEdit}
        onChange={handleEditChange}
        onClose={closeEditModal}
        onSave={onSaveEdit}
      />

      <DeleteConfirmModal
        open={Boolean(deleteTarget)}
        title={deleteTarget?.title}
        loading={Boolean(deletingJobId)}
        onCancel={() => (deletingJobId ? null : setDeleteTarget(null))}
        onConfirm={onConfirmDelete}
      />

      <div className="hidden" aria-hidden="true">
        <title>Recruiter Dashboard | TalentSync</title>
        <meta name="description" content="Manage your job postings and monitor the hiring funnel status for all active roles." />
      </div>
    </div>
  )
}
