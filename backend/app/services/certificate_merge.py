import re
import unicodedata
from typing import Any

from app.models.cv import StructuredCv
from app.models.profile_certificate import CertificateMergeReport


def normalize(value: str) -> str:
    value = unicodedata.normalize("NFKD", value.casefold())
    value = "".join(char for char in value if not unicodedata.combining(char))
    return re.sub(r"\s+", " ", value).strip()


def equivalent(left: dict[str, str], right: dict[str, str]) -> bool:
    left_reference = normalize(left.get("credential", ""))
    right_reference = normalize(right.get("credential", ""))
    if left_reference and right_reference and left_reference == right_reference:
        return True
    if not normalize(left.get("name", "")) or not normalize(left.get("issuer", "")):
        return False
    if normalize(left.get("name", "")) != normalize(right.get("name", "")):
        return False
    if normalize(left.get("issuer", "")) != normalize(right.get("issuer", "")):
        return False
    left_date, right_date = left.get("issueDate", ""), right.get("issueDate", "")
    if not left_date or not right_date or left_date == right_date:
        return True
    return (len(left_date) != len(right_date)
            and left_date[-4:] == right_date[-4:])


def merge_selected_certificates(
    cv: StructuredCv, selected: list[dict[str, Any]]
) -> tuple[StructuredCv, CertificateMergeReport]:
    data = cv.model_dump()
    report = CertificateMergeReport()
    for item in selected:
        identifier = str(item["id"])
        incoming = item["certification"]
        if hasattr(incoming, "model_dump"):
            incoming = incoming.model_dump()
        current = next((entry for entry in data["certifications"] if equivalent(entry, incoming)), None)
        if current is None:
            data["certifications"].append(dict(incoming))
            if identifier not in report.addedIds:
                report.addedIds.append(identifier)
        else:
            for field in ("name", "issuer", "issueDate", "expirationDate", "credential"):
                if not current[field] and incoming[field]:
                    current[field] = incoming[field]
            if identifier not in report.addedIds and identifier not in report.duplicateIds:
                report.duplicateIds.append(identifier)
        language = item.get("language")
        if language:
            if hasattr(language, "model_dump"):
                language = language.model_dump()
            if not any(normalize(existing["name"]) == normalize(language["name"]) for existing in data["languages"]):
                data["languages"].append(dict(language))
    return StructuredCv.model_validate(data), report
