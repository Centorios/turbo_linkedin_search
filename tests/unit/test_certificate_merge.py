from app.models.cv import StructuredCv
from app.services.certificate_merge import equivalent, merge_selected_certificates


def certificate(name="Curso de Datos", issuer="Academia", issue_date="", credential=""):
    return {"name": name, "issuer": issuer, "issueDate": issue_date,
            "expirationDate": "", "credential": credential}


def cv_with(items):
    return StructuredCv.model_validate({
        "personalInfo": {"fullName": "Ana", "email": "", "phone": "", "location": "",
                         "linkedin": "", "website": ""},
        "summary": "", "experience": [], "education": [],
        "skills": {"hard": [], "soft": []}, "languages": [], "certifications": items,
    })


def test_equivalent_normalizes_accents_case_and_spaces():
    assert equivalent(certificate("  CURSO   de Dátos ", "ACADEMIA"), certificate())
    assert not equivalent(certificate("Curso de Datos", "Otra academia"), certificate())
    assert not equivalent(certificate("Curso de Datos avanzado"), certificate())
    assert equivalent(certificate(issue_date="2025"), certificate(issue_date="04-2025"))
    assert not equivalent(certificate(issue_date="04-2025"), certificate(issue_date="05-2025"))


def test_reference_matches_and_completion_only_fills_empty_fields():
    original = certificate(name="Curso de Datos", issuer="", credential="ABC-123")
    selected = [{"id": "cert-1", "certification": certificate(issuer="Academia", credential="abc-123"), "language": None}]
    merged, report = merge_selected_certificates(cv_with([original]), selected)
    assert len(merged.certifications) == 1
    assert merged.certifications[0].issuer == "Academia"
    assert report.duplicateIds == ["cert-1"]


def test_distinct_certificate_is_added_once_with_language():
    selected = [{"id": "cert-1", "certification": certificate(),
                 "language": {"name": "Inglés", "proficiency": "C1"}}]
    merged, report = merge_selected_certificates(cv_with([]), selected + selected)
    assert len(merged.certifications) == 1
    assert len(merged.languages) == 1
    assert report.addedIds == ["cert-1"]
