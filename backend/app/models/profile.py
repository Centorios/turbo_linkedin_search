import re

from pydantic import AnyHttpUrl, EmailStr, TypeAdapter, ValidationError, field_validator

from app.models.cv import StrictModel


_EMAIL_ADAPTER = TypeAdapter(EmailStr)
_HTTP_URL_ADAPTER = TypeAdapter(AnyHttpUrl)
_ABSOLUTE_HTTP_URL = re.compile(r"^https?://[^\s]+$")


class BasicProfile(StrictModel):
    fullName: str
    email: str
    phone: str
    location: str
    linkedin: str
    website: str

    @field_validator("fullName")
    @classmethod
    def validate_full_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("fullName must not be blank")
        return value

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        if not value:
            return value
        try:
            _EMAIL_ADAPTER.validate_python(value)
        except ValidationError as exc:
            raise ValueError("email must be empty or a valid email address") from exc
        return value

    @field_validator("linkedin", "website")
    @classmethod
    def validate_http_url(cls, value: str) -> str:
        if not value:
            return value
        if not _ABSOLUTE_HTTP_URL.fullmatch(value):
            raise ValueError("URL must be empty or an absolute http/https URL")
        try:
            _HTTP_URL_ADAPTER.validate_python(value)
        except ValidationError as exc:
            raise ValueError("URL must be empty or an absolute http/https URL") from exc
        return value