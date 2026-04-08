"""Job service — business logic for job CRUD, filtering, and ownership checks.

All DB interactions go through the Prisma client passed as `db`.
Recruiter ownership is validated via RecruiterProfile lookup by userId.
"""

from __future__ import annotations

import json
import re
from datetime import date, datetime, timedelta, timezone
from typing import Any, Optional

from fastapi import HTTPException, status
from prisma import Prisma

from app.schemas.job import (
    JobCreate,
    JobDescriptionDraftRequest,
    JobDescriptionDraftResponse,
    JobListResponse,
    JobResponse,
    JobUpdate,
)
from app.services import llm_provider


# ── Helpers ─────────────────────────────────────────────────


async def _get_recruiter_profile(user_id: str, db: Prisma):
    """Resolve User.id → RecruiterProfile. Raises 404 if missing."""
    profile = await db.recruiterprofile.find_unique(where={"userId": user_id})
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recruiter profile not found. Complete your profile first.",
        )
    return profile


def _serialize_job(job: Any) -> JobResponse:
    """Convert a Prisma Job (with includes) to JobResponse."""
    skills: list[str] = []
    if hasattr(job, "jobSkills") and job.jobSkills:
        skills = [js.skill.name for js in job.jobSkills if js.skill]

    recruiter_name = ""
    recruiter_email = ""
    company_name = ""
    if hasattr(job, "recruiter") and job.recruiter:
        recruiter_name = job.recruiter.fullName or ""
        company_name = getattr(job.recruiter, "companyName", "") or ""

        recruiter_user = getattr(job.recruiter, "user", None)
        if recruiter_user:
            recruiter_email = getattr(recruiter_user, "email", "") or ""

        if not recruiter_name:
            recruiter_name = company_name

    app_count = 0
    if hasattr(job, "applications") and job.applications is not None:
        app_count = len(job.applications)

    return JobResponse(
        id=job.id,
        title=job.title,
        description=job.description,
        skills=skills,
        experienceLevel=job.experienceLevel,
        education=job.education,
        jobType=job.jobType,
        workMode=job.workMode,
        location=job.location,
        salaryMin=job.salaryMin,
        salaryMax=job.salaryMax,
        duration=job.duration,
        openings=job.openings,
        deadline=job.deadline,
        perks=job.perks or [],
        aboutCompany=job.aboutCompany,
        minCgpa=getattr(job, "minCgpa", None),
        eligibleBranches=getattr(job, "eligibleBranches", []),
        isActive=job.isActive,
        companyName=company_name,
        recruiterName=recruiter_name,
        recruiterEmail=recruiter_email,
        applicationCount=app_count,
        createdAt=job.createdAt,
        updatedAt=job.updatedAt,
    )


_JOB_INCLUDES = {
    "recruiter": {"include": {"user": True}},
    "jobSkills": {"include": {"skill": True}},
    "applications": True,
}


def _normalize_skill_list(values: list[str] | None) -> list[str]:
    if not values:
        return []
    seen: set[str] = set()
    cleaned: list[str] = []
    for value in values:
        item = str(value).strip()
        if not item:
            continue
        lowered = item.lower()
        if lowered in seen:
            continue
        seen.add(lowered)
        cleaned.append(item)
    return cleaned


def _infer_work_mode(location: str) -> str:
    text = (location or "").strip().lower()
    if "remote" in text:
        return "Remote"
    if "hybrid" in text:
        return "Hybrid"
    return "On-site"


def _normalize_job_type(job_type: str) -> str:
    value = (job_type or "").strip().lower()
    if value in {"full-time", "full time", "full_time", "fulltime"}:
        return "Full-time"
    if value in {"part-time", "part time", "part_time", "parttime"}:
        return "Part-time"
    if value in {"contract", "contractual"}:
        return "Contract"
    if value in {"internship", "intern", "trainee"}:
        return "Internship"
    return job_type.strip() if job_type and job_type.strip() else "Internship"


def _preferred_skills(domain: str, required_skills: list[str]) -> list[str]:
    base = [
        "Git and collaborative workflows",
        "Basic testing and debugging discipline",
        "Clear communication in team standups",
    ]

    domain_key = (domain or "").strip().lower()
    if "data" in domain_key or "ai" in domain_key or "ml" in domain_key:
        base.extend(["SQL and data analysis", "Experiment tracking and model evaluation"])
    elif "frontend" in domain_key or "web" in domain_key:
        base.extend(["Responsive UI fundamentals", "Browser debugging and performance basics"])
    elif "backend" in domain_key or "platform" in domain_key:
        base.extend(["REST API design fundamentals", "Database query optimization basics"])
    else:
        base.extend(["Product thinking", "Documentation and handover quality"])

    required_lower = {skill.lower() for skill in required_skills}
    filtered: list[str] = []
    for item in base:
        if item.lower() in required_lower:
            continue
        filtered.append(item)
    return filtered[:3]


def _candidate_insights(data: JobDescriptionDraftRequest, required_skills: list[str]) -> tuple[str, str]:
    candidate_skills = _normalize_skill_list(data.candidate_skills)
    candidate_skill_map = {skill.lower(): skill for skill in candidate_skills}

    matched = [
        candidate_skill_map[skill.lower()]
        for skill in required_skills
        if skill.lower() in candidate_skill_map
    ]
    missing = [
        skill
        for skill in required_skills
        if skill.lower() not in candidate_skill_map
    ]

    strengths = ", ".join(matched[:3]) if matched else "core problem-solving and learning agility"
    candidate_experience = (data.candidate_experience or data.experience_level).strip()
    cgpa_text = f"{data.candidate_cgpa:.1f}" if data.candidate_cgpa is not None else "not specified"

    if data.candidate_backlogs is None:
        backlog_text = "not shared"
    elif data.candidate_backlogs == 0:
        backlog_text = "no active backlogs"
    else:
        backlog_text = f"{data.candidate_backlogs} active"

    improvement_area = missing[0] if missing else "deeper ownership on production-scale projects"

    match_reason = (
        f"Strong alignment on {strengths}; candidate experience ({candidate_experience}) supports practical execution. "
        f"CGPA ({cgpa_text}) and backlogs ({backlog_text}) are treated as baseline checks, not primary ranking signals."
    )
    improvement_suggestion = (
        f"Improve fit by building one focused project demonstrating {improvement_area}, including measurable outcomes and deployment evidence."
    )
    return match_reason, improvement_suggestion


def _fallback_job_description(data: JobDescriptionDraftRequest, required_skills: list[str]) -> JobDescriptionDraftResponse:
    role = data.job_title.strip()
    company = (data.company or "Hiring Company").strip()
    domain = data.domain.strip()
    location = data.location.strip()
    job_type = _normalize_job_type(data.job_type)
    work_mode = _infer_work_mode(location)

    required = required_skills[:10]
    preferred = _preferred_skills(domain, required)
    responsibilities = [
        f"Develop and improve {domain} features for the {role} roadmap under mentor guidance.",
        "Translate product requirements into clean, testable modules with clear documentation.",
        "Collaborate in sprint planning, code reviews, and defect-resolution cycles.",
        "Track task progress, communicate blockers early, and deliver within agreed timelines.",
        "Contribute to quality improvements through testing, monitoring, and iterative fixes.",
    ]

    match_reason, improvement_suggestion = _candidate_insights(data, required)

    return JobDescriptionDraftResponse(
        job_title=role,
        company=company,
        location=location,
        job_type=job_type,
        company_overview=(
            f"{company} builds practical products in the {domain} domain and values ownership, collaboration, and measurable delivery quality."
        ),
        role_summary=(
            f"This {job_type.lower()} role focuses on shipping production-relevant outcomes, strengthening core engineering skills, and learning through real project cycles."
        ),
        responsibilities=responsibilities,
        required_skills=required,
        preferred_skills=preferred,
        eligibility={
            "cgpa": "6.0+ preferred as baseline eligibility; practical skills and project quality carry higher weight.",
            "backlogs": "No active backlogs preferred; up to 1 may be considered with strong technical evidence.",
            "branch": "CS/IT/ECE and related branches preferred; skill-strong candidates from other branches are encouraged.",
        },
        internship_details={
            "duration": "3 to 6 months" if job_type == "Internship" else "Not applicable",
            "stipend": "INR 15,000 to 35,000 per month" if job_type == "Internship" else "Compensation as per company standards",
            "mode": f"{work_mode} ({location})",
        },
        learning_opportunities=[
            "Hands-on exposure to production workflows, code reviews, and release practices.",
            "Mentorship on architecture decisions, debugging strategy, and delivery quality.",
            "Portfolio-ready outcomes with clear business impact and implementation ownership.",
        ],
        ai_insights={
            "match_reason": match_reason,
            "improvement_suggestion": improvement_suggestion,
        },
    )


def _extract_json_payload(text: str) -> dict[str, Any] | None:
    raw = (text or "").strip()
    if not raw:
        return None

    fenced_match = re.search(r"```(?:json)?\s*(\{.*\})\s*```", raw, flags=re.IGNORECASE | re.DOTALL)
    if fenced_match:
        raw = fenced_match.group(1).strip()

    try:
        parsed = json.loads(raw)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        start = raw.find("{")
        end = raw.rfind("}")
        if start == -1 or end == -1 or end <= start:
            return None
        try:
            parsed = json.loads(raw[start:end + 1])
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError:
            return None
    return None


def _merge_generated_with_fallback(
    payload: dict[str, Any],
    fallback: JobDescriptionDraftResponse,
) -> JobDescriptionDraftResponse | None:
    fallback_data = fallback.model_dump()

    for key, value in payload.items():
        if key not in fallback_data:
            continue
        if isinstance(fallback_data[key], dict) and isinstance(value, dict):
            nested = fallback_data[key]
            for nested_key, nested_value in value.items():
                if nested_key in nested and nested_value not in (None, "", []):
                    nested[nested_key] = nested_value
            fallback_data[key] = nested
            continue
        if value not in (None, "", []):
            fallback_data[key] = value

    try:
        return JobDescriptionDraftResponse.model_validate(fallback_data)
    except Exception:
        return None


async def generate_job_description_draft(
    data: JobDescriptionDraftRequest,
) -> JobDescriptionDraftResponse:
    """Generate a recruiter-ready structured JD object for frontend rendering."""
    required_skills = _normalize_skill_list(data.required_skills)

    fallback_payload = _fallback_job_description(data, required_skills)

    system_prompt = (
        "You are an AI assistant for TalentSync, an intelligent internship recommendation platform. "
        "Generate professional, realistic, frontend-ready job descriptions. "
        "Avoid exaggerated claims and keep language concise and practical."
    )

    prompt = (
        "Generate content for TalentSync using the exact required JSON schema.\n\n"
        "INPUT:\n"
        f"- Job Title: {data.job_title}\n"
        f"- Company Name: {data.company}\n"
        f"- Location: {data.location}\n"
        f"- Job Type: {_normalize_job_type(data.job_type)}\n"
        f"- Required Skills: {', '.join(required_skills)}\n"
        f"- Experience Level: {data.experience_level}\n"
        f"- Domain: {data.domain}\n"
        f"- Candidate Skills: {', '.join(_normalize_skill_list(data.candidate_skills)) or 'Not provided'}\n"
        f"- Candidate Experience: {data.candidate_experience or data.experience_level}\n"
        f"- Candidate CGPA: {data.candidate_cgpa if data.candidate_cgpa is not None else 'Not provided'}\n"
        f"- Candidate Backlogs: {data.candidate_backlogs if data.candidate_backlogs is not None else 'Not provided'}\n\n"
        "OUTPUT FORMAT (STRICT JSON):\n"
        "{\n"
        "  \"job_title\": \"\",\n"
        "  \"company\": \"\",\n"
        "  \"location\": \"\",\n"
        "  \"job_type\": \"\",\n"
        "  \"company_overview\": \"\",\n"
        "  \"role_summary\": \"\",\n"
        "  \"responsibilities\": [\"\", \"\", \"\"],\n"
        "  \"required_skills\": [\"\", \"\"],\n"
        "  \"preferred_skills\": [\"\", \"\"],\n"
        "  \"eligibility\": {\n"
        "    \"cgpa\": \"\",\n"
        "    \"backlogs\": \"\",\n"
        "    \"branch\": \"\"\n"
        "  },\n"
        "  \"internship_details\": {\n"
        "    \"duration\": \"\",\n"
        "    \"stipend\": \"\",\n"
        "    \"mode\": \"\"\n"
        "  },\n"
        "  \"learning_opportunities\": [\"\", \"\"],\n"
        "  \"ai_insights\": {\n"
        "    \"match_reason\": \"\",\n"
        "    \"improvement_suggestion\": \"\"\n"
        "  }\n"
        "}\n\n"
        "GUIDELINES:\n"
        "1. Keep tone professional (LinkedIn/Internshala style).\n"
        "2. Keep language concise and frontend-friendly.\n"
        "3. Prioritize skills and practical experience over CGPA.\n"
        "4. Keep CGPA as basic eligibility only.\n"
        "5. Responsibilities must be realistic and execution-focused.\n"
        "6. Do not fabricate achievements or company claims.\n"
        "7. Return only valid JSON and no surrounding explanation."
    )

    try:
        llm_text = await llm_provider.generate(
            prompt=prompt,
            history=[],
            system_prompt=system_prompt,
        )
        if llm_text.strip() and llm_text.strip() != llm_provider.FALLBACK_RESPONSE:
            payload = _extract_json_payload(llm_text)
            if payload:
                merged = _merge_generated_with_fallback(payload, fallback_payload)
                if merged:
                    return merged
    except Exception:
        pass

    return fallback_payload


# ── Core Service Functions ──────────────────────────────────


async def create_job(data: JobCreate, user_id: str, db: Prisma) -> JobResponse:
    """Create a new job posting. Only recruiters should call this."""

    # Business rule: deadline must be at least 3 days from today
    min_deadline = date.today() + timedelta(days=3)
    if data.deadline < min_deadline:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Deadline must be at least 3 days from today ({min_deadline.isoformat()})",
        )

    # Salary cross-field check (also in schema, but double-checked here)
    if data.salaryMin is not None and data.salaryMax is not None:
        if data.salaryMin >= data.salaryMax:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="salaryMin must be less than salaryMax",
            )

    profile = await _get_recruiter_profile(user_id, db)

    # Upsert skills and collect IDs
    skill_ids: list[str] = []
    for name in data.skills:
        skill = await db.skill.find_first(where={"name": {"equals": name, "mode": "insensitive"}})
        if not skill:
            skill = await db.skill.create(data={"name": name})
        skill_ids.append(skill.id)

    # Create the job
    job = await db.job.create(
        data={
            "recruiterId": profile.id,
            "title": data.title,
            "description": data.description,
            "location": data.location,
            "jobType": data.jobType,
            "workMode": data.workMode,
            "experienceLevel": data.experienceLevel,
            "education": data.education,
            "salaryMin": data.salaryMin,
            "salaryMax": data.salaryMax,
            "duration": data.duration,
            "openings": data.openings,
            "perks": data.perks or [],
            "aboutCompany": data.aboutCompany or profile.bio or "",
            "minCgpa": data.minCgpa,
            "eligibleBranches": data.eligibleBranches or [],
            "deadline": datetime.combine(data.deadline, datetime.min.time(), tzinfo=timezone.utc),
            "isActive": True,
            "jobSkills": {
                "create": [
                    {"skillId": sid, "isRequired": True, "weightage": 1.0}
                    for sid in skill_ids
                ]
            },
        },
        include=_JOB_INCLUDES,
    )

    return _serialize_job(job)


async def get_jobs(
    *,
    search: Optional[str] = None,
    job_type: Optional[str] = None,
    work_mode: Optional[str] = None,
    experience_level: Optional[str] = None,
    location: Optional[str] = None,
    skills: Optional[list[str]] = None,
    page: int = 1,
    limit: int = 20,
    role: str,
    user_id: str,
    db: Prisma,
) -> JobListResponse:
    """List jobs with filters and pagination.

    Students only see isActive=True jobs.
    Recruiters see their own jobs (all statuses).
    """
    where: dict[str, Any] = {}
    and_clauses: list[dict[str, Any]] = []

    # Role-based visibility
    if role == "STUDENT":
        and_clauses.append({"isActive": True})
    elif role == "RECRUITER":
        profile = await db.recruiterprofile.find_unique(where={"userId": user_id})
        if profile:
            and_clauses.append({"recruiterId": profile.id})
        else:
            # Recruiter without profile sees nothing
            return JobListResponse.build(items=[], total=0, page=page, limit=limit)

    # Search across title, description, and skills
    if search:
        and_clauses.append({
            "OR": [
                {"title": {"contains": search, "mode": "insensitive"}},
                {"description": {"contains": search, "mode": "insensitive"}},
                {"jobSkills": {"some": {"skill": {"name": {"contains": search, "mode": "insensitive"}}}}},
            ]
        })

    # Enum filters
    if job_type:
        and_clauses.append({"jobType": job_type})
    if work_mode:
        and_clauses.append({"workMode": work_mode})
    if experience_level:
        and_clauses.append({"experienceLevel": experience_level})

    # Location filter (partial match)
    if location:
        and_clauses.append({"location": {"contains": location, "mode": "insensitive"}})

    # Skills filter — job must have ALL specified skills
    if skills:
        for skill_name in skills:
            and_clauses.append({
                "jobSkills": {
                    "some": {
                        "skill": {"name": {"equals": skill_name, "mode": "insensitive"}}
                    }
                }
            })

    if and_clauses:
        where["AND"] = and_clauses

    total = await db.job.count(where=where)

    skip = (page - 1) * limit
    jobs = await db.job.find_many(
        where=where,
        include=_JOB_INCLUDES,
        skip=skip,
        take=limit,
        order={"createdAt": "desc"},
    )

    items = [_serialize_job(j) for j in jobs]
    return JobListResponse.build(items=items, total=total, page=page, limit=limit)


async def get_job_by_id(job_id: str, db: Prisma) -> JobResponse:
    """Get a single job by ID. Raises 404 if not found."""
    job = await db.job.find_unique(
        where={"id": job_id},
        include=_JOB_INCLUDES,
    )
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found",
        )
    return _serialize_job(job)


async def update_job(
    job_id: str, data: JobUpdate, user_id: str, db: Prisma
) -> JobResponse:
    """Update a job. Only the owning recruiter can update."""
    profile = await _get_recruiter_profile(user_id, db)

    job = await db.job.find_unique(where={"id": job_id})
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found",
        )
    if job.recruiterId != profile.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only update your own job postings",
        )

    update_data: dict[str, Any] = data.model_dump(exclude_unset=True, exclude={"skills"})

    # Deadline validation if being updated
    if data.deadline is not None:
        min_deadline = date.today() + timedelta(days=3)
        if data.deadline < min_deadline:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Deadline must be at least 3 days from today ({min_deadline.isoformat()})",
            )
        update_data["deadline"] = datetime.combine(
            data.deadline, datetime.min.time(), tzinfo=timezone.utc
        )

    # Salary cross-validation against existing or new values
    new_min = data.salaryMin if data.salaryMin is not None else job.salaryMin
    new_max = data.salaryMax if data.salaryMax is not None else job.salaryMax
    if new_min is not None and new_max is not None and new_min >= new_max:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="salaryMin must be less than salaryMax",
        )

    # Update skills if provided
    if data.skills is not None:
        # Delete existing skill links
        await db.jobskill.delete_many(where={"jobId": job_id})

        # Upsert and re-link
        for name in data.skills:
            skill = await db.skill.find_first(
                where={"name": {"equals": name, "mode": "insensitive"}}
            )
            if not skill:
                skill = await db.skill.create(data={"name": name})
            await db.jobskill.create(
                data={"jobId": job_id, "skillId": skill.id, "isRequired": True, "weightage": 1.0}
            )

    updated_job = await db.job.update(
        where={"id": job_id},
        data=update_data,
        include=_JOB_INCLUDES,
    )
    return _serialize_job(updated_job)


async def close_job(job_id: str, user_id: str, db: Prisma) -> JobResponse:
    """Soft-delete a job by setting isActive=False. Only the owner can close."""
    profile = await _get_recruiter_profile(user_id, db)

    job = await db.job.find_unique(where={"id": job_id})
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found",
        )
    if job.recruiterId != profile.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only close your own job postings",
        )

    updated = await db.job.update(
        where={"id": job_id},
        data={"isActive": False},
        include=_JOB_INCLUDES,
    )
    return _serialize_job(updated)


async def get_recruiter_jobs(
    user_id: str,
    *,
    search: Optional[str] = None,
    job_type: Optional[str] = None,
    work_mode: Optional[str] = None,
    experience_level: Optional[str] = None,
    is_active: Optional[bool] = None,
    page: int = 1,
    limit: int = 20,
    db: Prisma,
) -> JobListResponse:
    """Get all jobs for a specific recruiter, with filters and application counts."""
    profile = await _get_recruiter_profile(user_id, db)

    where: dict[str, Any] = {"recruiterId": profile.id}
    and_clauses: list[dict[str, Any]] = []

    if search:
        and_clauses.append({
            "OR": [
                {"title": {"contains": search, "mode": "insensitive"}},
                {"description": {"contains": search, "mode": "insensitive"}},
            ]
        })
    if job_type:
        and_clauses.append({"jobType": job_type})
    if work_mode:
        and_clauses.append({"workMode": work_mode})
    if experience_level:
        and_clauses.append({"experienceLevel": experience_level})
    if is_active is not None:
        and_clauses.append({"isActive": is_active})

    if and_clauses:
        where["AND"] = and_clauses

    total = await db.job.count(where=where)
    skip = (page - 1) * limit

    jobs = await db.job.find_many(
        where=where,
        include=_JOB_INCLUDES,
        skip=skip,
        take=limit,
        order={"createdAt": "desc"},
    )

    items = [_serialize_job(j) for j in jobs]
    return JobListResponse.build(items=items, total=total, page=page, limit=limit)
