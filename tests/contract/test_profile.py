import pytest
from pydantic import ValidationError

from app.models.profile import BasicProfile


VALID_PROFILE = {
    "fullName": "Ana García",
    "email": "ana.cv@example.com",
    "phone": "+34 600 000 000",
    "location": "Madrid",
    "linkedin": "https://www.linkedin.com/in/ana-garcia",
    "website": "https://ana.example.com",
}


def test_profile_accepts_empty_optional_fields() -> None:
    profile = BasicProfile.model_validate(
        {
            "fullName": "Ana García",
            "email": "",
            "phone": "",
            "location": "",
            "linkedin": "",
            "website": "",
        }
    )

    assert profile.model_dump() == {
        "fullName": "Ana García",
        "email": "",
        "phone": "",
        "location": "",
        "linkedin": "",
        "website": "",
    }


@pytest.mark.parametrize("full_name", ["", "   ", "\t\n"])
def test_profile_rejects_blank_name(full_name: str) -> None:
    with pytest.raises(ValidationError):
        BasicProfile.model_validate({**VALID_PROFILE, "fullName": full_name})


@pytest.mark.parametrize("email", ["ana-at-example.com", "ana@example", " "])
def test_profile_rejects_invalid_email(email: str) -> None:
    with pytest.raises(ValidationError):
        BasicProfile.model_validate({**VALID_PROFILE, "email": email})


@pytest.mark.parametrize("field", ["linkedin", "website"])
@pytest.mark.parametrize("url", ["ftp://example.com", "example.com", "https:/example.com"])
def test_profile_rejects_invalid_links(field: str, url: str) -> None:
    with pytest.raises(ValidationError):
        BasicProfile.model_validate({**VALID_PROFILE, field: url})


def test_profile_rejects_extra_fields_including_user_id() -> None:
    with pytest.raises(ValidationError):
        BasicProfile.model_validate({**VALID_PROFILE, "user_id": "another-user"})


def test_profile_accepts_optional_email_and_links_as_empty() -> None:
    profile = BasicProfile.model_validate({**VALID_PROFILE, "email": "", "linkedin": "", "website": ""})

    assert profile.email == ""
    assert profile.linkedin == ""
    assert profile.website == ""


def test_profile_validates_and_trims_name() -> None:
    profile = BasicProfile.model_validate({**VALID_PROFILE, "fullName": "  Ana García  "})

    assert profile.fullName == "Ana García"