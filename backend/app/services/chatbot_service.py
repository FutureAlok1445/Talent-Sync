# WHO WRITES THIS: Backend developer + ML developer
# WHAT THIS DOES: Hybrid chatbot engine with:
#   - Onboarding state machine (GREETING → … → COMPLETED)
#   - Intent detection for career assistant mode
#   - Rule-based handlers (DB queries, no LLM)
#   - LLM handlers via Ollama for open-ended questions
#   - Context builder injecting profile + matches + SHAP
#   - process_message() master orchestrator
# DEPENDS ON: llm_provider, prisma, matching_service, config

from __future__ import annotations

import json
import logging
import re
from typing import Any

from prisma import Json

from app.db.database import get_prisma
from app.services import llm_provider

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────
# ONBOARDING STATE MACHINE
# ─────────────────────────────────────────────

ONBOARDING_STEPS = [
    "GREETING",
    "COLLECT_NAME",
    "COLLECT_SKILLS",
    "COLLECT_EDUCATION",
    "COLLECT_ROLES",
    "COLLECT_EXPERIENCE",
    "CONFIRM_PROFILE",
    "COMPLETED",
]

STEP_PROMPTS: dict[str, str] = {
    "GREETING": (
        "👋 Welcome to TalentSync {name}! I'm your AI career assistant. "
        "Let's build your profile to find the best job matches for you."
    ),
    "COLLECT_NAME": "What is your full name?",
    "COLLECT_SKILLS": (
        "Now let's talk about your skills.\n\n"
        "List your technical skills separated by commas "
        "(e.g., Python, React, SQL, Machine Learning)."
    ),
    "COLLECT_EDUCATION": (
        "Nice skill set! Now tell me about your education.\n\n"
        "Please share:\n"
        "• Your degree (e.g., B.Tech, BCA, M.Sc)\n"
        "• Branch (e.g., CSE, IT, ECE)\n"
        "• Expected graduation year\n\n"
        "You can write it like: \"B.Tech CSE, 2025\""
    ),
    "COLLECT_ROLES": (
        "What kind of roles are you looking for?\n\n"
        "Share your preferred job roles "
        "(e.g., Data Analyst, ML Engineer, Full-Stack Developer)."
    ),
    "COLLECT_EXPERIENCE": (
        "Almost there! What's your experience level?\n\n"
        "Choose one: **Fresher**, **Intern**, or **Experienced**"
    ),
    "CONFIRM_PROFILE": (
        "Here's what I've collected:\n\n"
        "• **Name**: {name}\n"
        "• **Skills**: {skills}\n"
        "• **Education**: {degree} {branch}, {grad_year}\n"
        "• **Preferred Roles**: {roles}\n"
        "• **Experience**: {experience}\n\n"
        "Does this look correct? Reply **Yes** to save, "
        "or tell me what to change."
    ),
    "COMPLETED": (
        "✅ Your profile has been saved! "
        "I'm now your Career Assistant. Ask me anything:\n\n"
        "• \"Show my matches\" — see your top job matches\n"
        "• \"Why did I match with [job]?\" — AI-powered explanation\n"
        "• \"How can I improve my resume?\" — personalized tips\n"
        "• \"Show my applications\" — check application status"
    ),
}


def _next_step(current: str) -> str:
    """Return the next onboarding step."""
    idx = ONBOARDING_STEPS.index(current)
    if idx + 1 < len(ONBOARDING_STEPS):
        return ONBOARDING_STEPS[idx + 1]
    return "COMPLETED"


def _parse_education(text: str) -> dict[str, Any]:
    """Best-effort parse of education string like 'B.Tech CSE, 2025'."""
    result: dict[str, Any] = {"degree": None, "branch": None, "graduation_year": None}
    text = text.strip()

    year_match = re.search(r"\b(20\d{2})\b", text)
    if year_match:
        result["graduation_year"] = int(year_match.group(1))

    degree_patterns = [
        r"\b(B\.?Tech|B\.?E|BCA|BCS|B\.?Sc|M\.?Tech|M\.?Sc|MCA|MBA|Ph\.?D)\b",
    ]
    for pattern in degree_patterns:
        m = re.search(pattern, text, re.IGNORECASE)
        if m:
            result["degree"] = m.group(1)
            break

    branch_patterns = [
        r"\b(CSE|CS|IT|ECE|EEE|ME|CE|AIML|AI|ML|Data Science|Electronics|Mechanical|Civil)\b",
    ]
    for pattern in branch_patterns:
        m = re.search(pattern, text, re.IGNORECASE)
        if m:
            result["branch"] = m.group(1).upper()
            break

    return result


def _parse_skills(text: str) -> list[str]:
    """Split comma/and-separated skills list."""
    parts = re.split(r"[,;]+|\band\b", text, flags=re.IGNORECASE)
    return [s.strip() for s in parts if s.strip()]


def _parse_roles(text: str) -> list[str]:
    """Split comma/and-separated roles list."""
    parts = re.split(r"[,;]+|\band\b", text, flags=re.IGNORECASE)
    return [s.strip() for s in parts if s.strip()]


def _parse_experience(text: str) -> str | None:
    """Extract experience level from user text."""
    text_lower = text.lower().strip()
    if "fresher" in text_lower or "fresh" in text_lower:
        return "FRESHER"
    if "intern" in text_lower:
        return "INTERN"
    if "experience" in text_lower or "working" in text_lower:
        return "EXPERIENCED"
    return None


def _is_affirmative(text: str) -> bool:
    """Return True when user intent is a clear confirmation."""
    normalized = re.sub(r"\s+", " ", text.strip().lower())
    positive_phrases = (
        "yes",
        "y",
        "yeah",
        "yep",
        "correct",
        "looks good",
        "save",
        "ok",
        "okay",
        "confirmed",
        "confirm",
    )
    if normalized in positive_phrases:
        return True
    return normalized.startswith("yes ") or normalized.startswith("ok ")


async def handle_onboarding_step(
    session_id: str,
    user_id: str,
    current_step: str,
    user_message: str,
    extracted_data: dict[str, Any],
) -> tuple[str, str, dict[str, Any], bool]:
    """Process one onboarding step. Returns (response, next_step, updated_data, profile_saved)."""
    data = dict(extracted_data)
    profile_saved = False
    prisma = get_prisma()

    if current_step == "GREETING":
        profile = await prisma.studentprofile.find_unique(where={"userId": user_id})
        profile_name = ""
        if profile and profile.fullName:
            profile_name = profile.fullName.strip()

        if not profile_name:
            profile_name = str(data.get("full_name") or "").strip()
        if not profile_name:
            profile_name = "there"

        data["full_name"] = profile_name
        response = (
            STEP_PROMPTS["GREETING"].format(name=profile_name)
            + "\n\n"
            + STEP_PROMPTS["COLLECT_SKILLS"].format(name=profile_name)
        )
        return response, "COLLECT_SKILLS", data, False

    if current_step == "COLLECT_NAME":
        profile = await prisma.studentprofile.find_unique(where={"userId": user_id})
        profile_name = ""
        if profile and profile.fullName:
            profile_name = profile.fullName.strip()

        if not profile_name:
            profile_name = str(data.get("full_name") or "").strip()
        if profile_name:
            data["full_name"] = profile_name

        skills = _parse_skills(user_message)
        if skills:
            data["skills"] = skills
            return STEP_PROMPTS["COLLECT_EDUCATION"], "COLLECT_EDUCATION", data, False

        prompt = STEP_PROMPTS["COLLECT_SKILLS"].format(name=data.get("full_name", "there"))
        return prompt, "COLLECT_SKILLS", data, False

    if current_step == "COLLECT_SKILLS":
        skills = _parse_skills(user_message)
        if not skills:
            return "I didn't catch any skills. Please list them separated by commas.", current_step, data, False
        data["skills"] = skills
        return STEP_PROMPTS["COLLECT_EDUCATION"], "COLLECT_EDUCATION", data, False

    if current_step == "COLLECT_EDUCATION":
        edu = _parse_education(user_message)
        if not edu["degree"] and not edu["graduation_year"]:
            data["education_raw"] = user_message.strip()
        else:
            data["degree"] = edu["degree"]
            data["branch"] = edu["branch"]
            data["graduation_year"] = edu["graduation_year"]
        return STEP_PROMPTS["COLLECT_ROLES"], "COLLECT_ROLES", data, False

    if current_step == "COLLECT_ROLES":
        roles = _parse_roles(user_message)
        if not roles:
            return "Please share at least one preferred role.", current_step, data, False
        data["preferred_roles"] = roles
        return STEP_PROMPTS["COLLECT_EXPERIENCE"], "COLLECT_EXPERIENCE", data, False

    if current_step == "COLLECT_EXPERIENCE":
        exp = _parse_experience(user_message)
        if not exp:
            return "Please choose one: **Fresher**, **Intern**, or **Experienced**.", current_step, data, False
        data["experience_level"] = exp
        confirm = STEP_PROMPTS["CONFIRM_PROFILE"].format(
            name=data.get("full_name", "N/A"),
            skills=", ".join(data.get("skills", [])),
            degree=data.get("degree") or data.get("education_raw", "N/A"),
            branch=data.get("branch") or "",
            grad_year=data.get("graduation_year") or "",
            roles=", ".join(data.get("preferred_roles", [])),
            experience=data.get("experience_level", "N/A"),
        )
        return confirm, "CONFIRM_PROFILE", data, False

    if current_step == "CONFIRM_PROFILE":
        if _is_affirmative(user_message):
            try:
                await _save_student_profile(user_id, data)
                profile_saved = True
                return STEP_PROMPTS["COMPLETED"], "COMPLETED", data, True
            except Exception as exc:
                logger.exception("Failed to save onboarding profile for user %s", user_id)
                return (
                    "I could not save your profile right now due to a temporary issue. "
                    "Please reply **Yes** again in a moment."
                ), current_step, data, False
        else:
            return (
                "No worries! Tell me what you'd like to change "
                "(e.g., \"change skills to Python, Java\"), and I'll update it."
            ), current_step, data, False

    return STEP_PROMPTS.get(current_step, "How can I help you?"), current_step, data, False


async def _save_student_profile(user_id: str, data: dict[str, Any]) -> None:
    """Persist the collected onboarding data to StudentProfile."""
    prisma = get_prisma()

    profile = await prisma.studentprofile.find_unique(where={"userId": user_id})

    update_payload: dict[str, Any] = {
        "fullName": data.get("full_name", ""),
    }
    if data.get("degree"):
        update_payload["degree"] = data["degree"]
    if data.get("branch"):
        update_payload["branch"] = data["branch"]
    if data.get("graduation_year"):
        update_payload["graduationYear"] = data["graduation_year"]
    if data.get("preferred_roles"):
        update_payload["preferredRoles"] = data["preferred_roles"]
    if data.get("experience_level"):
        update_payload["experienceLevel"] = data["experience_level"]

    if profile:
        await prisma.studentprofile.update(
            where={"userId": user_id},
            data=update_payload,
        )
    else:
        create_payload = {
            "userId": user_id,
            "fullName": data.get("full_name", ""),
            "preferredRoles": data.get("preferred_roles") or [],
            "preferredLocations": data.get("preferred_locations") or [],
        }
        if data.get("degree"):
            create_payload["degree"] = data["degree"]
        if data.get("branch"):
            create_payload["branch"] = data["branch"]
        if data.get("graduation_year"):
            create_payload["graduationYear"] = data["graduation_year"]
        if data.get("experience_level"):
            create_payload["experienceLevel"] = data["experience_level"]

        await prisma.studentprofile.create(
            data=create_payload,
        )

    # Link skills through the Skill + StudentSkill tables
    if data.get("skills"):
        student_profile = await prisma.studentprofile.find_unique(where={"userId": user_id})
        if student_profile:
            for skill_name in data["skills"]:
                skill = await prisma.skill.upsert(
                    where={"name": skill_name.strip()},
                    data={
                        "create": {"name": skill_name.strip()},
                        "update": {},
                    }
                )
                try:
                    await prisma.studentskill.create(
                        data={"studentId": student_profile.id, "skillId": skill.id},
                    )
                except Exception:
                    logger.debug(
                        "Skill link already exists or failed for user=%s skill=%s",
                        user_id,
                        skill_name,
                    )


# ─────────────────────────────────────────────
# INTENT DETECTION (Career Assistant Mode)
# ─────────────────────────────────────────────

INTENT_PATTERNS: dict[str, list[str]] = {
    "show_matches": [
        r"\b(show|list|view|get|see|display)\b.*\b(match|matches|matched|recommendations?)\b",
        r"\b(my|top)\s+(match|matches)\b",
        r"\bwhat\s+jobs?\s+(match|fit)\b",
    ],
    "show_applications": [
        r"\b(show|list|view|get|see|display)\b.*\b(application|applications|applied)\b",
        r"\bmy\s+application\b",
        r"\bapplication\s+status\b",
    ],
    "apply_to_job": [
        r"\b(apply|applying)\b.*\b(to|for)\b.*\b(job|role|position)\b",
        r"\bapply\s+#?\d+\b",
    ],
    "why_matched": [
        r"\bwhy\b.*\b(match|matched|score|ranked)\b",
        r"\bexplain\b.*\b(match|score)\b",
        r"\bhow\b.*\b(did\s+I\s+match|was\s+I\s+matched)\b",
    ],
    "improve_resume": [
        r"\b(improve|enhance|upgrade|optimize|fix)\b.*\b(resume|cv|profile)\b",
        r"\bresume\s+(tip|advice|suggestion|feedback)\b",
    ],
    "job_search": [
        r"\b(search|find|look\s+for)\b.*\bjob\b",
        r"\bjob\b.*\b(search|find|recommend)\b",
        r"\bwhat\s+jobs?\s+(are\s+available|should\s+I)\b",
    ],
    "general_question": [],  # Fallback — always matches if nothing else does
}


def detect_intent(message: str) -> str:
    """Match user message against intent patterns. Returns intent name."""
    message_lower = message.lower().strip()
    for intent, patterns in INTENT_PATTERNS.items():
        if intent == "general_question":
            continue
        for pattern in patterns:
            if re.search(pattern, message_lower):
                return intent
    return "general_question"


# ─────────────────────────────────────────────
# RULE-BASED HANDLERS (no LLM call)
# ─────────────────────────────────────────────

async def handle_show_matches(user_id: str) -> str:
    """Fetch top matches from DB and format as text."""
    prisma = get_prisma()
    profile = await prisma.studentprofile.find_unique(where={"userId": user_id})
    if not profile:
        return "You don't have a profile yet. Complete onboarding first!"

    matches = await prisma.matchscore.find_many(
        where={"studentId": profile.id},
        order={"finalScore": "desc"},
        take=5,
        include={"job": True},
    )

    if not matches:
        return (
            "No matches found yet. Your matches will appear once recruiters post jobs "
            "and the matching engine runs. Check back soon!"
        )

    lines = ["🎯 **Your Top Job Matches:**\n"]
    for i, m in enumerate(matches, 1):
        job = m.job
        score_pct = round(m.finalScore * 100, 1)
        title = job.title if job else "Unknown Role"
        company = job.location or "Remote"
        lines.append(f"{i}. **{title}** — {company} (Match: {score_pct}%)")

    lines.append('\nAsk "Why did I match with [job]?" for a detailed explanation.')
    return "\n".join(lines)


async def handle_show_applications(user_id: str) -> str:
    """Fetch user's applications from DB."""
    prisma = get_prisma()
    profile = await prisma.studentprofile.find_unique(where={"userId": user_id})
    if not profile:
        return "You don't have a profile yet. Complete onboarding first!"

    apps = await prisma.application.find_many(
        where={"studentId": profile.id},
        include={"job": True},
        order={"appliedAt": "desc"},
        take=10,
    )

    if not apps:
        return "You haven't applied to any jobs yet. Check your matches and apply!"

    lines = ["📋 **Your Applications:**\n"]
    for a in apps:
        title = a.job.title if a.job else "Unknown"
        lines.append(f"• **{title}** — Status: {a.status}")
    return "\n".join(lines)


async def handle_apply_to_job(user_id: str, message: str) -> str:
    """Parse job reference from message and create application."""
    prisma = get_prisma()
    profile = await prisma.studentprofile.find_unique(where={"userId": user_id})
    if not profile:
        return "You need a profile first. Complete onboarding!"

    # Try to extract job ID from message
    id_match = re.search(r"[a-f0-9\-]{36}", message)
    if not id_match:
        return (
            "I need the job ID to apply. You can find it in your matches. "
            "Try: \"Apply to job [paste-job-id-here]\""
        )

    job_id = id_match.group(0)
    job = await prisma.job.find_unique(where={"id": job_id})
    if not job:
        return f"Job `{job_id}` not found. Double-check the ID from your matches."

    existing = await prisma.application.find_first(
        where={"studentId": profile.id, "jobId": job_id},
    )
    if existing:
        return f"You've already applied to **{job.title}**. Status: {existing.status}"

    await prisma.application.create(
        data={"studentId": profile.id, "jobId": job_id},
    )
    return f"✅ Applied to **{job.title}**! You'll be notified when the recruiter reviews."


RULE_HANDLERS: dict[str, Any] = {
    "show_matches": handle_show_matches,
    "show_applications": handle_show_applications,
}


# ─────────────────────────────────────────────
# CONTEXT BUILDER (for LLM prompts)
# ─────────────────────────────────────────────

async def build_context(user_id: str) -> str:
    """Build rich context string injected into LLM prompts."""
    prisma = get_prisma()
    parts: list[str] = []

    profile = await prisma.studentprofile.find_unique(
        where={"userId": user_id},
        include={"studentSkills": {"include": {"skill": True}}},
    )
    if profile:
        skills = [ss.skill.name for ss in profile.studentSkills if ss.skill]
        parts.append(
            f"Student Profile:\n"
            f"- Name: {profile.fullName}\n"
            f"- Degree: {profile.degree or 'N/A'} {profile.branch or ''}\n"
            f"- Graduation: {profile.graduationYear or 'N/A'}\n"
            f"- Skills: {', '.join(skills) if skills else 'None listed'}\n"
            f"- Preferred Roles: {', '.join(profile.preferredRoles) if profile.preferredRoles else 'N/A'}\n"
            f"- Experience: {profile.experienceLevel or 'N/A'}\n"
            f"- Location: {profile.location or 'N/A'}"
        )

        # Top matches with SHAP
        matches = await prisma.matchscore.find_many(
            where={"studentId": profile.id},
            order={"finalScore": "desc"},
            take=3,
            include={"job": True},
        )
        if matches:
            match_lines = ["Top Matches:"]
            for m in matches:
                title = m.job.title if m.job else "Unknown"
                score = round(m.finalScore * 100, 1)
                shap_str = ""
                if m.shapValues and isinstance(m.shapValues, dict):
                    top_factors = sorted(m.shapValues.items(), key=lambda x: abs(x[1]), reverse=True)[:3]
                    shap_str = " | Factors: " + ", ".join(f"{k}: {v:+.2f}" for k, v in top_factors)
                match_lines.append(f"- {title} ({score}%){shap_str}")
            parts.append("\n".join(match_lines))

        # Application stats
        apps = await prisma.application.find_many(where={"studentId": profile.id})
        if apps:
            by_status: dict[str, int] = {}
            for a in apps:
                by_status[a.status] = by_status.get(a.status, 0) + 1
            status_str = ", ".join(f"{k}: {v}" for k, v in by_status.items())
            parts.append(f"Applications: {len(apps)} total ({status_str})")

    context = "\n\n".join(parts)
    # Truncate to prevent context window overflow
    return context[:4000] if context else "No profile data available."


# ─────────────────────────────────────────────
# LLM-BASED HANDLERS
# ─────────────────────────────────────────────

async def handle_llm_intent(
    user_id: str,
    intent: str,
    message: str,
    history: list[dict],
) -> str:
    """Route LLM-based intents with injected context."""
    context = await build_context(user_id)

    intent_instructions = {
        "why_matched": (
            "The student is asking why they matched with a specific job. "
            "Use the SHAP factors from the context to explain clearly. "
            "Be specific about which skills and factors contributed most."
        ),
        "improve_resume": (
            "Give specific, actionable resume improvement tips based on the student's "
            "profile and the skill gaps visible in their match data. "
            "Suggest concrete additions, not generic advice."
        ),
        "job_search": (
            "Help the student search for jobs based on their profile and preferences. "
            "Reference their skills and match data to suggest relevant directions."
        ),
        "general_question": (
            "Answer the student's career-related question helpfully. "
            "Reference their profile context when relevant."
        ),
    }

    instruction = intent_instructions.get(intent, intent_instructions["general_question"])

    system_prompt = (
        f"{llm_provider.TALENTSYNC_SYSTEM_PROMPT}\n\n"
        f"--- STUDENT CONTEXT ---\n{context}\n\n"
        f"--- INSTRUCTION ---\n{instruction}"
    )

    # Trim history to last 10 messages to stay within context window
    recent_history = history[-10:] if history else []

    return await llm_provider.generate(
        prompt=message,
        history=recent_history,
        system_prompt=system_prompt,
    )


# ─────────────────────────────────────────────
# MASTER ORCHESTRATOR
# ─────────────────────────────────────────────

async def get_or_create_session(user_id: str, session_id: str | None = None) -> Any:
    """Get existing session or create a new one."""
    prisma = get_prisma()

    if session_id:
        session = await prisma.chatbotsession.find_first(
            where={"id": session_id, "userId": user_id},
        )
        if session:
            return session

    # Create new session
    return await prisma.chatbotsession.create(
        data={
            "userId": user_id,
            "messages": Json([]),
            "onboardingStep": "GREETING",
            "mode": "ONBOARDING",
        },
    )


async def process_message(
    user_id: str,
    message: str,
    session_id: str | None = None,
) -> dict[str, Any]:
    """Master orchestrator — routes between onboarding and career assistant.

    Returns:
        Dict with response text, session info, mode, and metadata.
    """
    session = await get_or_create_session(user_id, session_id)
    prisma = get_prisma()

    mode = session.mode
    current_step = session.onboardingStep
    extracted_data = session.extractedData or {}
    if isinstance(extracted_data, str):
        try:
            extracted_data = json.loads(extracted_data)
        except json.JSONDecodeError:
            extracted_data = {}

    intent: str | None = None
    profile_complete = session.isComplete

    normalized_message = message.strip().lower()
    is_bootstrap_greeting = (
        mode == "ONBOARDING"
        and current_step == "GREETING"
        and normalized_message in {"hi", "hello"}
    )

    if not is_bootstrap_greeting:
        # Save user message
        await prisma.chatmessage.create(
            data={
                "sessionId": session.id,
                "role": "user",
                "content": message,
            },
        )

    # ─── ONBOARDING MODE ───
    if mode == "ONBOARDING" and current_step != "COMPLETED":
        response_text, next_step, updated_data, saved = await handle_onboarding_step(
            session_id=session.id,
            user_id=user_id,
            current_step=current_step,
            user_message=message,
            extracted_data=extracted_data,
        )

        new_mode = "CAREER_ASSISTANT" if next_step == "COMPLETED" else "ONBOARDING"
        profile_complete = saved or profile_complete

        await prisma.chatbotsession.update(
            where={"id": session.id},
            data={
                "onboardingStep": next_step,
                "mode": new_mode,
                "extractedData": Json(updated_data),
                "isComplete": profile_complete,
            },
        )

        # Save assistant reply
        await prisma.chatmessage.create(
            data={
                "sessionId": session.id,
                "role": "assistant",
                "content": response_text,
            },
        )

        return {
            "response": response_text,
            "session_id": session.id,
            "mode": new_mode,
            "onboarding_step": next_step,
            "profile_complete": profile_complete,
            "intent": None,
        }

    # ─── CAREER ASSISTANT MODE ───
    intent = detect_intent(message)

    if intent == "apply_to_job":
        response_text = await handle_apply_to_job(user_id, message)
    elif intent in RULE_HANDLERS:
        handler = RULE_HANDLERS[intent]
        response_text = await handler(user_id)
    else:
        # Fetch recent history for LLM context
        recent_msgs = await prisma.chatmessage.find_many(
            where={"sessionId": session.id},
            order={"createdAt": "desc"},
            take=12,
        )
        history = [
            {"role": m.role, "content": m.content}
            for m in reversed(recent_msgs)
        ]
        response_text = await handle_llm_intent(user_id, intent, message, history)

    # Save assistant reply
    await prisma.chatmessage.create(
        data={
            "sessionId": session.id,
            "role": "assistant",
            "content": response_text,
            "intent": intent,
        },
    )

    return {
        "response": response_text,
        "session_id": session.id,
        "mode": "CAREER_ASSISTANT",
        "onboarding_step": None,
        "profile_complete": True,
        "intent": intent,
    }