from io import BytesIO

import pytest
from pypdf import PdfReader, PdfWriter
from pypdf.generic import (
    ArrayObject,
    BooleanObject,
    DictionaryObject,
    NameObject,
    NumberObject,
    TextStringObject,
)

from app.services.ai_forms import (
    UnsupportedPdfFormError,
    _field_options,
    fill_acroform,
    inspect_acroform,
)


def test_fieldless_pdf_is_rejected_instead_of_claiming_it_was_filled():
    writer = PdfWriter()
    writer.add_blank_page(width=612, height=792)
    output = BytesIO()
    writer.write(output)

    with pytest.raises(UnsupportedPdfFormError, match="No supported AcroForm fields"):
        inspect_acroform(output.getvalue())


def test_named_acroform_field_is_filled_in_review_copy():
    writer = PdfWriter()
    page = writer.add_blank_page(width=612, height=792)
    field = DictionaryObject(
        {
            NameObject("/FT"): NameObject("/Tx"),
            NameObject("/T"): TextStringObject("ClientName"),
            NameObject("/V"): TextStringObject(""),
            NameObject("/Ff"): NumberObject(2),
            NameObject("/MaxLen"): NumberObject(100),
            NameObject("/Rect"): ArrayObject(
                [NumberObject(10), NumberObject(10), NumberObject(200), NumberObject(30)]
            ),
            NameObject("/Subtype"): NameObject("/Widget"),
            NameObject("/Type"): NameObject("/Annot"),
        }
    )
    field_reference = writer._add_object(field)
    page[NameObject("/Annots")] = ArrayObject([field_reference])
    writer._root_object[NameObject("/AcroForm")] = writer._add_object(
        DictionaryObject(
            {
                NameObject("/Fields"): ArrayObject([field_reference]),
                NameObject("/NeedAppearances"): BooleanObject(True),
            }
        )
    )
    source = BytesIO()
    writer.write(source)
    source_fields = inspect_acroform(source.getvalue())
    assert source_fields["ClientName"]["required"] is True
    assert source_fields["ClientName"]["max_length"] == 100

    draft = fill_acroform(source.getvalue(), {"ClientName": "Jane Doe", "Unknown": "ignored"})

    assert inspect_acroform(draft)["ClientName"]["current_value"] == "Jane Doe"
    assert inspect_acroform(draft)["ClientName"]["options"] == []
    assert inspect_acroform(draft)["ClientName"]["required"] is True
    assert inspect_acroform(draft)["ClientName"]["max_length"] == 100
    assert len(PdfReader(BytesIO(draft)).pages[0]["/Annots"]) == 2


def test_certified_pdf_is_rejected_before_modification():
    writer = PdfWriter()
    writer.add_blank_page(width=612, height=792)
    writer._root_object[NameObject("/Perms")] = DictionaryObject(
        {NameObject("/DocMDP"): DictionaryObject()}
    )
    output = BytesIO()
    writer.write(output)

    with pytest.raises(UnsupportedPdfFormError, match="signatures"):
        inspect_acroform(output.getvalue())


def test_xfa_pdf_is_rejected():
    writer = PdfWriter()
    writer.add_blank_page(width=612, height=792)
    writer._root_object[NameObject("/AcroForm")] = writer._add_object(
        DictionaryObject(
            {
                NameObject("/Fields"): ArrayObject(),
                NameObject("/XFA"): TextStringObject("xfa-payload"),
            }
        )
    )
    output = BytesIO()
    writer.write(output)

    with pytest.raises(UnsupportedPdfFormError, match="XFA forms"):
        inspect_acroform(output.getvalue())


def test_form_size_limit_is_enforced_before_parsing(monkeypatch):
    monkeypatch.setattr("app.services.ai_forms.MAX_FORM_BYTES", 4)

    with pytest.raises(UnsupportedPdfFormError, match="processing limit"):
        inspect_acroform(b"12345")


def test_form_page_limit_is_enforced(monkeypatch):
    writer = PdfWriter()
    writer.add_blank_page(width=612, height=792)
    output = BytesIO()
    writer.write(output)
    monkeypatch.setattr("app.services.ai_forms.MAX_FORM_PAGES", 0)

    with pytest.raises(UnsupportedPdfFormError, match="page processing limit"):
        inspect_acroform(output.getvalue())


def test_choice_options_use_export_value_from_display_pairs():
    assert _field_options([["CA", "Canada"], "Other"]) == ["CA", "Other"]
