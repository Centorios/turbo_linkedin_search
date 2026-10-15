from __future__ import annotations


def pdf_with_text(text: str, pages: int = 1) -> bytes:
    escaped = text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
    content = f"BT /F1 12 Tf 72 720 Td ({escaped}) Tj ET".encode("latin-1")
    objects: list[bytes] = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        f"<< /Type /Pages /Kids [{' '.join(f'{3 + 2 * i} 0 R' for i in range(pages))}] /Count {pages} >>".encode(),
    ]
    for index in range(pages):
        page_id = 3 + index
        content_id = 4 + 2 * index
        objects.append(
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 {3 + 2 * pages} 0 R >> >> /Contents {content_id} 0 R >>".encode()
        )
        page_content = content if index == 0 else b"BT /F1 12 Tf 72 720 Td (Continuation) Tj ET"
        objects.append(b"<< /Length " + str(len(page_content)).encode() + b" >>\nstream\n" + page_content + b"\nendstream")
    objects.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")

    data = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for index, obj in enumerate(objects, start=1):
        offsets.append(len(data))
        data.extend(f"{index} 0 obj\n".encode())
        data.extend(obj)
        data.extend(b"\nendobj\n")
    xref_offset = len(data)
    data.extend(f"xref\n0 {len(offsets)}\n".encode())
    data.extend(b"0000000000 65535 f \n")
    for offset in offsets[1:]:
        data.extend(f"{offset:010d} 00000 n \n".encode())
    data.extend(
        f"trailer\n<< /Size {len(offsets)} /Root 1 0 R >>\nstartxref\n{xref_offset}\n%%EOF\n".encode()
    )
    return bytes(data)


def empty_pdf() -> bytes:
    return pdf_with_text("")
