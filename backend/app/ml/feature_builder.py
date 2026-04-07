import re

import numpy as np

# Exact feature order expected by the XGBoost model.
# Modifying this list requires retraining the model.
SAFE_FEATURES = [
    "sbert_similarity",
    "semantic_score",
    "skill_overlap_ratio",

    "cgpa_normalized",
    "cgpa_meets_threshold",
    "backlog_penalty",
    "branch_eligible",

    "experience_score",
    "experience_months",
    "experience_gap",

    "preference_score",
    "location_match",
    "domain_match",

    "skill_gap_score",
    "profile_completeness",
]

def _parse_list(val) -> list:
    if val is None or (isinstance(val, float) and np.isnan(val)):
        return []
    if isinstance(val, str):
        cleaned = val.strip()
        if not cleaned or cleaned.lower() == "nan":
            return []
        return [x.strip() for x in re.split(r"[|,;]", cleaned) if x.strip()]
    if isinstance(val, (list, tuple, set)):
        parsed = []
        for item in val:
            if item is None:
                continue
            if isinstance(item, dict):
                # Handles relation payloads such as {"skill": {"name": ...}}
                skill_obj = item.get("skill")
                if isinstance(skill_obj, dict) and skill_obj.get("name"):
                    parsed.append(str(skill_obj.get("name")).strip())
                    continue
                for key in ("name", "value", "title"):
                    if item.get(key):
                        parsed.append(str(item.get(key)).strip())
                        break
                continue
            text = str(item).strip()
            if text and text.lower() != "nan":
                parsed.append(text)
        return parsed
    text = str(val).strip()
    return [text] if text and text.lower() != "nan" else []

def _safe_str(val) -> str:
    if val is None or (isinstance(val, float) and np.isnan(val)):
        return ""
    if str(val).lower() == "nan":
        return ""
    return str(val)

def _safe_bool(val, default=False) -> bool:
    if val is None or (isinstance(val, float) and np.isnan(val)):
        return default
    return bool(val)

def _safe_float(val, default=0.0) -> float:
    if val is None:
        return default
    try:
        fval = float(val)
    except (TypeError, ValueError):
        return default
    if np.isnan(fval):
        return default
    return fval

def _normalize_work_mode(val: str | None) -> str:
    mode = _safe_str(val).strip().upper()
    if mode in {"REMOTE", "HYBRID", "ONSITE"}:
        return mode
    if mode in {"ON-SITE", "ON SITE"}:
        return "ONSITE"
    return ""

def _extract_domain(title_str: str) -> str:
    t = _safe_str(title_str).lower()
    if "frontend" in t or "react" in t or "ui" in t:
        return "frontend"
    if "backend" in t or "api" in t:
        return "backend"
    if "data" in t or "ml" in t or "ai" in t:
        return "data"
    if "devops" in t or "cloud" in t:
        return "devops"
    return "general"

def _experience_level_to_months(level: str | None) -> float:
    mapping = {
        "FRESHER": 0.0,
        "INTERN": 3.0,
        "JUNIOR": 12.0,
        "MID": 36.0,
        "SENIOR": 60.0,
    }
    return mapping.get(_safe_str(level).strip().upper(), 0.0)

def _is_branch_allowed(student_branch: str, eligible_branches: list[str]) -> float:
    if not eligible_branches:
        return 1.0
    tokens = {
        _safe_str(branch).strip().lower()
        for branch in eligible_branches
        if _safe_str(branch).strip()
    }
    if not tokens or any(wild in tokens for wild in ("any", "*", "all")):
        return 1.0
    return 1.0 if student_branch.strip().lower() in tokens else 0.0

def build_features(student: dict, job: dict, similarity: float) -> np.ndarray:
    """Centralized feature extraction for both inference and training."""
    # --- Skills ---
    s_skills = set(s.lower() for s in _parse_list(student.get("skills")))
    j_skills = set(s.lower() for s in _parse_list(job.get("required_skills") or job.get("skills")))
    overlap = s_skills & j_skills
    skill_overlap_ratio = len(overlap) / max(len(j_skills), 1)
    # Penalty-oriented feature (higher means larger gap).
    skill_gap_score = 1.0 - skill_overlap_ratio

    similarity = float(np.clip(similarity, 0.0, 1.0))
    # Keep semantic signal correlated with text similarity while favoring explicit skill overlap.
    semantic_score = float(np.clip((0.7 * similarity) + (0.3 * skill_overlap_ratio), 0.0, 1.0))

    # --- preference_score ---
    preferred_roles = [r.lower() for r in _parse_list(student.get("preferredRoles") or student.get("preferred_roles"))]
    job_title = (_safe_str(job.get("title") or job.get("role_title"))).lower()
    role_match = float(any(role in job_title or job_title in role for role in preferred_roles)) if preferred_roles else 0.0

    pref_locs = [l.lower() for l in _parse_list(student.get("preferredLocations") or student.get("preferred_locations"))]
    pref_locs_set = set(pref_locs)
    job_loc = _safe_str(job.get("location")).lower()
    job_mode = _normalize_work_mode(job.get("workMode") or job.get("work_mode") or job.get("work_type"))
    preferred_mode = _normalize_work_mode(student.get("preferredWorkMode") or student.get("preferred_work_mode"))

    if job_mode == "REMOTE":
        if not pref_locs_set or "remote" in pref_locs_set or "any" in pref_locs_set:
            location_match = 1.0
        else:
            location_match = 0.7
    elif not job_loc:
        location_match = 0.5
    elif job_loc in pref_locs_set:
        location_match = 1.0
    elif "any" in pref_locs_set:
        location_match = 0.8
    elif "remote" in pref_locs_set and job_mode == "HYBRID":
        location_match = 0.4
    else:
        location_match = 0.0

    mode_bonus = 0.0
    if preferred_mode and job_mode:
        if preferred_mode == job_mode:
            mode_bonus = 0.2
        elif preferred_mode == "HYBRID" and job_mode in {"REMOTE", "ONSITE"}:
            mode_bonus = 0.1
        elif preferred_mode == "REMOTE" and job_mode == "HYBRID":
            mode_bonus = 0.05
        else:
            mode_bonus = -0.1

    preference_score = float(np.clip((0.65 * role_match) + (0.35 * location_match) + mode_bonus, 0.0, 1.0))

    # --- domain_match ---
    job_domain = _extract_domain(job_title)
    student_domain_roles = " ".join(preferred_roles)
    student_domain = _extract_domain(student_domain_roles)
    if job_domain == "general" and student_domain == "general":
        domain_match = 0.4
    else:
        domain_match = float(job_domain == student_domain)

    # --- CGPA / academics (soft, capped contribution) ---
    cgpa_val = student.get("cgpa") if student.get("cgpa") is not None else student.get("gpa")
    cgpa = float(np.clip(_safe_float(cgpa_val, 0.0), 0.0, 10.0))

    min_cgpa_val = job.get("minCgpa") if job.get("minCgpa") is not None else job.get("min_cgpa")
    if min_cgpa_val is None:
        min_cgpa_val = job.get("min_gpa")
    min_cgpa = float(np.clip(_safe_float(min_cgpa_val, 0.0), 0.0, 10.0))

    # Cap CGPA impact to avoid model over-reliance on academics.
    cgpa_normalized = float(np.clip(min(cgpa, 8.0) / 8.0, 0.0, 1.0)) if cgpa > 0 else 0.0
    if min_cgpa <= 0:
        cgpa_meets_threshold = 1.0
    else:
        margin = cgpa - min_cgpa
        cgpa_meets_threshold = float(np.clip(1.0 if margin >= 0 else 1.0 + (margin / 2.0), 0.0, 1.0))

    # --- Backlogs ---
    bl_val = student.get("backlogs")
    backlogs = int(max(_safe_float(bl_val, 0.0), 0.0))

    backlog_allowed = _safe_bool(
        job.get("backlogAllowed")
        if job.get("backlogAllowed") is not None
        else job.get("backlog_allowed"),
        default=True,
    )

    if backlogs <= 0:
        backlog_penalty = 0.0
    elif backlog_allowed:
        backlog_penalty = -float(min(0.25, 0.05 * backlogs))
    else:
        backlog_penalty = -float(min(1.0, 0.2 * backlogs))

    # --- branch eligibility ---
    s_branch = _safe_str(student.get("branch")).strip().lower()
    eligible_branches = _parse_list(job.get("eligibleBranches") or job.get("eligible_branches"))
    branch_eligible = _is_branch_allowed(s_branch, eligible_branches)

    # --- experience ---
    exp_val = student.get("experience_months")
    if exp_val is None:
        exp_val = student.get("experienceMonths")
    s_exp_months = _safe_float(exp_val, 0.0)
    if s_exp_months <= 0:
        s_exp_months = _experience_level_to_months(student.get("experienceLevel") or student.get("experience_level"))

    req_exp_val = job.get("requiredExperienceMonths") if job.get("requiredExperienceMonths") is not None else job.get("required_experience_months")
    req_exp = _safe_float(req_exp_val, 0.0)
    if req_exp <= 0:
        req_exp = _experience_level_to_months(job.get("experienceLevel") or job.get("experience_level"))

    if req_exp > 0:
        experience_score = float(np.clip(s_exp_months / req_exp, 0.0, 1.0))
    else:
        experience_score = float(np.clip(s_exp_months / 24.0, 0.0, 1.0))
    experience_gap = max(0.0, req_exp - s_exp_months) / max(req_exp, 1.0)

    # --- profile completeness ---
    github_link = student.get("github") if student.get("github") is not None else student.get("githubUrl")
    linkedin_link = student.get("linkedin") if student.get("linkedin") is not None else student.get("linkedinUrl")
    resume_val = student.get("resume") if student.get("resume") is not None else student.get("resumeUrl")

    completeness_points = sum([
        _safe_bool(student.get("bio")),
        _safe_bool(resume_val),
        _safe_bool(github_link),
        _safe_bool(linkedin_link),
        len(s_skills) >= 3,
        len(preferred_roles) > 0,
        s_exp_months > 0,
    ])
    profile_completeness = completeness_points / 7.0

    return np.array([
        float(similarity),      # sbert_similarity
        semantic_score,         # semantic_score
        skill_overlap_ratio,    # skill_overlap_ratio
        cgpa_normalized,        # cgpa_normalized
        cgpa_meets_threshold,   # cgpa_meets_threshold
        backlog_penalty,        # backlog_penalty
        branch_eligible,        # branch_eligible
        experience_score,       # experience_score
        s_exp_months,           # experience_months
        experience_gap,         # experience_gap
        preference_score,       # preference_score
        location_match,         # location_match
        domain_match,           # domain_match
        skill_gap_score,        # skill_gap_score
        profile_completeness,   # profile_completeness
    ], dtype=np.float32)
