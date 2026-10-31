import pytest

from app.services.certificate_extraction import InvalidCertificateError, extract_input, safe_filename
from tests.cv_pdf_fixtures import pdf_with_text


def test_extracts_text_from_a_small_pdf_and_sanitizes_filename():
    text, image = extract_input(pdf_with_text("Certificado de idioma inglés"), "application/pdf")
    assert "Certificado" in text
    assert image is None
    assert safe_filename("folder%2Fcurso.pdf") == "curso.pdf"


@pytest.mark.parametrize("content,mime", [
    (b"not a pdf", "application/pdf"),
    (b"not a jpeg", "image/jpeg"),
    (b"not a png", "image/png"),
    (b"x", "text/plain"),
])
def test_rejects_wrong_binary_signature(content, mime):
    with pytest.raises(InvalidCertificateError):
        extract_input(content, mime)


def test_rejects_oversized_document_before_ia():
    with pytest.raises(InvalidCertificateError, match="5 MiB"):
        extract_input(b"%PDF-" + b"x" * (5 * 1024 * 1024), "application/pdf")
