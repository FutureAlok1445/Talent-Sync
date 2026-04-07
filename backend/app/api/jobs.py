"""Jobs API router — CRUD endpoints for job postings.

Routes:
  POST   /                  → recruiter creates a job
  GET    /                  → any auth user, list + filter + paginate
  GET    /recruiter/my-jobs → recruiter's own jobs (MUST be before /{job_id})
  GET    /{job_id}          → any auth user, single job
  PATCH  /{job_id}          → recruiter updates own job
  DELETE /{job_id}          → recruiter soft-deletes own job
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query

from app.db.database import get_prisma
from app.middleware.auth import get_current_user, require_role
from app.schemas.job import (
    JobCreate,
    JobDescriptionDraftRequest,
    JobDescriptionDraftResponse,
    JobListResponse,
    JobResponse,
    JobUpdate,
)
from app.services import job_service

router = APIRouter(tags=["jobs"])


# ── POST / ──────────────────────────────────────────────────


@router.post("", response_model=JobResponse, status_code=201)
async def create_job(
    data: JobCreate,
    user: dict = Depends(require_role("RECRUITER")),
):
    """Create a new job posting. Recruiter only."""
    db = get_prisma()
    return await job_service.create_job(data, user["id"], db)


@router.post("/generate-description", response_model=JobDescriptionDraftResponse)
async def generate_job_description(
    data: JobDescriptionDraftRequest,
    user: dict = Depends(require_role("RECRUITER")),
):
    """Generate a realistic job description and candidate-fit explanation."""
    return await job_service.generate_job_description_draft(data)


# ── GET / ───────────────────────────────────────────────────


@router.get("", response_model=JobListResponse)
async def list_jobs(
    search: Optional[str] = Query(None, description="Search title, description, skills"),
    job_type: Optional[str] = Query(None, description="FULL_TIME | PART_TIME | INTERNSHIP | CONTRACT"),
    work_mode: Optional[str] = Query(None, description="REMOTE | HYBRID | ONSITE"),
    experience_level: Optional[str] = Query(None, description="FRESHER | INTERN | JUNIOR | MID | SENIOR"),
    location: Optional[str] = Query(None, description="Location partial match"),
    skills: Optional[list[str]] = Query(None, description="Filter by skill names"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=50, description="Items per page"),
    user: dict = Depends(get_current_user),
):
    """List jobs with filters. Students see active only; recruiters see their own."""
    db = get_prisma()
    role = str(user.get("role", "")).upper()
    return await job_service.get_jobs(
        search=search,
        job_type=job_type,
        work_mode=work_mode,
        experience_level=experience_level,
        location=location,
        skills=skills,
        page=page,
        limit=limit,
        role=role,
        user_id=user["id"],
        db=db,
    )


# ── GET /recruiter/my-jobs ──────────────────────────────────
# NOTE: This route MUST be above /{job_id} to avoid path conflict.


@router.get("/recruiter/my-jobs", response_model=JobListResponse)
async def get_my_jobs(
    search: Optional[str] = Query(None),
    job_type: Optional[str] = Query(None),
    work_mode: Optional[str] = Query(None),
    experience_level: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=50),
    user: dict = Depends(require_role("RECRUITER")),
):
    """Get current recruiter's own jobs with application counts."""
    db = get_prisma()
    return await job_service.get_recruiter_jobs(
        user["id"],
        search=search,
        job_type=job_type,
        work_mode=work_mode,
        experience_level=experience_level,
        is_active=is_active,
        page=page,
        limit=limit,
        db=db,
    )


# ── GET /{job_id} ───────────────────────────────────────────


@router.get("/{job_id}", response_model=JobResponse)
async def get_job(
    job_id: str,
    user: dict = Depends(get_current_user),
):
    """Get a single job by ID."""
    db = get_prisma()
    return await job_service.get_job_by_id(job_id, db)


# ── PATCH /{job_id} ─────────────────────────────────────────


@router.patch("/{job_id}", response_model=JobResponse)
async def update_job(
    job_id: str,
    data: JobUpdate,
    user: dict = Depends(require_role("RECRUITER")),
):
    """Update a job. Recruiter must own the job."""
    db = get_prisma()
    return await job_service.update_job(job_id, data, user["id"], db)


# ── DELETE /{job_id} ────────────────────────────────────────


@router.delete("/{job_id}", response_model=JobResponse)
async def delete_job(
    job_id: str,
    user: dict = Depends(require_role("RECRUITER")),
):
    """Soft-delete a job (set isActive=False). Recruiter must own the job."""
    db = get_prisma()
    return await job_service.close_job(job_id, user["id"], db)