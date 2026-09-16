from io import BytesIO

import pytest
from pypdf import PdfWriter
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
            NameObject("/Ff"): NumberObject(0),
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

    draft = fill_acroform(source.getvalue(), {"ClientName": "Jane Doe", "Unknown": "ignored"})

    assert inspect_acroform(draft)["ClientName"]["current_value"] == "Jane Doe"
    assert inspect_acroform(draft)["ClientName"]["options"] == []
