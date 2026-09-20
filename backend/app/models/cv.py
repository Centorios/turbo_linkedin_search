import re
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator


PARTIAL_DATE_PATTERN = r"^(?:\d{4}|(?:0[1-9]|1[0-2])-\d{4})?$"
EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
HTTP_URL_PATTERN = re.compile(r"^https?://[^\s]+$")

PartialDate = Annotated[str, StringConstraints(pattern=PARTIAL_DATE_PATTERN)]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class PersonalInfo(StrictModel):
    fullName: str
    email: str
    phone: str
    location: str
    linkedin: str
    website: str

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        if value and not EMAIL_PATTERN.fullmatch(value):
            raise ValueError("email must be empty or a valid email address")
        return value

    @field_validator("linkedin", "website")
    @classmethod
    def validate_http_url(cls, value: str) -> str:
        if value and not HTTP_URL_PATTERN.fullmatch(value):
            raise ValueError("URL must be empty or use http/https")
        return value


class Experience(StrictModel):
    title: str
    company: str
    location: str
    startDate: PartialDate
    endDate: PartialDate
    achievements: list[str]


class Education(StrictModel):
    institution: str
    program: str
    startDate: PartialDate
    endDate: PartialDate
    description: str


class Skills(StrictModel):
    hard: list[str]
    soft: list[str]


class Language(StrictModel):
    name: str
    proficiency: str


class Certification(StrictModel):
    name: str
    issuer: str
    issueDate: PartialDate
    expirationDate: PartialDate
    credential: str


class StructuredCv(StrictModel):
    personalInfo: PersonalInfo
    summary: str
    experience: list[Experience] = Field(default_factory=list)
    education: list[Education] = Field(default_factory=list)
    skills: Skills
    languages: list[Language] = Field(default_factory=list)
    certifications: list[Certification] = Field(default_factory=list)
