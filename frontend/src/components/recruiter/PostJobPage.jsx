import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { usePostJobForm } from '../../hooks/usePostJobForm'
import { useToast } from '../shared/useToast'
import SkillTagInput from '../ui/SkillTagInput'
import PillSelect from '../ui/PillSelect'
import { Briefcase, MapPin, IndianRupee, Calendar, Users, GraduationCap, Sparkles } from 'lucide-react'

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

const EDUCATION_OPTIONS = ['Any', 'B.Tech', 'M.Tech', 'MBA', 'BCA', 'MCA', 'PhD']

function FieldError({ error }) {
  if (!error) return null
  return <p className="text-xs font-mono mt-1" style={{ color: '#e53e3e' }}>{error}</p>
}

function SectionHeader({ icon: Icon, title, subtitle }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="flex items-center justify-center w-9 h-9 border-2 border-ink bg-yellow rounded-[3px] shadow-[2px_2px_0_var(--border)]">
        <Icon size={18} strokeWidth={2.5} />
      </div>
      <div>
        <h3 className="text-sm font-bold uppercase tracking-wider">{title}</h3>
        {subtitle && <p className="text-xs opacity-60">{subtitle}</p>}
      </div>
    </div>
  )
}

function CharCounter({ current, max, warn }) {
  const isWarn = current > (warn || max - 200)
  return (
    <span
      className="absolute bottom-3 right-4 text-[10px] font-mono select-none"
      style={{ color: isWarn ? '#e53e3e' : 'var(--text-muted)', opacity: 0.7 }}
    >
      {current}/{max}
    </span>
  )
}

export default function PostJobPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const user = useAuthStore((s) => s.user)
  const { formData, errors, handleChange, handleSubmit, isLoading } = usePostJobForm()

  const companyName = user?.companyName || user?.name || 'Your Company'

  const minDeadline = (() => {
    const d = new Date()
    d.setDate(d.getDate() + 3)
    return d.toISOString().split('T')[0]
  })()

  const onSubmit = async (e) => {
    e.preventDefault()
    try {
      await handleSubmit()
      toast.success('Job Posted! ✓')
      navigate('/recruiter/dashboard')
    } catch (err) {
      toast.error(err.message || 'Something went wrong.')
    }
  }

  return (
    <section className="stack-base max-w-3xl mx-auto">
      {/* Page Header */}
      <header className="mb-2">
        <h1 className="text-primary-hero">Post a New Job</h1>
        <p className="text-secondary mt-1">
          Create a clear role description for better candidate matching.
        </p>
      </header>

      <form onSubmit={onSubmit} className="space-y-0">
        <div className="card-base space-y-8">

          {/* ── Section 1: Basic Info ────────────────────── */}
          <div>
            <SectionHeader icon={Briefcase} title="Basic Info" subtitle="Job title and description" />

            <div className="space-y-4">
              {/* Title */}
              <div>
                <label htmlFor="post-job-title" className="block text-xs font-bold uppercase tracking-wider mb-1.5">
                  Job Title <span style={{ color: '#e53e3e' }}>*</span>
                </label>
                <input
                  id="post-job-title"
                  type="text"
                  value={formData.title}
                  onChange={(e) => handleChange('title', e.target.value)}
                  placeholder="e.g. Frontend Developer Intern"
                  className="input-brutal"
                  maxLength={100}
                />
                <FieldError error={errors.title} />
              </div>

              {/* Company (read-only) */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1.5">
                  Company Name
                </label>
                <input
                  type="text"
                  value={companyName}
                  readOnly
                  className="input-brutal opacity-60 cursor-not-allowed"
                />
              </div>

              {/* Description */}
              <div className="relative">
                <label htmlFor="post-job-description" className="block text-xs font-bold uppercase tracking-wider mb-1.5">
                  Job Description <span style={{ color: '#e53e3e' }}>*</span>
                </label>
                <textarea
                  id="post-job-description"
                  value={formData.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  placeholder="Describe responsibilities, expectations, and what makes this role exciting (min 100 chars)..."
                  className="input-brutal min-h-[160px] resize-y pb-8"
                  maxLength={2000}
                />
                <CharCounter current={formData.description.length} max={2000} warn={1800} />
                <FieldError error={errors.description} />
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t-2 border-ink" />

          {/* ── Section 2: Requirements ──────────────────── */}
          <div>
            <SectionHeader icon={GraduationCap} title="Requirements" subtitle="Skills, experience, and education" />

            <div className="space-y-4">
              {/* Skills */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1.5">
                  Skills <span style={{ color: '#e53e3e' }}>*</span>
                </label>
                <SkillTagInput
                  id="post-job-skills"
                  tags={formData.skills}
                  onChange={(tags) => handleChange('skills', tags)}
                  placeholder="React, Python, Docker..."
                  maxTags={15}
                />
                <FieldError error={errors.skills} />
              </div>

              {/* Experience Level */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1.5">
                  Experience Level <span style={{ color: '#e53e3e' }}>*</span>
                </label>
                <PillSelect
                  id="post-job-experience"
                  options={EXPERIENCE_OPTIONS}
                  value={formData.experienceLevel}
                  onChange={(val) => handleChange('experienceLevel', val)}
                />
                <FieldError error={errors.experienceLevel} />
              </div>

              {/* Education */}
              <div>
                <label htmlFor="post-job-education" className="block text-xs font-bold uppercase tracking-wider mb-1.5">
                  Education
                </label>
                <select
                  id="post-job-education"
                  value={formData.education}
                  onChange={(e) => handleChange('education', e.target.value)}
                  className="input-brutal appearance-none cursor-pointer"
                >
                  {EDUCATION_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t-2 border-ink" />

          {/* ── Section 3: Job Details ───────────────────── */}
          <div>
            <SectionHeader icon={MapPin} title="Job Details" subtitle="Type, mode, salary, and location" />

            <div className="space-y-4">
              {/* Job Type */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1.5">
                  Job Type <span style={{ color: '#e53e3e' }}>*</span>
                </label>
                <PillSelect
                  id="post-job-type"
                  options={JOB_TYPE_OPTIONS}
                  value={formData.jobType}
                  onChange={(val) => handleChange('jobType', val)}
                />
                <FieldError error={errors.jobType} />
              </div>

              {/* Work Mode */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1.5">
                  Work Mode <span style={{ color: '#e53e3e' }}>*</span>
                </label>
                <PillSelect
                  id="post-job-workmode"
                  options={WORK_MODE_OPTIONS}
                  value={formData.workMode}
                  onChange={(val) => handleChange('workMode', val)}
                />
                <FieldError error={errors.workMode} />
              </div>

              {/* Location */}
              <div>
                <label htmlFor="post-job-location" className="block text-xs font-bold uppercase tracking-wider mb-1.5">
                  Location {formData.workMode !== 'REMOTE' && <span style={{ color: '#e53e3e' }}>*</span>}
                </label>
                <input
                  id="post-job-location"
                  type="text"
                  value={formData.location}
                  onChange={(e) => handleChange('location', e.target.value)}
                  placeholder={formData.workMode === 'REMOTE' ? 'Not required for remote' : 'e.g. Bangalore, Mumbai'}
                  className={`input-brutal ${formData.workMode === 'REMOTE' ? 'opacity-40 cursor-not-allowed' : ''}`}
                  disabled={formData.workMode === 'REMOTE'}
                />
                <FieldError error={errors.location} />
              </div>

              {/* Salary Range */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1.5">
                  Salary Range
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold opacity-50">₹</span>
                    <input
                      id="post-job-salary-min"
                      type="number"
                      value={formData.salaryMin}
                      onChange={(e) => handleChange('salaryMin', e.target.value)}
                      placeholder="Min salary"
                      className="input-brutal pl-8"
                      min={0}
                    />
                  </div>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold opacity-50">₹</span>
                    <input
                      id="post-job-salary-max"
                      type="number"
                      value={formData.salaryMax}
                      onChange={(e) => handleChange('salaryMax', e.target.value)}
                      placeholder="Max salary"
                      className="input-brutal pl-8"
                      min={0}
                    />
                    <FieldError error={errors.salaryMax} />
                  </div>
                </div>
              </div>

              {/* Duration — only for Internship */}
              {formData.jobType === 'INTERNSHIP' && (
                <div>
                  <label htmlFor="post-job-duration" className="block text-xs font-bold uppercase tracking-wider mb-1.5">
                    Duration
                  </label>
                  <input
                    id="post-job-duration"
                    type="text"
                    value={formData.duration}
                    onChange={(e) => handleChange('duration', e.target.value)}
                    placeholder="e.g. 3 months, 6 months"
                    className="input-brutal"
                  />
                </div>
              )}

              {/* Openings */}
              <div>
                <label htmlFor="post-job-openings" className="block text-xs font-bold uppercase tracking-wider mb-1.5">
                  Number of Openings <span style={{ color: '#e53e3e' }}>*</span>
                </label>
                <div className="flex items-center gap-2 max-w-[200px]">
                  <Users size={16} className="opacity-50" />
                  <input
                    id="post-job-openings"
                    type="number"
                    value={formData.openings}
                    onChange={(e) => handleChange('openings', e.target.value)}
                    className="input-brutal"
                    min={1}
                  />
                </div>
                <FieldError error={errors.openings} />
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t-2 border-ink" />

          {/* ── Section 4: Extra ─────────────────────────── */}
          <div>
            <SectionHeader icon={Sparkles} title="Extra" subtitle="Deadline, perks, and company info" />

            <div className="space-y-4">
              {/* Deadline */}
              <div>
                <label htmlFor="post-job-deadline" className="block text-xs font-bold uppercase tracking-wider mb-1.5">
                  Application Deadline <span style={{ color: '#e53e3e' }}>*</span>
                </label>
                <div className="flex items-center gap-2 max-w-[300px]">
                  <Calendar size={16} className="opacity-50" />
                  <input
                    id="post-job-deadline"
                    type="date"
                    value={formData.deadline}
                    onChange={(e) => handleChange('deadline', e.target.value)}
                    min={minDeadline}
                    className="input-brutal"
                  />
                </div>
                <FieldError error={errors.deadline} />
              </div>

              {/* Perks */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1.5">
                  Perks / Benefits
                </label>
                <SkillTagInput
                  id="post-job-perks"
                  tags={formData.perks}
                  onChange={(tags) => handleChange('perks', tags)}
                  placeholder="Health Insurance, Flexible hours..."
                  maxTags={10}
                />
              </div>

              {/* About Company */}
              <div className="relative">
                <label htmlFor="post-job-about" className="block text-xs font-bold uppercase tracking-wider mb-1.5">
                  About Company
                </label>
                <textarea
                  id="post-job-about"
                  value={formData.aboutCompany}
                  onChange={(e) => handleChange('aboutCompany', e.target.value)}
                  placeholder="Briefly describe your company, culture, and what makes it special..."
                  className="input-brutal min-h-[100px] resize-y pb-8"
                  maxLength={500}
                />
                <CharCounter current={formData.aboutCompany.length} max={500} />
              </div>
            </div>
          </div>
        </div>

        {/* Submit */}
        <button
          id="post-job-submit"
          type="submit"
          disabled={isLoading}
          className="btn-primary btn-feedback w-full mt-6 text-base py-4 font-bold tracking-widest"
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="inline-block w-4 h-4 border-2 border-ink border-t-transparent rounded-full animate-spin" />
              POSTING...
            </span>
          ) : (
            'POST JOB'
          )}
        </button>
      </form>
      {/* SEO Metadata heuristic fix */}
      <div className="hidden" aria-hidden="true">
        <title>Post a Job | TalentSync Recruiter</title>
        <meta name="description" content="Create a new job posting and start matching with the best students using our AI engine." />
        <meta property="og:title" content="Post a Job | TalentSync Recruiter" />
        <meta property="og:description" content="Create a new job posting and start matching with the best students using our AI engine." />
      </div>
    </section>
  )
}