"""Conservative AcroForm inspection and draft population."""

from __future__ import annotations

from io import BytesIO
from typing import Any

from pypdf import PdfReader, PdfWriter

SUPPORTED_FIELD_TYPES = {"/Tx", "/Ch"}


class UnsupportedPdfFormError(ValueError):
    pass


def inspect_acroform(payload: bytes) -> dict[str, dict[str, Any]]:
    try:
        reader = PdfReader(BytesIO(payload), strict=False)
        root = reader.trailer["/Root"]
        acroform = root.get("/AcroForm")
        if acroform and acroform.get_object().get("/XFA"):
            raise UnsupportedPdfFormError(
                "XFA forms are not supported; complete this form in Adobe Acrobat Reader"
            )
        fields = reader.get_fields() or {}
    except UnsupportedPdfFormError:
        raise
    except Exception as exc:
        raise UnsupportedPdfFormError("The PDF form could not be inspected") from exc
    if not fields:
        raise UnsupportedPdfFormError(
            "No supported AcroForm fields were found in this PDF"
        )

    result: dict[str, dict[str, Any]] = {}
    for name, details in fields.items():
        if not isinstance(name, str) or not name.strip():
            continue
        field_type = str(details.get("/FT") or "")
        current_value = str(details.get("/V") or "")[:500]
        if field_type == "/Sig" and current_value:
            raise UnsupportedPdfFormError(
                "Signed PDFs cannot be used as AI form templates"
            )
        result[name] = {
            "type": field_type,
            "current_value": current_value,
            "options": [
                str(option)[:200]
                for option in (details.get("/Opt") or [])
            ][:100],
        }
    if not result:
        raise UnsupportedPdfFormError("No named fields were found in this PDF")
    return result


def fill_acroform(payload: bytes, values: dict[str, str]) -> bytes:
    fields = inspect_acroform(payload)
    safe_values = {
        name: str(value)[:2000]
        for name, value in values.items()
        if name in fields
        and fields[name]["type"] in SUPPORTED_FIELD_TYPES
        and value is not None
    }
    try:
        reader = PdfReader(BytesIO(payload), strict=False)
        writer = PdfWriter()
        writer.clone_document_from_reader(reader)
        for page in writer.pages:
            writer.update_page_form_field_values(
                page,
                safe_values,
                auto_regenerate=True,
            )
        output = BytesIO()
        writer.write(output)
        return output.getvalue()
    except Exception as exc:
        raise UnsupportedPdfFormError("The PDF form could not be populated safely") from exc
