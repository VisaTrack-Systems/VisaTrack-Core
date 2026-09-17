"""Conservative AcroForm inspection and draft population."""

from __future__ import annotations

from io import BytesIO
from typing import Any

from pypdf import PdfReader, PdfWriter
from pypdf.annotations import FreeText
from pypdf.generic import NameObject, NumberObject

SUPPORTED_FIELD_TYPES = {"/Tx", "/Ch"}
MAX_FORM_BYTES = 15 * 1024 * 1024
MAX_FORM_PAGES = 100


class UnsupportedPdfFormError(ValueError):
    pass


def inspect_acroform(payload: bytes) -> dict[str, dict[str, Any]]:
    if len(payload) > MAX_FORM_BYTES:
        raise UnsupportedPdfFormError(
            f"PDF form exceeds the {MAX_FORM_BYTES // (1024 * 1024)} MB processing limit"
        )
    try:
        reader = PdfReader(BytesIO(payload), strict=False)
        if len(reader.pages) > MAX_FORM_PAGES:
            raise UnsupportedPdfFormError(
                f"PDF form exceeds the {MAX_FORM_PAGES}-page processing limit"
            )
        root = reader.trailer["/Root"]
        if root.get("/Perms"):
            raise UnsupportedPdfFormError(
                "PDFs with certification or usage-rights signatures cannot be modified"
            )
        acroform = root.get("/AcroForm")
        if acroform:
            resolved_acroform = acroform.get_object()
            if resolved_acroform.get("/XFA"):
                raise UnsupportedPdfFormError(
                    "XFA forms are not supported; complete this form in Adobe Acrobat Reader"
                )
            if int(resolved_acroform.get("/SigFlags") or 0):
                raise UnsupportedPdfFormError(
                    "PDFs containing signature controls cannot be modified safely"
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

    widget_fields = _widget_fields(reader)
    result: dict[str, dict[str, Any]] = {}
    for name, details in fields.items():
        if not isinstance(name, str) or not name.strip():
            continue
        widget = widget_fields.get(name) or details
        field_type = str(details.get("/FT") or widget.get("/FT") or "")
        current_value = str(details.get("/V") or widget.get("/V") or "")[:500]
        field_flags = _optional_positive_int(
            widget.get("/Ff", details.get("/Ff"))
        ) or 0
        if field_type == "/Sig" and current_value:
            raise UnsupportedPdfFormError(
                "Signed PDFs cannot be used as AI form templates"
            )
        result[name] = {
            "type": field_type,
            "current_value": current_value,
            "read_only": bool(field_flags & 1),
            "required": bool(field_flags & 2),
            "multi_select": bool(field_flags & (1 << 21)),
            "max_length": _optional_positive_int(
                widget.get("/MaxLen", details.get("/MaxLen"))
            ),
            "options": _field_options(widget.get("/Opt", details.get("/Opt"))),
        }
    if not result:
        raise UnsupportedPdfFormError("No named fields were found in this PDF")
    return result


def _widget_fields(reader: PdfReader) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for page in reader.pages:
        for reference in page.get("/Annots") or []:
            field = reference.get_object()
            while field.get("/Parent"):
                field = field["/Parent"].get_object()
            name = str(field.get("/T") or "")
            if name:
                result[name] = field
    return result


def _field_options(raw_options: Any) -> list[str]:
    options: list[str] = []
    for option in raw_options or []:
        if isinstance(option, (list, tuple)):
            if option:
                options.append(str(option[0])[:200])
        else:
            options.append(str(option)[:200])
    return options[:100]


def _optional_positive_int(value: Any) -> int | None:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return None
    return parsed if parsed > 0 else None


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
        for page_number, page in enumerate(writer.pages):
            writer.update_page_form_field_values(
                page,
                safe_values,
                auto_regenerate=True,
            )
            _restore_widget_constraints(page, fields)
            page_width = float(page.mediabox.width)
            page_height = float(page.mediabox.height)
            writer.add_annotation(
                page_number,
                FreeText(
                    text="AI-GENERATED REVIEW DRAFT — NOT VALIDATED, SIGNED, OR SUBMITTED",
                    rect=(20, max(20, page_height - 36), max(40, page_width - 20), page_height - 12),
                    font_size="9pt",
                    font_color="7f1d1d",
                    border_color="f59e0b",
                    background_color="fef3c7",
                ),
            )
        output = BytesIO()
        writer.write(output)
        return output.getvalue()
    except Exception as exc:
        raise UnsupportedPdfFormError("The PDF form could not be populated safely") from exc


def _restore_widget_constraints(page: Any, fields: dict[str, dict[str, Any]]) -> None:
    for reference in page.get("/Annots") or []:
        field = reference.get_object()
        while field.get("/Parent"):
            field = field["/Parent"].get_object()
        name = str(field.get("/T") or "")
        details = fields.get(name)
        if not details:
            continue
        max_length = details.get("max_length")
        if max_length:
            field[NameObject("/MaxLen")] = NumberObject(int(max_length))
