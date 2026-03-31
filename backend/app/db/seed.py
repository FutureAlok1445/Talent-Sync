# WHO WRITES THIS: Backend developer
# WHAT THIS DOES: Seeds demo data into the database for presentation.
#                 Creates 1 recruiter + sample jobs with skills via JobSkill join table.
#                 Run once: python -m app.db.seed
# DEPENDS ON: Prisma client, auth_service (for password hashing)

import asyncio
from datetime import datetime, timezone

from app.db.database import prisma, get_prisma
from app.services.auth_service import hash_password


async def _get_or_create_user(email: str, password: str, role: str, name: str = None):
    existing = await prisma.user.find_unique(where={"email": email})
    if existing:
        return existing
    return await prisma.user.create(
        data={
            "email": email,
            "name": name,
            "passwordHash": hash_password(password),
            "role": role,
        }
    )


async def _upsert_skill(name: str) -> str:
    """Find or create a Skill by name, return its ID."""
    skill = await prisma.skill.find_first(
        where={"name": {"equals": name, "mode": "insensitive"}}
    )
    if not skill:
        skill = await prisma.skill.create(data={"name": name})
    return skill.id


async def seed_jobs():
    """Seed 10 sample jobs for testing."""
    db = get_prisma()

    recruiter = await db.recruiterprofile.find_first()
    if not recruiter:
        print("❌ No recruiter found. Register a recruiter account first.")
        return

    existing = await db.job.count(where={"recruiterId": recruiter.id})
    if existing > 0:
        print(f"⏭️  Recruiter already has {existing} jobs. Skipping seed.")
        return

    sample_jobs = [
        {
            "title": "Frontend Developer Intern",
            "description": (
                "Build responsive UIs using React and Tailwind CSS. "
                "Work with the product team on real features shipped to users. "
                "You will collaborate closely with designers and backend engineers."
            ),
            "skills": ["React", "JavaScript", "Tailwind CSS", "Git"],
            "experienceLevel": "INTERN",
            "education": "Any",
            "jobType": "INTERNSHIP",
            "workMode": "REMOTE",
            "location": None,
            "salaryMin": 15000,
            "salaryMax": 25000,
            "duration": "3 months",
            "openings": 2,
            "deadline": "2026-06-30",
            "perks": ["Certificate", "Letter of Recommendation"],
            "aboutCompany": "A fast-growing SaaS startup.",
        },
        {
            "title": "Backend Developer",
            "description": (
                "Design and build scalable REST APIs using FastAPI and PostgreSQL. "
                "Own backend features from design to deployment. "
                "Work in a collaborative agile team with weekly sprints."
            ),
            "skills": ["Python", "FastAPI", "PostgreSQL", "Docker", "REST APIs"],
            "experienceLevel": "JUNIOR",
            "education": "B.Tech",
            "jobType": "FULL_TIME",
            "workMode": "HYBRID",
            "location": "Bangalore",
            "salaryMin": 600000,
            "salaryMax": 900000,
            "duration": None,
            "openings": 1,
            "deadline": "2026-05-15",
            "perks": ["Health Insurance", "Remote Fridays"],
            "aboutCompany": "B2B fintech company serving 500+ businesses.",
        },
        {
            "title": "ML Engineer Intern",
            "description": (
                "Work on NLP and recommendation models. "
                "Help train, evaluate, and deploy ML models to production. "
                "Gain hands-on experience with real-world datasets and pipelines."
            ),
            "skills": ["Python", "PyTorch", "Scikit-learn", "NLP", "SQL"],
            "experienceLevel": "INTERN",
            "education": "B.Tech",
            "jobType": "INTERNSHIP",
            "workMode": "REMOTE",
            "location": None,
            "salaryMin": 20000,
            "salaryMax": 35000,
            "duration": "6 months",
            "openings": 1,
            "deadline": "2026-05-01",
            "perks": ["Pre-placement offer possibility", "Mentorship"],
            "aboutCompany": "AI-first product company.",
        },
        {
            "title": "Full Stack Developer",
            "description": (
                "Build end-to-end features across React frontend "
                "and Node.js/FastAPI backend. Own entire product features. "
                "Participate in architecture discussions and code reviews."
            ),
            "skills": ["React", "TypeScript", "Node.js", "PostgreSQL", "Docker"],
            "experienceLevel": "JUNIOR",
            "education": "Any",
            "jobType": "FULL_TIME",
            "workMode": "ONSITE",
            "location": "Mumbai",
            "salaryMin": 700000,
            "salaryMax": 1200000,
            "duration": None,
            "openings": 3,
            "deadline": "2026-06-01",
            "perks": ["Stock Options", "Flexible hours", "Health Insurance"],
            "aboutCompany": "Series A startup building developer tools.",
        },
        {
            "title": "Data Analyst",
            "description": (
                "Analyze product data, build dashboards, and "
                "provide insights to business teams using SQL and Python. "
                "Drive data-informed decisions across the organization."
            ),
            "skills": ["SQL", "Python", "Tableau", "Excel", "Statistics"],
            "experienceLevel": "FRESHER",
            "education": "Any",
            "jobType": "FULL_TIME",
            "workMode": "HYBRID",
            "location": "Hyderabad",
            "salaryMin": 400000,
            "salaryMax": 650000,
            "duration": None,
            "openings": 2,
            "deadline": "2026-05-20",
            "perks": ["Learning Budget", "Flexible WFH"],
            "aboutCompany": "E-commerce analytics platform.",
        },
    ]

    for job_data in sample_jobs:
        skills = job_data.pop("skills")
        deadline_str = job_data.pop("deadline")
        deadline_dt = datetime.strptime(deadline_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)

        # Upsert skills and build JobSkill create list
        job_skill_creates = []
        for skill_name in skills:
            skill_id = await _upsert_skill(skill_name)
            job_skill_creates.append({
                "skillId": skill_id,
                "isRequired": True,
                "weightage": 1.0,
            })

        await db.job.create(
            data={
                "recruiterId": recruiter.id,
                "title": job_data["title"],
                "description": job_data["description"],
                "experienceLevel": job_data["experienceLevel"],
                "education": job_data["education"],
                "jobType": job_data["jobType"],
                "workMode": job_data["workMode"],
                "location": job_data.get("location"),
                "salaryMin": job_data.get("salaryMin"),
                "salaryMax": job_data.get("salaryMax"),
                "duration": job_data.get("duration"),
                "openings": job_data["openings"],
                "deadline": deadline_dt,
                "perks": job_data.get("perks", []),
                "aboutCompany": job_data.get("aboutCompany", ""),
                "isActive": True,
                "jobSkills": {"create": job_skill_creates},
            }
        )
        print(f"✅ Created job: {job_data['title']}")

    print(f"\n🎉 Seeded {len(sample_jobs)} jobs successfully!")


async def seed() -> None:
    await prisma.connect()
    try:
        # Create demo users
        student_user = await _get_or_create_user(
            "student@demo.com", "demo1234", "STUDENT", name="Demo Student"
        )
        recruiter_user = await _get_or_create_user(
            "recruiter@techcorp.com", "demo1234", "RECRUITER", name="Hiring Manager"
        )

        # Student profile
        student_profile = await prisma.studentprofile.find_unique(
            where={"userId": student_user.id}
        )
        if not student_profile:
            await prisma.studentprofile.create(
                data={
                    "userId": student_user.id,
                    "fullName": "Demo Student",
                    "college": "Demo Institute of Technology",
                    "branch": "Computer Science",
                    "cgpa": 8.4,
                    "preferredRoles": ["Data Analyst", "ML Intern"],
                    "preferredLocations": ["Bangalore", "Remote"],
                }
            )

        # Recruiter profile
        recruiter_profile = await prisma.recruiterprofile.find_unique(
            where={"userId": recruiter_user.id}
        )
        if not recruiter_profile:
            await prisma.recruiterprofile.create(
                data={
                    "userId": recruiter_user.id,
                    "fullName": "Hiring Manager",
                    "companyName": "TechCorp",
                    "industry": "Technology",
                    "location": "Bangalore",
                    "bio": "Leading tech company hiring fresh talent.",
                }
            )

        # Seed jobs
        await seed_jobs()

    finally:
        await prisma.disconnect()


if __name__ == "__main__":
    asyncio.run(seed())