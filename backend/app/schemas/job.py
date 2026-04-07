"""Job schemas — request/response shapes for job endpoints.

Pydantic v2 models with field-level constraints and cross-field validators.
"""

from __future__ import annotations

import math
from datetime import date, datetime
from typing import Literal, Optional

from pydantic import AliasChoices, BaseModel, ConfigDict, Field, field_validator, model_validator


ExperienceLevelType = Literal["FRESHER", "INTERN", "JUNIOR", "MID", "SENIOR"]
JobTypeType = Literal["FULL_TIME", "PART_TIME", "INTERNSHIP", "CONTRACT"]
WorkModeType = Literal["REMOTE", "HYBRID", "ONSITE"]


# ── Request Schemas ─────────────────────────────────────────


class JobCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=100)
    description: str = Field(..., min_length=100, max_length=2000)
    skills: list[str] = Field(..., max_length=15)
    experienceLevel: ExperienceLevelType
    education: str
    jobType: JobTypeType
    workMode: WorkModeType
    location: Optional[str] = None
    salaryMin: Optional[int] = None
    salaryMax: Optional[int] = None
    duration: Optional[str] = None
    openings: int = Field(..., ge=1)
    deadline: date
    perks: Optional[list[str]] = None
    aboutCompany: Optional[str] = None
    minCgpa: Optional[float] = Field(default=None, ge=0, le=10)
    eligibleBranches: Optional[list[str]] = None

    @field_validator("skills")
    @classmethod
    def validate_skills_not_empty(cls, v: list[str]) -> list[str]:
        if not v:
            raise ValueError("At least one skill is required")
        seen: set[str] = set()
        cleaned: list[str] = []
        for s in v:
            s = s.strip()
            if not s:
                raise ValueError("Skill name cannot be empty")
            lower = s.lower()
            if lower not in seen:
                seen.add(lower)
                cleaned.append(s)
        return cleaned

    @model_validator(mode="after")
    def validate_salary_range(self) -> "JobCreate":
        if self.salaryMin is not None and self.salaryMax is not None:
            if self.salaryMin >= self.salaryMax:
                raise ValueError("salaryMin must be less than salaryMax")
        return self

    @model_validator(mode="after")
    def validate_location_for_non_remote(self) -> "JobCreate":
        if self.workMode != "REMOTE" and not self.location:
            raise ValueError("Location is required for HYBRID and ONSITE jobs")
        return self


class JobUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=3, max_length=100)
    description: Optional[str] = Field(None, min_length=100, max_length=2000)
    skills: Optional[list[str]] = Field(None, max_length=15)
    experienceLevel: Optional[ExperienceLevelType] = None
    education: Optional[str] = None
    jobType: Optional[JobTypeType] = None
    workMode: Optional[WorkModeType] = None
    location: Optional[str] = None
    salaryMin: Optional[int] = None
    salaryMax: Optional[int] = None
    duration: Optional[str] = None
    openings: Optional[int] = Field(None, ge=1)
    deadline: Optional[date] = None
    perks: Optional[list[str]] = None
    aboutCompany: Optional[str] = None
    minCgpa: Optional[float] = Field(default=None, ge=0, le=10)
    eligibleBranches: Optional[list[str]] = None

    @field_validator("skills")
    @classmethod
    def validate_skills_not_empty(cls, v: list[str] | None) -> list[str] | None:
        if v is None:
            return v
        if not v:
            raise ValueError("At least one skill is required")
        seen: set[str] = set()
        cleaned: list[str] = []
        for s in v:
            s = s.strip()
            if not s:
                raise ValueError("Skill name cannot be empty")
            lower = s.lower()
            if lower not in seen:
                seen.add(lower)
                cleaned.append(s)
        return cleaned


class JobDescriptionDraftRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    job_title: str = Field(..., min_length=2, max_length=120)
    company: str = Field(
        default="Hiring Company",
        min_length=2,
        max_length=120,
        validation_alias=AliasChoices("company", "company_name"),
    )
    location: str = Field(..., min_length=2, max_length=120)
    job_type: str = Field(default="Internship", min_length=2, max_length=40)
    required_skills: list[str] = Field(
        ...,
        min_length=1,
        max_length=20,
        validation_alias=AliasChoices("required_skills", "skills", "job_required_skills"),
    )
    experience_level: str = Field(
        ...,
        min_length=2,
        max_length=80,
        validation_alias=AliasChoices("experience_level", "experience"),
    )
    domain: str = Field(..., min_length=2, max_length=120)

    candidate_skills: list[str] = Field(default_factory=list, max_length=30)
    candidate_experience: Optional[str] = Field(default=None, min_length=1, max_length=80)
    candidate_cgpa: Optional[float] = Field(default=None, ge=0, le=10)
    candidate_backlogs: Optional[int] = Field(default=None, ge=0, le=50)

    @field_validator("required_skills", "candidate_skills")
    @classmethod
    def validate_and_normalize_skills(
        cls,
        v: list[str] | None,
    ) -> list[str] | None:
        if v is None:
            return None
        seen: set[str] = set()
        cleaned: list[str] = []
        for skill in v:
            normalized = str(skill).strip()
            if not normalized:
                continue
            lowered = normalized.lower()
            if lowered in seen:
                continue
            seen.add(lowered)
            cleaned.append(normalized)
        return cleaned


class JobDescriptionEligibility(BaseModel):
    cgpa: str
    backlogs: str
    branch: str


class JobDescriptionInternshipDetails(BaseModel):
    duration: str
    stipend: str
    mode: str


class JobDescriptionAIInsights(BaseModel):
    match_reason: str
    improvement_suggestion: str


class JobDescriptionDraftResponse(BaseModel):
    job_title: str
    company: str
    location: str
    job_type: str
    company_overview: str
    role_summary: str
    responsibilities: list[str]
    required_skills: list[str]
    preferred_skills: list[str]
    eligibility: JobDescriptionEligibility
    internship_details: JobDescriptionInternshipDetails
    learning_opportunities: list[str]
    ai_insights: JobDescriptionAIInsights


# ── Response Schemas ────────────────────────────────────────


class JobResponse(BaseModel):
    id: str
    title: str
    description: str
    skills: list[str] = Field(default_factory=list)
    experienceLevel: str
    education: str
    jobType: str
    workMode: str
    location: Optional[str] = None
    salaryMin: Optional[int] = None
    salaryMax: Optional[int] = None
    duration: Optional[str] = None
    openings: int
    deadline: Optional[datetime] = None
    perks: list[str] = Field(default_factory=list)
    aboutCompany: Optional[str] = None
    minCgpa: Optional[float] = None
    eligibleBranches: list[str] = Field(default_factory=list)
    isActive: bool
    companyName: str = ""
    recruiterName: str = ""
    recruiterEmail: str = ""
    applicationCount: int = 0
    createdAt: datetime
    updatedAt: datetime

    model_config = {"from_attributes": True}


class JobListResponse(BaseModel):
    items: list[JobResponse]
    total: int
    page: int
    limit: int
    total_pages: int

    @classmethod
    def build(
        cls,
        items: list[JobResponse],
        total: int,
        page: int,
        limit: int,
    ) -> "JobListResponse":
        return cls(
            items=items,
            total=total,
            page=page,
            limit=limit,
            total_pages=max(1, math.ceil(total / limit)),
        )