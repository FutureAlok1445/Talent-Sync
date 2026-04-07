import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePostJobForm } from '../../hooks/usePostJobForm'
import { useToast } from '../shared/useToast'
import SkillTagInput from '../ui/SkillTagInput'
import PillSelect from '../ui/PillSelect'
import {
  AlertTriangle,
  Briefcase,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Circle,
  GraduationCap,
  IndianRupee,
  MapPin,
  Sparkles,
  Users,
} from 'lucide-react'

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
  return <p className="text-[12px] font-medium text-(--danger) mt-1.5">{error}</p>
}

function CharCounter({ current, max, warn }) {
  const isWarn = current > (warn || max - 200)
  return (
    <span
      className={`absolute bottom-3 right-4 text-[11px] font-mono select-none ${isWarn ? 'text-(--danger) font-bold' : 'text-(--text-muted)'}`}
    >
      {current}/{max}
    </span>
  )
}

function formatSalary(min, max) {
  if (!min && !max) return 'Salary undisclosed'
  if (min && max) return `INR ${min} - ${max}`
  if (min) return `From INR ${min}`
  return `Up to INR ${max}`
}

function formatSavedAt(timestamp) {
  if (!timestamp) return null
  try {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(new Date(timestamp))
  } catch {
    return null
  }
}

function CollapsibleSection({
  sectionId,
  activeSection,
  onToggle,
  icon,
  title,
  subtitle,
  children,
}) {
  const Icon = icon
  const isOpen = activeSection === sectionId

  return (
    <div className="rounded-lg bg-(--bg-card) border border-(--border)">
      <button
        type="button"
        onClick={() => onToggle(sectionId)}
        className="w-full flex items-center justify-between p-6 text-left"
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-(--bg-subtle) text-(--text-primary)">
            <Icon size={16} />
          </div>
          <div>
            <h3 className="font-heading text-base font-bold text-(--text-primary)">{title}</h3>
            {subtitle && <p className="font-sans text-[12px] text-(--text-muted) mt-0.5">{subtitle}</p>}
          </div>
        </div>
        <ChevronDown
          size={16}
          className={`text-(--text-muted) transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="px-6 pb-6 border-t border-(--border)">
          <div className="pt-5 space-y-5">{children}</div>
        </div>
      )}
    </div>
  )
}

function JobPreviewCard({ formData }) {
  const {
    companyName,
    title,
    jobType,
    workMode,
    location,
    skills,
    salaryMin,
    salaryMax,
    description,
    minCgpa,
    openings,
  } = formData

  const summary = (description || '').replace(/\s+/g, ' ').trim().slice(0, 120)

  return (
    <div className="flex flex-col gap-5 rounded-lg border border-(--border) bg-(--bg-card) p-6">
      <div>
        <h2 className="font-heading text-lg font-bold text-(--text-primary)">
          {title || 'Job Title'}
        </h2>
        <p className="font-sans text-[13px] text-(--text-secondary) mt-1">
          {companyName || 'Company Name'} <span className="mx-1.5 opacity-50">•</span> {location || (workMode === 'REMOTE' ? 'Remote' : 'Location')}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {jobType && (
          <span className="rounded-full bg-(--bg-subtle) px-3 py-1 font-sans text-[11px] font-semibold uppercase tracking-widest text-(--text-secondary)">
            {JOB_TYPE_OPTIONS.find((opt) => opt.value === jobType)?.label || jobType}
          </span>
        )}
        {workMode && (
          <span className="rounded-full bg-(--bg-subtle) px-3 py-1 font-sans text-[11px] font-semibold uppercase tracking-widest text-(--text-secondary)">
            {WORK_MODE_OPTIONS.find((opt) => opt.value === workMode)?.label || workMode}
          </span>
        )}
        {(salaryMin || salaryMax) && (
          <span className="rounded-full border border-(--accent-yellow) bg-(--accent-yellow)/10 px-3 py-1 font-sans text-[11px] font-semibold uppercase tracking-widest text-(--accent-yellow)">
            {formatSalary(salaryMin, salaryMax)}
          </span>
        )}
        {openings > 0 && (
          <span className="rounded-full bg-(--bg-subtle) px-3 py-1 font-sans text-[11px] font-semibold uppercase tracking-widest text-(--text-secondary)">
            {openings} Opening{openings > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {skills?.length > 0 && (
        <div className="mt-2">
          <p className="font-sans text-[11px] font-semibold uppercase tracking-widest text-(--text-muted) mb-2">Required Skills</p>
          <div className="flex flex-wrap gap-1.5">
            {skills.slice(0, 6).map((skill) => (
              <span key={skill} className="rounded-sm border border-(--border) bg-(--bg-base) px-2 py-1 text-[12px] font-medium text-(--text-primary)">
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-md border border-(--border) bg-(--bg-base) p-3 text-[12px] text-(--text-secondary)">
        {summary || 'Job summary preview will appear once you start writing the description.'}
      </div>

      <div className="flex items-center justify-between text-[12px] text-(--text-secondary)">
        <span>Work Mode: {workMode || 'Not set'}</span>
        <span>Min CGPA: {minCgpa || 'Not set'}</span>
      </div>
    </div>
  )
}

export default function PostJobPage() {
  const navigate = useNavigate()
  const toast = useToast()

  const {
    formData,
    errors,
    handleChange,
    handleSubmit,
    handleGenerateDescription,
    validateStepOne,
    validateStepTwo,
    discardDraft,
    lastSavedAt,
    hasDraft,
    isLoading,
    isGeneratingDescription,
  } = usePostJobForm('')

  const [step, setStep] = useState(1)
  const [activeSection, setActiveSection] = useState('basic')
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)

  const minDeadline = (() => {
    const d = new Date()
    d.setDate(d.getDate() + 3)
    return d.toISOString().split('T')[0]
  })()

  const onToggleSection = (sectionId) => {
    setActiveSection((current) => (current === sectionId ? '' : sectionId))
  }

  const goToStep = (targetStep) => {
    if (targetStep === 2 && !validateStepOne()) {
      toast.error('Complete required fields in Step 1 before proceeding.')
      return
    }
    setStep(targetStep)
    setActiveSection(targetStep === 1 ? 'basic' : 'details')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const onGenerateDescription = async () => {
    try {
      await handleGenerateDescription()
      toast.success('AI description generated. You can edit it before posting.')
    } catch (err) {
      toast.error(err?.message || 'Unable to generate job description right now.')
    }
  }

  const onSubmit = async (e) => {
    e.preventDefault()

    if (step === 1) {
      goToStep(2)
      return
    }

    if (!validateStepTwo()) {
      toast.error('Complete required fields in Job Details before posting.')
      return
    }

    try {
      const result = await handleSubmit()
      if (!result) return
      toast.success('Job Posted!')
      navigate('/recruiter/dashboard')
    } catch (err) {
      toast.error(err?.message || 'Unable to post this job right now. Please try again shortly.')
    }
  }

  const openDeadlinePicker = (e) => {
    e.currentTarget.showPicker?.()
  }

  const inputClass = 'w-full rounded-md border border-(--border) bg-(--bg-base) px-3 py-2 text-[13px] text-(--text-primary) placeholder:text-(--text-muted) focus:border-(--border-strong) focus:outline-none transition-colors'
  const labelClass = 'mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-(--text-muted)'

  const requiredChecklist = useMemo(() => {
    const locationDone = !formData.workMode
      ? false
      : formData.workMode === 'REMOTE'
        ? true
        : Boolean(formData.location?.trim())
    const openingsDone = String(formData.openings ?? '').trim() !== '' && Number(formData.openings) >= 1

    return [
      { label: 'Company Name', done: Boolean(formData.companyName?.trim()) },
      { label: 'Job Title', done: Boolean(formData.title?.trim()) },
      { label: 'Description (100+ chars)', done: Boolean(formData.description?.trim().length >= 100) },
      { label: 'Skills', done: (formData.skills?.length || 0) > 0 },
      { label: 'Experience Level', done: Boolean(formData.experienceLevel) },
      { label: 'Job Type', done: Boolean(formData.jobType) },
      { label: 'Work Mode', done: Boolean(formData.workMode) },
      { label: 'Location', done: locationDone },
      { label: 'Openings', done: openingsDone },
      { label: 'Deadline', done: Boolean(formData.deadline) },
    ]
  }, [formData])

  const missingRequired = requiredChecklist.filter((item) => !item.done)
  const completionPercent = Math.round(((requiredChecklist.length - missingRequired.length) / requiredChecklist.length) * 100)

  const qualityHints = useMemo(() => {
    const hints = []
    if ((formData.description?.trim().length || 0) < 180) {
      hints.push('Increase description to 180+ characters for stronger relevance scoring.')
    }
    if ((formData.skills?.length || 0) < 3) {
      hints.push('Add at least 3 specific technical skills to improve match quality.')
    }
    if (!formData.aboutCompany?.trim()) {
      hints.push('Add a short company context to increase candidate trust and apply rate.')
    }
    if (formData.jobType === 'INTERNSHIP' && !formData.duration?.trim()) {
      hints.push('Set internship duration to make expectations clearer for students.')
    }
    return hints
  }, [formData])

  const savedAtLabel = formatSavedAt(lastSavedAt)

  return (
    <section className="flex flex-col gap-8 pb-12 w-full max-w-none">
      <header>
        <h1 className="font-heading text-[26px] font-bold text-(--text-primary)">Post a New Job</h1>
        <p className="font-sans text-[14px] text-(--text-secondary)">
          Create a clear role description for better candidate matching.
        </p>
      </header>

      <div className="rounded-lg border border-(--border) bg-(--bg-card) p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => goToStep(1)}
              className={`rounded-md px-3 py-1.5 text-[12px] font-semibold uppercase tracking-wider transition-colors ${
                step === 1
                  ? 'bg-(--accent-yellow) text-(--text-on-accent)'
                  : 'bg-(--bg-subtle) text-(--text-secondary) hover:text-(--text-primary)'
              }`}
            >
              Step 1: Basics
            </button>
            <button
              type="button"
              onClick={() => goToStep(2)}
              className={`rounded-md px-3 py-1.5 text-[12px] font-semibold uppercase tracking-wider transition-colors ${
                step === 2
                  ? 'bg-(--accent-yellow) text-(--text-on-accent)'
                  : 'bg-(--bg-subtle) text-(--text-secondary) hover:text-(--text-primary)'
              }`}
            >
              Step 2: Details
            </button>
          </div>

          <div className="flex items-center gap-2 text-[12px] text-(--text-secondary)">
            {hasDraft && <span className="text-(--accent-cyan)">Draft autosave enabled</span>}
            {savedAtLabel && <span>Saved at {savedAtLabel}</span>}
          </div>
        </div>

        <div className="mt-3 h-1 w-full rounded-full bg-(--bg-subtle)">
          <div
            className="h-1 rounded-full bg-(--accent-yellow) transition-all"
            style={{ width: `${step === 1 ? 50 : 100}%` }}
          />
        </div>
      </div>

      <div className="flex flex-col lg:flex-row items-start gap-8">
        <div className="w-full lg:w-[65%]">
          <form onSubmit={onSubmit} className="flex flex-col gap-6">
            {step === 1 && (
              <>
                <CollapsibleSection
                  sectionId="basic"
                  activeSection={activeSection}
                  onToggle={onToggleSection}
                  icon={Briefcase}
                  title="Basic Info"
                  subtitle="Job title, company name, and role summary"
                >
                  <div>
                    <label htmlFor="post-job-title" className={labelClass}>
                      Job Title <span className="text-(--danger)">*</span>
                    </label>
                    <input
                      id="post-job-title"
                      type="text"
                      value={formData.title}
                      onChange={(e) => handleChange('title', e.target.value)}
                      placeholder="e.g. Frontend Developer Intern"
                      className={inputClass}
                      maxLength={100}
                    />
                    <FieldError error={errors.title} />
                  </div>

                  <div>
                    <label htmlFor="post-job-company-name" className={labelClass}>
                      Company Name <span className="text-(--danger)">*</span>
                    </label>
                    <input
                      id="post-job-company-name"
                      type="text"
                      value={formData.companyName}
                      onChange={(e) => handleChange('companyName', e.target.value)}
                      placeholder="e.g. Oriac Innovations"
                      className={inputClass}
                      maxLength={120}
                    />
                    <FieldError error={errors.companyName} />
                  </div>

                  <div className="relative">
                    <div className="mb-1.5 flex items-center justify-between gap-3">
                      <label htmlFor="post-job-description" className={labelClass}>
                        Job Description <span className="text-(--danger)">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={onGenerateDescription}
                        disabled={isGeneratingDescription || isLoading}
                        className="inline-flex items-center gap-1.5 rounded-md border border-(--border) bg-(--bg-subtle) px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-(--text-secondary) transition-colors hover:border-(--border-strong) hover:text-(--text-primary) disabled:opacity-50"
                      >
                        <Sparkles size={12} />
                        {isGeneratingDescription ? 'Generating...' : 'Generate with AI'}
                      </button>
                    </div>
                    <textarea
                      id="post-job-description"
                      value={formData.description}
                      onChange={(e) => handleChange('description', e.target.value)}
                      placeholder="Describe responsibilities, expectations, and what makes this role exciting (min 100 chars)..."
                      className={`${inputClass} min-h-40 resize-y pb-8`}
                      maxLength={2000}
                    />
                    <CharCounter current={formData.description.length} max={2000} warn={1800} />
                    <FieldError error={errors.description} />
                  </div>
                </CollapsibleSection>

                <CollapsibleSection
                  sectionId="requirements"
                  activeSection={activeSection}
                  onToggle={onToggleSection}
                  icon={GraduationCap}
                  title="Requirements"
                  subtitle="Skills, experience, and optional eligibility filters"
                >
                  <div>
                    <label className={labelClass}>
                      Skills <span className="text-(--danger)">*</span>
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

                  <div>
                    <label className={labelClass}>
                      Experience Level <span className="text-(--danger)">*</span>
                    </label>
                    <PillSelect
                      id="post-job-experience"
                      options={EXPERIENCE_OPTIONS}
                      value={formData.experienceLevel}
                      onChange={(val) => handleChange('experienceLevel', val)}
                    />
                    <FieldError error={errors.experienceLevel} />
                  </div>

                  <div>
                    <label htmlFor="post-job-education" className={labelClass}>Education</label>
                    <select
                      id="post-job-education"
                      value={formData.education}
                      onChange={(e) => handleChange('education', e.target.value)}
                      className={`${inputClass} appearance-none cursor-pointer bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M7%2010L12%2015L17%2010%22%20stroke%3D%22%239CA3AF%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-size-[20px] bg-position-[right_8px_center] bg-no-repeat pr-10`}
                    >
                      {EDUCATION_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>

                  <div className="rounded-md border border-(--border) bg-(--bg-base) p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[12px] font-semibold uppercase tracking-widest text-(--text-muted)">
                        Advanced Filters
                      </p>
                      <button
                        type="button"
                        onClick={() => setShowAdvancedFilters((prev) => !prev)}
                        className="text-[12px] font-semibold uppercase tracking-wider text-(--accent-cyan) hover:opacity-80"
                      >
                        {showAdvancedFilters ? 'Hide' : 'Show'}
                      </button>
                    </div>

                    {showAdvancedFilters && (
                      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div>
                          <label htmlFor="post-job-min-cgpa" className={labelClass}>Min CGPA (0-10)</label>
                          <input
                            id="post-job-min-cgpa"
                            type="number"
                            step="0.1"
                            min={0}
                            max={10}
                            value={formData.minCgpa}
                            onChange={(e) => handleChange('minCgpa', e.target.value)}
                            placeholder="e.g. 7.0"
                            className={inputClass}
                          />
                        </div>

                        <div>
                          <label className={labelClass}>Eligible Branches</label>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {['CS', 'IT', 'ECE', 'EEE', 'ME', 'CE', 'AIML', 'DS', 'Any'].map((branch) => {
                              const selected = formData.eligibleBranches.includes(branch)
                              return (
                                <button
                                  key={branch}
                                  type="button"
                                  onClick={() => {
                                    const next = selected
                                      ? formData.eligibleBranches.filter((b) => b !== branch)
                                      : [...formData.eligibleBranches, branch]
                                    handleChange('eligibleBranches', next)
                                  }}
                                  className={`rounded-md border px-3 py-1.5 text-[12px] font-semibold transition-colors cursor-pointer ${
                                    selected
                                      ? 'border-(--accent-yellow) bg-(--accent-yellow)/15 text-(--accent-yellow)'
                                      : 'border-(--border) bg-(--bg-base) text-(--text-secondary) hover:border-(--border-strong)'
                                  }`}
                                >
                                  {branch}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </CollapsibleSection>
              </>
            )}

            {step === 2 && (
              <>
                <CollapsibleSection
                  sectionId="details"
                  activeSection={activeSection}
                  onToggle={onToggleSection}
                  icon={MapPin}
                  title="Job Details"
                  subtitle="Type, mode, salary, and location"
                >
                  <div>
                    <label className={labelClass}>
                      Job Type <span className="text-(--danger)">*</span>
                    </label>
                    <PillSelect
                      id="post-job-type"
                      options={JOB_TYPE_OPTIONS}
                      value={formData.jobType}
                      onChange={(val) => handleChange('jobType', val)}
                    />
                    <FieldError error={errors.jobType} />
                  </div>

                  <div>
                    <label className={labelClass}>
                      Work Mode <span className="text-(--danger)">*</span>
                    </label>
                    <PillSelect
                      id="post-job-workmode"
                      options={WORK_MODE_OPTIONS}
                      value={formData.workMode}
                      onChange={(val) => handleChange('workMode', val)}
                    />
                    <FieldError error={errors.workMode} />
                  </div>

                  <div>
                    <label htmlFor="post-job-location" className={labelClass}>
                      Location {formData.workMode !== 'REMOTE' && <span className="text-(--danger)">*</span>}
                    </label>
                    <input
                      id="post-job-location"
                      type="text"
                      value={formData.location}
                      onChange={(e) => handleChange('location', e.target.value)}
                      placeholder={formData.workMode === 'REMOTE' ? 'Not required for remote' : 'e.g. Bangalore, Mumbai'}
                      className={`${inputClass} ${formData.workMode === 'REMOTE' ? 'opacity-50 cursor-not-allowed bg-(--bg-subtle)' : ''}`}
                      disabled={formData.workMode === 'REMOTE'}
                    />
                    <FieldError error={errors.location} />
                  </div>

                  <div>
                    <label className={labelClass}>Salary Range (INR)</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="relative">
                        <IndianRupee size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-(--text-muted)" />
                        <input
                          id="post-job-salary-min"
                          type="number"
                          value={formData.salaryMin}
                          onChange={(e) => handleChange('salaryMin', e.target.value)}
                          placeholder="Min salary"
                          className={`${inputClass} pl-8`}
                          min={0}
                        />
                      </div>
                      <div className="relative">
                        <IndianRupee size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-(--text-muted)" />
                        <input
                          id="post-job-salary-max"
                          type="number"
                          value={formData.salaryMax}
                          onChange={(e) => handleChange('salaryMax', e.target.value)}
                          placeholder="Max salary"
                          className={`${inputClass} pl-8`}
                          min={0}
                        />
                        <FieldError error={errors.salaryMax} />
                      </div>
                    </div>
                  </div>

                  {formData.jobType === 'INTERNSHIP' && (
                    <div>
                      <label htmlFor="post-job-duration" className={labelClass}>Duration</label>
                      <input
                        id="post-job-duration"
                        type="text"
                        value={formData.duration}
                        onChange={(e) => handleChange('duration', e.target.value)}
                        placeholder="e.g. 3 months, 6 months"
                        className={inputClass}
                      />
                    </div>
                  )}

                  <div>
                    <label htmlFor="post-job-openings" className={labelClass}>
                      Number of Openings <span className="text-(--danger)">*</span>
                    </label>
                    <div className="relative max-w-50">
                      <Users size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-(--text-muted)" />
                      <input
                        id="post-job-openings"
                        type="number"
                        value={formData.openings}
                        onChange={(e) => handleChange('openings', e.target.value)}
                        className={`${inputClass} pl-8`}
                        min={1}
                      />
                    </div>
                    <FieldError error={errors.openings} />
                  </div>
                </CollapsibleSection>

                <CollapsibleSection
                  sectionId="extra"
                  activeSection={activeSection}
                  onToggle={onToggleSection}
                  icon={Sparkles}
                  title="Extra"
                  subtitle="Deadline, perks, and company info"
                >
                  <div>
                    <label htmlFor="post-job-deadline" className={labelClass}>
                      Application Deadline <span className="text-(--danger)">*</span>
                    </label>
                    <div className="relative max-w-75">
                      <Calendar size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-(--text-muted)" />
                      <input
                        id="post-job-deadline"
                        type="date"
                        value={formData.deadline}
                        onChange={(e) => handleChange('deadline', e.target.value)}
                        onClick={openDeadlinePicker}
                        onFocus={openDeadlinePicker}
                        min={minDeadline}
                        className={`${inputClass} pl-8 pr-10 cursor-pointer`}
                      />
                    </div>
                    <FieldError error={errors.deadline} />
                  </div>

                  <div>
                    <label className={labelClass}>Perks / Benefits</label>
                    <SkillTagInput
                      id="post-job-perks"
                      tags={formData.perks}
                      onChange={(tags) => handleChange('perks', tags)}
                      placeholder="Health Insurance, Flexible hours..."
                      maxTags={10}
                    />
                  </div>

                  <div className="relative">
                    <label htmlFor="post-job-about" className={labelClass}>About Company</label>
                    <textarea
                      id="post-job-about"
                      value={formData.aboutCompany}
                      onChange={(e) => handleChange('aboutCompany', e.target.value)}
                      placeholder="Briefly describe your company, culture, and what makes it special..."
                      className={`${inputClass} min-h-25 resize-y pb-8`}
                      maxLength={500}
                    />
                    <CharCounter current={formData.aboutCompany.length} max={500} />
                  </div>
                </CollapsibleSection>
              </>
            )}

            <div className="mt-2 flex flex-col sm:flex-row gap-3">
              {step === 2 && (
                <button
                  type="button"
                  onClick={() => goToStep(1)}
                  className="sm:w-45 rounded-md border border-(--border) bg-(--bg-subtle) px-4 py-3 font-sans text-[12px] font-semibold tracking-widest uppercase text-(--text-primary) transition-colors hover:border-(--border-strong)"
                >
                  Back to Step 1
                </button>
              )}

              <button
                id="post-job-submit"
                type={step === 1 ? 'button' : 'submit'}
                onClick={step === 1 ? () => goToStep(2) : undefined}
                disabled={isLoading}
                className="flex-1 rounded-md bg-(--text-primary) px-4 py-3.5 font-sans text-[13px] font-bold tracking-widest uppercase text-(--bg-base) transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {step === 1
                  ? 'Continue to Step 2'
                  : (isLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="inline-block w-4 h-4 border-2 border-(--bg-base) border-t-transparent rounded-full animate-spin" />
                        POSTING...
                      </span>
                    ) : 'POST JOB')}
              </button>

              {hasDraft && (
                <button
                  type="button"
                  onClick={discardDraft}
                  className="rounded-md border border-(--border) bg-(--bg-card) px-4 py-3 font-sans text-[12px] font-semibold tracking-widest uppercase text-(--text-secondary) transition-colors hover:text-(--danger) hover:border-(--danger)/50"
                >
                  Discard Draft
                </button>
              )}
            </div>
          </form>
        </div>

        <div className="sticky top-20 hidden lg:block lg:w-[35%]">
          <div className="mb-4 rounded-lg border border-(--border) bg-(--bg-card) p-5">
            <div className="flex items-center justify-between">
              <h3 className="font-sans text-[11px] font-semibold uppercase tracking-widest text-(--text-muted)">
                Form Completion
              </h3>
              <span className="font-heading text-[14px] font-bold text-(--text-primary)">{completionPercent}%</span>
            </div>

            <div className="mt-3 h-2 w-full rounded-full bg-(--bg-subtle)">
              <div
                className="h-2 rounded-full bg-(--accent-yellow) transition-all"
                style={{ width: `${completionPercent}%` }}
              />
            </div>

            <div className="mt-4 space-y-2">
              {requiredChecklist.map((item) => (
                <div key={item.label} className="flex items-center gap-2 text-[12px]">
                  {item.done ? (
                    <CheckCircle2 size={14} className="text-(--success)" />
                  ) : (
                    <Circle size={14} className="text-(--text-muted)" />
                  )}
                  <span className={item.done ? 'text-(--text-primary)' : 'text-(--text-secondary)'}>
                    {item.label}
                  </span>
                </div>
              ))}
            </div>

            {qualityHints.length > 0 && (
              <div className="mt-4 rounded-md border border-(--warning)/40 bg-(--warning)/10 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-(--warning) mb-2">
                  Quality Suggestions
                </p>
                <div className="space-y-1.5">
                  {qualityHints.slice(0, 2).map((hint) => (
                    <div key={hint} className="flex gap-2 text-[12px] text-(--text-secondary)">
                      <AlertTriangle size={13} className="mt-0.5 text-(--warning)" />
                      <span>{hint}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4 text-[11px] text-(--text-muted)">
              {savedAtLabel ? `Draft saved at ${savedAtLabel}` : 'Start typing to enable autosave'}
            </div>

            {missingRequired.length > 0 && (
              <p className="mt-2 text-[11px] text-(--danger)">
                {missingRequired.length} required field{missingRequired.length > 1 ? 's' : ''} remaining
              </p>
            )}
          </div>

          <h3 className="font-sans text-[11px] font-semibold uppercase tracking-widest text-(--text-muted) mb-3">Live Preview</h3>
          <JobPreviewCard formData={formData} />
          <p className="mt-4 font-sans text-xs text-(--text-secondary) leading-relaxed">
            This preview updates live with your inputs so you can evaluate clarity and candidate appeal before posting.
          </p>
        </div>
      </div>

      <div className="hidden" aria-hidden="true">
        <title>Post a Job | TalentSync Recruiter</title>
        <meta name="description" content="Create a new job posting and start matching with the best students using our AI engine." />
      </div>
    </section>
  )
}
