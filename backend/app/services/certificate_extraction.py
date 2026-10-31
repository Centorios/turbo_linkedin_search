from io import BytesIO
from urllib.parse import unquote

from pypdf import PdfReader
from pypdf.errors import PyPdfError


MAX_CERTIFICATE_BYTES = 5 * 1024 * 1024
MAX_CERTIFICATE_PAGES = 5
ALLOWED_MIME_TYPES = {"application/pdf", "image/jpeg", "image/png"}


class InvalidCertificateError(Exception):
    pass


def safe_filename(value: str) -> str:
    if len(value) > 3060:
        raise InvalidCertificateError("El nombre del archivo es demasiado largo")
    try:
        name = unquote(value, errors="strict").replace("\\", "/").rsplit("/", 1)[-1].strip()
    except UnicodeDecodeError as exc:
        raise InvalidCertificateError("El nombre del archivo no es válido") from exc
    if not name or name in {".", ".."} or len(name) > 255 or any(ord(char) < 32 for char in name):
        raise InvalidCertificateError("El nombre del archivo no es válido")
    return name


def extract_input(content: bytes, mime_type: str) -> tuple[str | None, bytes | None]:
    if not content:
        raise InvalidCertificateError("El archivo está vacío")
    if len(content) > MAX_CERTIFICATE_BYTES:
        raise InvalidCertificateError("El certificado supera el límite de 5 MiB")
    if mime_type not in ALLOWED_MIME_TYPES:
        raise InvalidCertificateError("Seleccioná un PDF, JPEG o PNG")
    if mime_type == "application/pdf":
        if not content.startswith(b"%PDF-"):
            raise InvalidCertificateError("El PDF no es válido")
        try:
            reader = PdfReader(BytesIO(content), strict=False)
            if reader.is_encrypted:
                raise InvalidCertificateError("No se admiten PDFs protegidos")
            if not 1 <= len(reader.pages) <= MAX_CERTIFICATE_PAGES:
                raise InvalidCertificateError("El PDF debe tener entre 1 y 5 páginas")
            text = " ".join((page.extract_text() or "").strip() for page in reader.pages).strip()
        except InvalidCertificateError:
            raise
        except (PyPdfError, OSError, ValueError, EOFError, RecursionError) as exc:
            raise InvalidCertificateError("No se pudo leer el PDF") from exc
        if not text:
            raise InvalidCertificateError("El PDF no contiene texto extraíble")
        return text, None
    if mime_type == "image/png":
        if not (content.startswith(b"\x89PNG\r\n\x1a\n") and content[12:16] == b"IHDR"):
            raise InvalidCertificateError("La imagen PNG no es válida")
    elif not (content.startswith(b"\xff\xd8\xff") and content.endswith(b"\xff\xd9")):
        raise InvalidCertificateError("La imagen JPEG no es válida")
    return None, content
