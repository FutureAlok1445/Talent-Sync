import { useState, useCallback, useEffect } from 'react'
import { jobService } from '../services/jobService'

const EXPERIENCE_LABELS = {
  FRESHER: 'Fresher',
  INTERN: 'Intern',
  JUNIOR: 'Junior',
  MID: 'Mid',
  SENIOR: 'Senior',
}

const JOB_TYPE_LABELS = {
  FULL_TIME: 'Full-time',
  PART_TIME: 'Part-time',
  INTERNSHIP: 'Internship',
  CONTRACT: 'Contract',
}

const POST_JOB_DRAFT_KEY = 'ts-post-job-draft-v2'

const STEP_ONE_FIELDS = ['companyName', 'title', 'description', 'skills', 'experienceLevel']
const STEP_TWO_FIELDS = ['jobType', 'workMode', 'location', 'salaryMax', 'openings', 'deadline']

const INITIAL_FORM = {
  companyName: '',
  title: '',
  description: '',
  skills: [],
  experienceLevel: '',
  education: 'Any',
  jobType: '',
  workMode: '',
  location: '',
  salaryMin: '',
  salaryMax: '',
  duration: '',
  openings: '',
  deadline: '',
  perks: [],
  aboutCompany: '',
  minCgpa: '',
  eligibleBranches: [],
}

function buildInitialForm(defaultCompanyName = '') {
  return {
    ...INITIAL_FORM,
    companyName: String(defaultCompanyName || '').trim(),
  }
}

function readDraftEnvelope() {
  try {
    const raw = localStorage.getItem(POST_JOB_DRAFT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    if (!parsed.form || typeof parsed.form !== 'object') return null
    return {
      form: parsed.form,
      savedAt: Number.isFinite(parsed.savedAt) ? parsed.savedAt : null,
    }
  } catch {
    return null
  }
}

function writeDraftEnvelope(form, savedAt) {
  try {
    localStorage.setItem(POST_JOB_DRAFT_KEY, JSON.stringify({ form, savedAt }))
  } catch {
    // Ignore storage failures to avoid blocking form usage.
  }
}

function clearDraftEnvelope() {
  try {
    localStorage.removeItem(POST_JOB_DRAFT_KEY)
  } catch {
    // Ignore storage failures to avoid blocking form usage.
  }
}

function hasMeaningfulDraft(formData, defaultCompanyName = '') {
  const baselineCompany = String(defaultCompanyName || '').trim().toLowerCase()
  const currentCompany = String(formData.companyName || '').trim().toLowerCase()

  return Boolean(
    (currentCompany && currentCompany !== baselineCompany)
    || formData.title?.trim()
    || formData.description?.trim()
    || formData.skills?.length
    || formData.experienceLevel
    || formData.jobType
    || formData.workMode
    || formData.location?.trim()
    || formData.salaryMin
    || formData.salaryMax
    || formData.duration?.trim()
    || String(formData.openings ?? '').trim() !== ''
    || formData.deadline
    || formData.perks?.length
    || formData.aboutCompany?.trim()
    || formData.minCgpa
    || formData.eligibleBranches?.length
  )
}

function pickErrorsByFields(allErrors, fields) {
  return fields.reduce((acc, field) => {
    if (allErrors[field]) acc[field] = allErrors[field]
    return acc
  }, {})
}

function mergeStepErrors(previousErrors, stepFields, stepErrors) {
  const next = { ...previousErrors }
  stepFields.forEach((field) => {
    delete next[field]
  })
  return { ...next, ...stepErrors }
}

function inferDomain(title, skills) {
  const merged = `${title || ''} ${(skills || []).join(' ')}`.toLowerCase()

  if (/data|machine learning|ml|ai|analytics/.test(merged)) return 'Data and AI'
  if (/frontend|react|ui|ux|web/.test(merged)) return 'Frontend Engineering'
  if (/backend|api|node|django|flask|fastapi|spring/.test(merged)) return 'Backend Engineering'
  if (/devops|cloud|kubernetes|docker/.test(merged)) return 'Cloud and DevOps'
  return 'Software Engineering'
}

function buildDescriptionText(draft) {
  const responsibilities = (draft?.responsibilities || []).map((item) => `- ${item}`).join('\n')
  const required = (draft?.required_skills || []).map((item) => `- ${item}`).join('\n')
  const preferred = (draft?.preferred_skills || []).map((item) => `- ${item}`).join('\n')
  const learning = (draft?.learning_opportunities || []).map((item) => `- ${item}`).join('\n')

  return [
    `About Company\n${draft?.company_overview || ''}`,
    `Role Summary\n${draft?.role_summary || ''}`,
    `Responsibilities\n${responsibilities}`,
    `Required Skills\n${required}`,
    `Preferred Skills\n${preferred}`,
    `Eligibility\n- CGPA: ${draft?.eligibility?.cgpa || ''}\n- Backlogs: ${draft?.eligibility?.backlogs || ''}\n- Branch: ${draft?.eligibility?.branch || ''}`,
    `Internship Details\n- Duration: ${draft?.internship_details?.duration || ''}\n- Stipend: ${draft?.internship_details?.stipend || ''}\n- Mode: ${draft?.internship_details?.mode || ''}`,
    `Learning Opportunities\n${learning}`,
  ]
    .filter(Boolean)
    .join('\n\n')
    .trim()
}

function parseCgpaEligibility(text) {
  if (!text) return null
  const match = String(text).match(/\d+(?:\.\d+)?/)
  if (!match) return null
  const value = Number(match[0])
  if (Number.isNaN(value)) return null
  return Math.max(0, Math.min(10, value))
}

function validate(data) {
  const errors = {}

  if (!data.companyName || data.companyName.trim().length < 2)
    errors.companyName = 'Company name is required'
  if (data.companyName && data.companyName.trim().length > 120)
    errors.companyName = 'Company name must be under 120 characters'

  if (!data.title || data.title.trim().length < 3)
    errors.title = 'Title must be at least 3 characters'
  if (data.title && data.title.length > 100)
    errors.title = 'Title must be under 100 characters'

  if (!data.description || data.description.trim().length < 100)
    errors.description = 'Description must be at least 100 characters'
  if (data.description && data.description.length > 2000)
    errors.description = 'Description must be under 2000 characters'

  if (!data.skills || data.skills.length === 0)
    errors.skills = 'Add at least one skill'
  if (data.skills && data.skills.length > 15)
    errors.skills = 'Maximum 15 skills allowed'

  if (!data.experienceLevel)
    errors.experienceLevel = 'Select an experience level'

  if (!data.jobType)
    errors.jobType = 'Select a job type'

  if (!data.workMode)
    errors.workMode = 'Select a work mode'

  if (data.workMode && data.workMode !== 'REMOTE' && !data.location?.trim())
    errors.location = 'Location is required for non-remote jobs'

  if (data.salaryMin && data.salaryMax) {
    const min = Number(data.salaryMin)
    const max = Number(data.salaryMax)
    if (min >= max) errors.salaryMax = 'Max salary must be greater than min'
  }

  if (!data.openings || Number(data.openings) < 1)
    errors.openings = 'At least 1 opening required'

  if (!data.deadline) {
    errors.deadline = 'Deadline is required'
  } else {
    const deadlineDate = new Date(data.deadline)
    const minDate = new Date()
    minDate.setDate(minDate.getDate() + 3)
    minDate.setHours(0, 0, 0, 0)
    if (deadlineDate < minDate)
      errors.deadline = 'Deadline must be at least 3 days from today'
  }

  return errors
}

export function usePostJobForm(defaultCompanyName = '') {
  const initialDraftEnvelope = readDraftEnvelope()
  const [formData, setFormData] = useState(() => {
    const base = buildInitialForm(defaultCompanyName)
    const draftForm = initialDraftEnvelope?.form
    if (!draftForm) return base

    const merged = {
      ...base,
      ...draftForm,
    }
    merged.companyName = String(merged.companyName || base.companyName || '').trim()
    return merged
  })
  const [errors, setErrors] = useState({})
  const [isLoading, setIsLoading] = useState(false)
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState(initialDraftEnvelope?.savedAt || null)
  const [hasDraft, setHasDraft] = useState(Boolean(initialDraftEnvelope?.form))

  useEffect(() => {
    const normalized = String(defaultCompanyName || '').trim()
    if (!normalized) return
    setFormData((prev) => (prev.companyName ? prev : { ...prev, companyName: normalized }))
  }, [defaultCompanyName])

  useEffect(() => {
    if (!hasMeaningfulDraft(formData, defaultCompanyName)) {
      clearDraftEnvelope()
      setHasDraft(false)
      return
    }

    const savedAt = Date.now()
    writeDraftEnvelope(formData, savedAt)
    setLastSavedAt(savedAt)
    setHasDraft(true)
  }, [formData, defaultCompanyName])

  useEffect(() => {
    if (!hasMeaningfulDraft(formData, defaultCompanyName)) return undefined

    const handleBeforeUnload = (event) => {
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [formData, defaultCompanyName])

  const handleChange = useCallback((field, value) => {
    setFormData((prev) => {
      const next = { ...prev, [field]: value }

      // Auto-clear location when switching to REMOTE
      if (field === 'workMode' && value === 'REMOTE') {
        next.location = ''
      }

      return next
    })

    // Clear field error on change
    setErrors((prev) => {
      if (!prev[field]) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })
  }, [])

  const handleSubmit = useCallback(async () => {
    const validationErrors = validate(formData)
    setErrors(validationErrors)

    if (Object.keys(validationErrors).length > 0) return null

    setIsLoading(true)
    setIsSuccess(false)

    const payload = {
      title: formData.title.trim(),
      description: formData.description.trim(),
      skills: formData.skills,
      experienceLevel: formData.experienceLevel,
      education: formData.education,
      jobType: formData.jobType,
      workMode: formData.workMode,
      location: formData.location?.trim() || null,
      salaryMin: formData.salaryMin ? Number(formData.salaryMin) : null,
      salaryMax: formData.salaryMax ? Number(formData.salaryMax) : null,
      duration: formData.duration?.trim() || null,
      openings: Number(formData.openings),
      deadline: formData.deadline,
      perks: formData.perks.length > 0 ? formData.perks : null,
      aboutCompany: formData.aboutCompany?.trim() || formData.companyName.trim() || null,
      minCgpa: formData.minCgpa ? Number(formData.minCgpa) : null,
      eligibleBranches: formData.eligibleBranches.length > 0 ? formData.eligibleBranches : null,
    }

    try {
      const result = await jobService.createJob(payload)
      setIsSuccess(true)
      clearDraftEnvelope()
      setLastSavedAt(null)
      setHasDraft(false)
      setFormData(buildInitialForm(defaultCompanyName))
      return result
    } catch (err) {
      const status = err?.response?.status
      if (status === 400) {
        throw new Error('Please review the job details and try again.')
      }
      if (status === 401 || status === 403) {
        throw new Error('Your session has expired. Please sign in again.')
      }
      throw new Error('Unable to post this job right now. Please try again shortly.')
    } finally {
      setIsLoading(false)
    }
  }, [defaultCompanyName, formData])

  const validateStepOne = useCallback(() => {
    const allErrors = validate(formData)
    const stepErrors = pickErrorsByFields(allErrors, STEP_ONE_FIELDS)
    setErrors((prev) => mergeStepErrors(prev, STEP_ONE_FIELDS, stepErrors))
    return Object.keys(stepErrors).length === 0
  }, [formData])

  const validateStepTwo = useCallback(() => {
    const allErrors = validate(formData)
    const stepErrors = pickErrorsByFields(allErrors, STEP_TWO_FIELDS)
    setErrors((prev) => mergeStepErrors(prev, STEP_TWO_FIELDS, stepErrors))
    return Object.keys(stepErrors).length === 0
  }, [formData])

  const discardDraft = useCallback(() => {
    clearDraftEnvelope()
    setHasDraft(false)
    setLastSavedAt(null)
    setErrors({})
    setFormData(buildInitialForm(defaultCompanyName))
  }, [defaultCompanyName])

  const handleGenerateDescription = useCallback(async () => {
    if (!formData.companyName?.trim()) {
      throw new Error('Add a company name before generating a description.')
    }
    if (!formData.title?.trim()) {
      throw new Error('Add a job title before generating a description.')
    }
    if (!formData.skills?.length) {
      throw new Error('Add at least one required skill before generating a description.')
    }
    if (!formData.experienceLevel) {
      throw new Error('Select an experience level before generating a description.')
    }

    setIsGeneratingDescription(true)
    try {
      const payload = {
        job_title: formData.title.trim(),
        company: formData.companyName.trim(),
        location: formData.workMode === 'REMOTE'
          ? 'Remote'
          : (formData.location?.trim() || 'On-site'),
        job_type: JOB_TYPE_LABELS[formData.jobType] || formData.jobType || 'Internship',
        required_skills: formData.skills,
        experience_level: EXPERIENCE_LABELS[formData.experienceLevel] || formData.experienceLevel,
        domain: inferDomain(formData.title, formData.skills),
      }

      const generated = await jobService.generateDescription(payload)
      const generatedDescription = buildDescriptionText(generated).slice(0, 2000)
      const cgpaValue = parseCgpaEligibility(generated?.eligibility?.cgpa)

      setFormData((prev) => ({
        ...prev,
        description: generatedDescription || prev.description,
        aboutCompany: generated?.company_overview || prev.aboutCompany,
        duration: generated?.internship_details?.duration && generated.internship_details.duration !== 'Not applicable'
          ? generated.internship_details.duration
          : prev.duration,
        minCgpa: cgpaValue != null ? String(cgpaValue) : prev.minCgpa,
      }))

      setErrors((prev) => {
        if (!prev.description) return prev
        const next = { ...prev }
        delete next.description
        return next
      })

      return generated
    } catch (err) {
      const status = err?.response?.status
      if (status === 400) {
        throw new Error('Unable to generate description. Please verify the role details and try again.')
      }
      if (status === 401 || status === 403) {
        throw new Error('Your session has expired. Please sign in again.')
      }
      throw new Error('AI description generation is currently unavailable. Please try again shortly.')
    } finally {
      setIsGeneratingDescription(false)
    }
  }, [formData])

  return {
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
    isSuccess,
  }
}
