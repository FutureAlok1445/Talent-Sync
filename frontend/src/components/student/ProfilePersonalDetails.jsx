import { useState } from 'react'
import { User, Save } from 'lucide-react'

const WORK_MODE_OPTIONS = [
  { value: '', label: 'Select work mode' },
  { value: 'REMOTE', label: 'Remote' },
  { value: 'HYBRID', label: 'Hybrid' },
  { value: 'ONSITE', label: 'On-site' },
]

function TagInput({ tags, onChange, placeholder, label }) {
  const [input, setInput] = useState('')

  const addTag = () => {
    const val = input.trim()
    if (val && !tags.includes(val)) {
      onChange([...tags, val])
    }
    setInput('')
  }

  const removeTag = (idx) => {
    onChange(tags.filter((_, i) => i !== idx))
  }

  const onKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag()
    }
    if (e.key === 'Backspace' && input === '' && tags.length > 0) {
      onChange(tags.slice(0, -1))
    }
  }

  return (
    <div>
      <label className="profile-label">{label}</label>
      <div
        className="flex min-h-[44px] flex-wrap items-center gap-2 rounded-lg p-2.5 transition-all"
        style={{
          border: '1px solid var(--border)',
          background: 'var(--bg-base)',
        }}
      >
        {tags.map((tag, idx) => (
          <span key={`${tag}-${idx}`} className="profile-tag">
            {tag}
            <button
              type="button"
              onClick={() => removeTag(idx)}
              aria-label={`Remove ${tag}`}
            >
              ×
            </button>
          </span>
        ))}
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={addTag}
          placeholder={tags.length === 0 ? placeholder : 'Type & press Enter'}
          className="min-w-[120px] flex-1 bg-transparent text-[13px] outline-none"
          style={{ color: 'var(--text-primary)' }}
        />
      </div>
    </div>
  )
}

export default function ProfilePersonalDetails({
  personal,
  setPersonal,
  saving,
  error,
  onSave,
}) {
  const update = (key, value) => setPersonal((prev) => ({ ...prev, [key]: value }))

  return (
    <div
      className="profile-section-card"
      style={{ '--card-accent': '#FFE135' }}
      id="profile-personal"
    >
      <div className="profile-section-header">
        <div className="profile-section-icon" style={{ background: 'linear-gradient(135deg, #FFE135, #FFB800)' }}>
          <User size={18} />
        </div>
        <div>
          <h2 className="font-heading text-base font-bold" style={{ color: 'var(--text-primary)' }}>
            Personal Details
          </h2>
          <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            Basic information about you
          </p>
        </div>
      </div>

      <div className="space-y-5">
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label className="profile-label">Full Name</label>
            <input
              value={personal.fullName}
              onChange={(e) => update('fullName', e.target.value)}
              placeholder="Full name"
              className="profile-input"
            />
          </div>

          <div>
            <label className="profile-label">Email</label>
            <input
              value={personal.email}
              readOnly
              className="profile-input"
              title="Email cannot be changed"
            />
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          <div>
            <label className="profile-label">College</label>
            <input
              value={personal.college}
              onChange={(e) => update('college', e.target.value)}
              placeholder="College name"
              className="profile-input"
            />
          </div>

          <div>
            <label className="profile-label">Branch / Degree</label>
            <input
              value={personal.branch}
              onChange={(e) => update('branch', e.target.value)}
              placeholder="e.g. B.Tech CSE"
              className="profile-input"
            />
          </div>

          <div>
            <label className="profile-label">CGPA</label>
            <input
              value={personal.cgpa}
              onChange={(e) => update('cgpa', e.target.value)}
              placeholder="e.g. 8.5"
              className="profile-input"
              type="text"
              inputMode="decimal"
            />
          </div>
        </div>

        <TagInput
          label="Preferred Roles"
          tags={personal.preferredRoles}
          onChange={(val) => update('preferredRoles', val)}
          placeholder="e.g. Frontend Developer, ML Engineer"
        />

        <div>
          <label className="profile-label">Preferred Work Mode</label>
          <div className="relative">
            <select
              value={personal.preferredWorkMode || ''}
              onChange={(e) => update('preferredWorkMode', e.target.value)}
              className="profile-input appearance-none cursor-pointer"
            >
              {WORK_MODE_OPTIONS.map((option) => (
                <option
                  key={option.value || 'placeholder'}
                  value={option.value}
                  style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}
                >
                  {option.label}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3" style={{ color: 'var(--text-muted)' }}>
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>

        <TagInput
          label="Skills"
          tags={personal.skills}
          onChange={(val) => update('skills', val)}
          placeholder="e.g. React, Python, SQL"
        />

        <div className="grid gap-5 md:grid-cols-3">
          <div>
            <label className="profile-label">Phone</label>
            <input
              value={personal.phone}
              onChange={(e) => update('phone', e.target.value)}
              placeholder="Add later"
              className="profile-input"
              type="tel"
            />
          </div>

          <div>
            <label className="profile-label">Location</label>
            <input
              value={personal.location}
              onChange={(e) => update('location', e.target.value)}
              placeholder="Add later"
              className="profile-input"
            />
          </div>

          <div>
            <label className="profile-label">Address</label>
            <input
              value={personal.address}
              onChange={(e) => update('address', e.target.value)}
              placeholder="Add later"
              className="profile-input"
            />
          </div>
        </div>
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
          {saving ? 'Saving…' : 'Save Details'}
        </button>
      </div>
    </div>
  )
}
