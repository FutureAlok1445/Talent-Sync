"""Job service — business logic for job CRUD, filtering, and ownership checks.

All DB interactions go through the Prisma client passed as `db`.
Recruiter ownership is validated via RecruiterProfile lookup by userId.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Any, Optional

from fastapi import HTTPException, status
from prisma import Prisma

from app.schemas.job import JobCreate, JobListResponse, JobResponse, JobUpdate


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
    if hasattr(job, "recruiter") and job.recruiter:
        recruiter_name = job.recruiter.fullName or job.recruiter.companyName or ""

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
        isActive=job.isActive,
        recruiterName=recruiter_name,
        applicationCount=app_count,
        createdAt=job.createdAt,
        updatedAt=job.updatedAt,
    )


_JOB_INCLUDES = {
    "recruiter": True,
    "jobSkills": {"include": {"skill": True}},
    "applications": True,
}


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
