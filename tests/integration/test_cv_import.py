from __future__ import annotations

from io import BytesIO
from uuid import uuid4

import pytest
from pypdf import PdfWriter

from app.models.cv_import import EditRequest, SaveVersionRequest
from app.services.cv_import import (
    CvSourceNotFoundError,
    CvImportService,
    InvalidPdfError,
    extract_pdf_text,
)
from tests.cv_pdf_fixtures import empty_pdf, pdf_with_text


USER_ID = "00000000-0000-0000-0000-000000000001"
OTHER_USER_ID = "00000000-0000-0000-0000-000000000002"
CV = {
    "personalInfo": {
        "fullName": "Ana García",
        "email": "ana@example.com",
        "phone": "",
        "location": "Buenos Aires",
        "linkedin": "",
        "website": "",
        "photoPath": None,
    },
    "summary": "Desarrolladora de software",
    "experience": [],
    "education": [],
    "skills": {"hard": ["Python"], "soft": []},
    "languages": [],
    "certifications": [],
}


class MemoryRepository:
    def __init__(self) -> None:
        self.sources: dict[str, dict] = {}
        self.resumes: dict[str, dict] = {}
        self.files: dict[str, bytes] = {}
        self.requests: dict[tuple[str, str], str] = {}

    def get_import_by_request(self, user_id: str, request_id: str) -> dict | None:
        source_id = self.requests.get((user_id, request_id))
        if source_id is None:
            return None
        source = self.sources[source_id]
        resume = next(row for row in self.resumes.values() if row["source_id"] == source_id)
        return {"source": source, "resume": resume}

    def create_import(
        self,
        user_id: str,
        request_id: str,
        source_id: str,
        filename: str,
        file_bytes: bytes,
        page_count: int,
        data: dict,
    ) -> dict:
        source = {
            "id": source_id,
            "user_id": user_id,
            "request_id": request_id,
            "original_filename": filename,
            "file_size_bytes": len(file_bytes),
            "page_count": page_count,
            "created_at": "2026-10-14T12:00:00Z",
        }
        resume = {
            "id": str(uuid4()),
            "user_id": user_id,
            "source_id": source_id,
            "parent_resume_id": None,
            "data": data,
            "created_at": source["created_at"],
        }
        self.sources[source_id] = source
        self.resumes[resume["id"]] = resume
        self.files[source_id] = file_bytes
        self.requests[(user_id, request_id)] = source_id
        return {"source": source, "resume": resume}

    def get_source(self, user_id: str, source_id: str) -> dict | None:
        source = self.sources.get(source_id)
        return source if source and source["user_id"] == user_id else None

    def get_resume(self, user_id: str, resume_id: str) -> dict | None:
        resume = self.resumes.get(resume_id)
        return resume if resume and resume["user_id"] == user_id else None

    def create_version(
        self,
        user_id: str,
        source_id: str,
        request_id: str,
        parent_resume_id: str,
        data: dict,
    ) -> dict:
        existing = next(
            (row for row in self.resumes.values() if row["user_id"] == user_id and row.get("request_id") == request_id),
            None,
        )
        if existing:
            if existing["source_id"] != source_id or existing["parent_resume_id"] != parent_resume_id:
                raise ValueError("Idempotency key was already used for a different version")
            return existing
        row = {
            "id": str(uuid4()),
            "user_id": user_id,
            "source_id": source_id,
            "parent_resume_id": parent_resume_id,
            "request_id": request_id,
            "data": data,
            "created_at": "2026-10-14T12:01:00Z",
        }
        self.resumes[row["id"]] = row
        return row

    def download_source(self, user_id: str, source_id: str) -> tuple[bytes, str] | None:
        source = self.get_source(user_id, source_id)
        if source is None:
            return None
        return self.files[source_id], source["original_filename"]

    def delete_source(self, user_id: str, source_id: str) -> bool:
        if self.get_source(user_id, source_id) is None:
            return False
        del self.sources[source_id]
        del self.files[source_id]
        for resume_id, resume in list(self.resumes.items()):
            if resume["source_id"] == source_id:
                del self.resumes[resume_id]
        return True


class FakeProvider:
    def __init__(self, edit_result: dict | None = None, generated_cv: dict | None = None) -> None:
        self.generated_text: list[str] = []
        self.edit_requests: list[dict] = []
        self.edit_result = edit_result or {"status": "ready", "proposedCv": CV}
        self.generated_cv = generated_cv or CV

    async def generate_cv(self, text: str) -> dict:
        self.generated_text.append(text)
        return self.generated_cv

    async def edit_cv(self, base_cv: dict, instruction: str, answers: list[str]) -> dict:
        self.edit_requests.append({"base": base_cv, "instruction": instruction, "answers": answers})
        return self.edit_result


def test_text_pdf_extraction_and_synthetic_corpus_meet_ninety_percent_threshold() -> None:
    corpus = [
        pdf_with_text(f"Experiencia profesional {index}: Python y desarrollo de productos")
        for index in range(10)
    ]
    extracted = [extract_pdf_text(document) for document in corpus]

    assert sum(bool(text.strip()) for text in extracted) / len(corpus) >= 0.9
    assert all("Experiencia profesional" in text for text in extracted)


def test_scanned_empty_and_oversized_page_count_pdfs_are_rejected() -> None:
    with pytest.raises(InvalidPdfError):
        extract_pdf_text(empty_pdf())
    with pytest.raises(InvalidPdfError):
        extract_pdf_text(pdf_with_text("Experiencia", pages=21))
    with pytest.raises(InvalidPdfError):
        extract_pdf_text(b"%PDF-1.4\nnot a valid document")


def test_encrypted_pdf_is_rejected() -> None:
    writer = PdfWriter()
    writer.add_blank_page(width=300, height=400)
    writer.encrypt("secret")
    output = BytesIO()
    writer.write(output)

    with pytest.raises(InvalidPdfError, match="contraseña"):
        extract_pdf_text(output.getvalue())


@pytest.mark.asyncio
async def test_import_saves_source_and_initial_resume_and_is_idempotent() -> None:
    repository = MemoryRepository()
    provider = FakeProvider()
    service = CvImportService(provider=provider, repository=repository)
    request_id = str(uuid4())
    source_pdf = pdf_with_text("Ana García. Experiencia en desarrollo de software.")

    first = await service.import_pdf(USER_ID, request_id, "CV Ana.pdf", source_pdf)
    repeated = await service.import_pdf(USER_ID, request_id, "changed.pdf", source_pdf)

    assert first.source.id == repeated.source.id
    assert first.source.originalFilename == "CV Ana.pdf"
    assert first.resume.parentResumeId is None
    assert repository.files[str(first.source.id)] == source_pdf
    assert "Ana García" in provider.generated_text[0]
    assert len(provider.generated_text) == 1


@pytest.mark.asyncio
async def test_edit_proposal_is_not_saved_and_only_changed_sections_are_reported() -> None:
    repository = MemoryRepository()
    provider = FakeProvider(
        edit_result={
            "status": "ready",
            "proposedCv": {
                **CV,
                "experience": [{
                    "title": "Desarrolladora",
                    "company": "Acme",
                    "location": "",
                    "startDate": "2022",
                    "endDate": "",
                    "achievements": ["Desarrolló una API"],
                }],
            },
        }
    )
    service = CvImportService(provider=provider, repository=repository)
    imported = await service.import_pdf(
        USER_ID,
        str(uuid4()),
        "Ana.pdf",
        pdf_with_text("Ana García. Desarrolladora en Acme desde 2022."),
    )
    previous_resume_ids = set(repository.resumes)
    proposal = await service.propose_edit(
        USER_ID,
        imported.source.id,
        EditRequest(baseResumeId=imported.resume.id, instruction="Agrega la experiencia en Acme"),
    )

    assert proposal.status == "ready"
    assert proposal.changedSections == ["experience"]
    assert set(repository.resumes) == previous_resume_ids


@pytest.mark.asyncio
async def test_edit_request_can_remove_an_experience_without_saving_the_proposal() -> None:
    original_cv = {
        **CV,
        "experience": [{
            "title": "Desarrolladora",
            "company": "Acme",
            "location": "",
            "startDate": "2022",
            "endDate": "",
            "achievements": ["Desarrolló una API"],
        }],
    }
    provider = FakeProvider(
        edit_result={"status": "ready", "proposedCv": CV},
        generated_cv=original_cv,
    )
    repository = MemoryRepository()
    service = CvImportService(provider=provider, repository=repository)
    imported = await service.import_pdf(
        USER_ID,
        str(uuid4()),
        "Ana.pdf",
        pdf_with_text("Ana García. Desarrolladora en Acme desde 2022."),
    )

    proposal = await service.propose_edit(
        USER_ID,
        imported.source.id,
        EditRequest(baseResumeId=imported.resume.id, instruction="Elimina la experiencia en Acme"),
    )

    assert proposal.status == "ready"
    assert proposal.changedSections == ["experience"]
    assert proposal.proposedCv.experience == []
    assert provider.edit_requests[0]["instruction"] == "Elimina la experiencia en Acme"
    assert len(repository.resumes) == 1


@pytest.mark.asyncio
async def test_missing_facts_returns_questions_without_persisting() -> None:
    repository = MemoryRepository()
    provider = FakeProvider(edit_result={
        "status": "needs_input",
        "questions": ["¿Cuándo comenzó esta experiencia?"],
    })
    service = CvImportService(provider=provider, repository=repository)
    imported = await service.import_pdf(USER_ID, str(uuid4()), "cv.pdf", pdf_with_text("Ana García"))
    previous_resume_ids = set(repository.resumes)

    proposal = await service.propose_edit(
        USER_ID,
        imported.source.id,
        EditRequest(baseResumeId=imported.resume.id, instruction="Agrega una experiencia"),
    )

    assert proposal.status == "needs_input"
    assert proposal.questions == ["¿Cuándo comenzó esta experiencia?"]
    assert set(repository.resumes) == previous_resume_ids


@pytest.mark.asyncio
async def test_follow_up_edit_uses_the_current_uncommitted_proposal() -> None:
    repository = MemoryRepository()
    provider = FakeProvider()
    service = CvImportService(provider=provider, repository=repository)
    imported = await service.import_pdf(USER_ID, str(uuid4()), "cv.pdf", pdf_with_text("Ana García"))
    current_draft = {**CV, "summary": "Resumen corregido pendiente de aprobación"}

    await service.propose_edit(
        USER_ID,
        imported.source.id,
        EditRequest(
            baseResumeId=imported.resume.id,
            instruction="Ajusta el resumen",
            currentCv=current_draft,
        ),
    )

    assert provider.edit_requests[0]["base"]["summary"] == current_draft["summary"]
    assert len(repository.resumes) == 1


def test_confirmed_version_is_linked_and_idempotent() -> None:
    repository = MemoryRepository()
    service = CvImportService(provider=FakeProvider(), repository=repository)
    imported = repository.create_import(
        USER_ID,
        str(uuid4()),
        str(uuid4()),
        "cv.pdf",
        pdf_with_text("Ana García"),
        1,
        CV,
    )
    request_id = str(uuid4())
    request = SaveVersionRequest(baseResumeId=imported["resume"]["id"], data=CV)

    first = service.save_version(USER_ID, imported["source"]["id"], request_id, request)
    repeated = service.save_version(USER_ID, imported["source"]["id"], request_id, request)

    assert first.id == repeated.id
    assert str(first.parentResumeId) == imported["resume"]["id"]
    assert imported["resume"]["data"] == CV
    assert len(repository.resumes) == 2


@pytest.mark.asyncio
async def test_other_users_cannot_edit_or_download_source() -> None:
    repository = MemoryRepository()
    service = CvImportService(provider=FakeProvider(), repository=repository)
    imported = await service.import_pdf(USER_ID, str(uuid4()), "cv.pdf", pdf_with_text("Ana García"))

    with pytest.raises(CvSourceNotFoundError):
        await service.propose_edit(
            OTHER_USER_ID,
            imported.source.id,
            EditRequest(baseResumeId=imported.resume.id, instruction="Edita el CV"),
        )
    assert repository.download_source(OTHER_USER_ID, imported.source.id) is None


@pytest.mark.asyncio
async def test_confirmed_version_and_source_deletion_remove_all_linked_data() -> None:
    repository = MemoryRepository()
    service = CvImportService(provider=FakeProvider(), repository=repository)
    imported = await service.import_pdf(USER_ID, str(uuid4()), "cv.pdf", pdf_with_text("Ana García"))
    saved = service.save_version(
        USER_ID,
        imported.source.id,
        str(uuid4()),
        request=type("SaveRequest", (), {
            "baseResumeId": imported.resume.id,
            "data": type("Data", (), {"model_dump": lambda self: CV})(),
        })(),
    )
    assert saved.parentResumeId == imported.resume.id
    assert len(repository.resumes) == 2

    assert service.delete_source(USER_ID, imported.source.id) is True
    assert str(imported.source.id) not in repository.files
    assert str(imported.source.id) not in repository.sources
    assert repository.resumes == {}
