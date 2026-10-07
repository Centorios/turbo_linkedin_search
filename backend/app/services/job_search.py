from uuid import UUID

from app.models.cv import StructuredCv
from app.models.jobs import JobSearchProfile


def build_search_profile(resume_id: UUID, cv: StructuredCv) -> JobSearchProfile:
    skills: list[str] = []
    seen: set[str] = set()
    for value in cv.skills.hard:
        skill = value.strip()
        if skill and skill.casefold() not in seen:
            skills.append(skill)
            seen.add(skill.casefold())
        if len(skills) == 6:
            break

    title = next((item.title.strip() for item in cv.experience if item.title.strip()), "")
    keywords = title or " ".join(skills[:3])
    return JobSearchProfile(
        resumeId=resume_id,
        suggestedKeywords=keywords[:120],
        suggestedLocation=(cv.personalInfo.location.strip() or "Argentina")[:100],
        skills=skills,
    )
