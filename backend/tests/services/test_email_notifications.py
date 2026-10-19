from __future__ import annotations

import base64
from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from app.services import email_notifications
from app.services.email_notifications import (
    UploadValidationError,
    decode_upload,
    extract_template_text,
    is_notification_enabled,
    lawyer_communication_settings,
    notify_case_client,
    org_notification_settings,
    validate_banner_image,
)
from tests.support import row

PNG_BYTES = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32


def _pdf_with_text(text: str) -> bytes:
    """Build a one-page PDF that draws `text`, with a correct cross-reference table."""
    stream = f"BT /F1 12 Tf 72 720 Td ({text}) Tj ET".encode()
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
        b"/Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
        b"<< /Length " + str(len(stream)).encode() + b" >>\nstream\n" + stream + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    out = b"%PDF-1.4\n"
    offsets = []
    for number, body in enumerate(objects, start=1):
        offsets.append(len(out))
        out += f"{number} 0 obj\n".encode() + body + b"\nendobj\n"
    xref_start = len(out)
    out += f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n".encode()
    for offset in offsets:
        out += f"{offset:010d} 00000 n \n".encode()
    out += f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref_start}\n%%EOF\n".encode()
    return out


# ── Settings ────────────────────────────────────────────────────────────────


def test_settings_default_to_enabled_with_banner_on_top():
    org_config = org_notification_settings({})
    lawyer_config = lawyer_communication_settings(None)

    assert org_config == {
        "enabled": {"case_status_update": True, "document_request": True, "reminder": True},
        "banner_position": "top",
        "invitation_enabled": True,
    }
    assert all(lawyer_config["enabled_templates"].values())
    assert lawyer_config["banner"] is None


def test_settings_ignore_invalid_stored_values():
    org_config = org_notification_settings(
        {"email_notifications": {"enabled": {"reminder": False}, "banner_position": "sideways"}}
    )

    assert org_config["enabled"]["reminder"] is False
    assert org_config["enabled"]["case_status_update"] is True
    assert org_config["banner_position"] == "top"


@pytest.mark.parametrize(
    ("org_on", "lawyer_on", "expected"),
    [(True, True, True), (False, True, False), (True, False, False), (False, False, False)],
)
def test_email_requires_both_admin_and_lawyer_opt_in(org_on, lawyer_on, expected):
    assert (
        is_notification_enabled(
            org_enabled={"reminder": org_on},
            lawyer_enabled={"reminder": lawyer_on},
            key="reminder",
        )
        is expected
    )


# ── Template file extraction ────────────────────────────────────────────────


def test_extract_text_from_utf8_file_keeps_placeholders_and_strips_bom():
    data = "﻿Hello {recipient_name},\r\nStatus: '{status}'.\r\n".encode("utf-8")

    assert extract_template_text("update.TXT", data) == "Hello {recipient_name},\nStatus: '{status}'."


def test_extract_text_from_pdf():
    text = extract_template_text("update.pdf", _pdf_with_text("Your case is now {status}"))

    assert "Your case is now {status}" in text


@pytest.mark.parametrize(
    ("file_name", "data", "message"),
    [
        ("template.docx", b"hello", "Only .txt and .pdf"),
        ("template.txt", b"", "empty"),
        ("template.txt", b"\xff\xfe\x00bad", "UTF-8"),
        ("template.txt", b"a" * (2 * 1024 * 1024 + 1), "2 MB"),
        ("template.txt", b"a" * 5001, "limited to 5000"),
        ("template.txt", b"   \n  ", "No text"),
        ("template.pdf", b"not a pdf", "could not be read"),
    ],
    ids=["extension", "empty", "not-utf8", "too-large", "too-long", "blank", "bad-pdf"],
)
def test_extract_text_rejects_bad_files(file_name, data, message):
    with pytest.raises(UploadValidationError, match=message):
        extract_template_text(file_name, data)


def test_decode_upload_rejects_invalid_base64():
    assert decode_upload(base64.b64encode(b"abc").decode()) == b"abc"
    with pytest.raises(UploadValidationError):
        decode_upload("not base64!!")


# ── Banner validation ───────────────────────────────────────────────────────


def test_validate_banner_accepts_supported_images():
    assert validate_banner_image("logo.png", PNG_BYTES) == "image/png"
    assert validate_banner_image("logo.JPEG", b"\xff\xd8\xff\xe0rest") == "image/jpeg"
    assert validate_banner_image("logo.webp", b"RIFF\x00\x00\x00\x00WEBPVP8 ") == "image/webp"


@pytest.mark.parametrize(
    ("file_name", "data", "message"),
    [
        ("logo.gif", b"GIF89a", ".png, .jpg"),
        ("logo.png", b"", "empty"),
        ("logo.png", PNG_BYTES + b"\x00" * (1024 * 1024), "1 MB"),
        ("logo.png", b"<svg></svg>", "does not match"),
    ],
    ids=["extension", "empty", "too-large", "renamed-file"],
)
def test_validate_banner_rejects_bad_files(file_name, data, message):
    with pytest.raises(UploadValidationError, match=message):
        validate_banner_image(file_name, data)


# ── notify_case_client ──────────────────────────────────────────────────────


def _notification_db(*, org_settings=None, lawyer_fields=None, client_prefs=None):
    """A fake session that answers the lookups notify_case_client makes, in order."""
    lawyer_id = uuid4()
    client_id = uuid4()
    case = row(
        id=uuid4(),
        organization_id=uuid4(),
        client_id=client_id,
        primary_lawyer_id=lawyer_id,
        case_number="C-2026-001",
        status="awaiting_client",
    )
    db = MagicMock()
    db.scalar.side_effect = [
        row(name="Acme Law", settings=org_settings or {}),
        row(first_name="Avery", last_name="Counsel"),
        row(custom_fields=lawyer_fields or {}),
        row(id=client_id, email="client@example.com", first_name="Casey", last_name="Client"),
        row(notification_prefs=client_prefs or {}),
    ]
    return db, case


@pytest.fixture
def fake_send(monkeypatch):
    send = MagicMock()
    monkeypatch.setattr(email_notifications.settings, "resend_api_key", "test-key")
    monkeypatch.setattr(email_notifications, "send_notification_email", send)
    return send


def test_notify_sends_with_custom_body_and_merged_values(fake_send):
    db, case = _notification_db(
        org_settings={
            "email_templates": {"case_status_update": "Hi {recipient_name}: {status}"},
            "email_notifications": {"banner_position": "bottom"},
        }
    )

    sent = notify_case_client(db, case=case, template_key="case_status_update", values={})

    assert sent is True
    kwargs = fake_send.call_args.kwargs
    assert kwargs["to_email"] == "client@example.com"
    assert kwargs["body_template"] == "Hi {recipient_name}: {status}"
    assert kwargs["use_default_layout"] is False
    assert kwargs["banner_position"] == "bottom"
    assert kwargs["banner_bytes"] is None
    values = kwargs["values"]
    assert values["client_name"] == values["recipient_name"] == "Casey Client"
    assert values["case_status"] == values["status"] == "Awaiting Client"
    assert values["lawyer_name"] == "Avery Counsel"
    assert values["document_name"] == ""
    assert values["lawyer_phone_number"] == ""
    assert values["portal_url"].endswith("/")
    # No support email set and no contact email on the row: both fall back to "".
    assert values["organization_support_email"] == values["organization_main_email"] == ""
    assert kwargs["subject_template"] == "Case {case_number}: status updated"


def test_notify_uses_custom_subject_and_phone_numbers(fake_send):
    db, case = _notification_db()
    db.scalar.side_effect = [
        row(
            name="Acme Law",
            contact_phone="613-555-0100",
            contact_email="hello@acme.law",
            settings={
                "email_templates": {"subjects": {"reminder": "Ping: {reminder_title}"}},
                "support_email": "help@acme.law",
            },
        ),
        row(first_name="Avery", last_name="Counsel", phone="613-555-0199"),
        row(custom_fields={}),
        row(id=case.client_id, email="client@example.com", first_name="Casey", last_name="Client"),
        row(notification_prefs={}),
    ]

    notify_case_client(db, case=case, template_key="reminder", values={"reminder_title": "Upload ID"})

    kwargs = fake_send.call_args.kwargs
    assert kwargs["subject_template"] == "Ping: {reminder_title}"
    assert kwargs["values"]["organization_phone_number"] == "613-555-0100"
    assert kwargs["values"]["lawyer_phone_number"] == "613-555-0199"
    assert kwargs["values"]["organization_main_email"] == "hello@acme.law"
    assert kwargs["values"]["organization_support_email"] == "help@acme.law"


def test_notify_uses_default_body_and_attaches_banner(fake_send, monkeypatch):
    monkeypatch.setattr(email_notifications, "get_object_bytes", lambda **kwargs: PNG_BYTES)
    db, case = _notification_db(
        lawyer_fields={
            "communication": {
                "banner": {"object_key": "k/email-banner.png", "file_name": "b.png", "content_type": "image/png"}
            }
        }
    )

    notify_case_client(db, case=case, template_key="case_status_update", values={})

    kwargs = fake_send.call_args.kwargs
    assert kwargs["body_template"] == "Your case status has been updated to '{case_status}'."
    assert kwargs["use_default_layout"] is True
    assert kwargs["banner_bytes"] == PNG_BYTES
    assert kwargs["banner_content_type"] == "image/png"


def test_notify_skips_when_admin_disabled_the_type(fake_send):
    db, case = _notification_db(org_settings={"email_notifications": {"enabled": {"reminder": False}}})

    assert notify_case_client(db, case=case, template_key="reminder", values={}) is False
    fake_send.assert_not_called()


def test_notify_skips_when_lawyer_opted_out(fake_send):
    db, case = _notification_db(
        lawyer_fields={"communication": {"enabled_templates": {"document_request": False}}}
    )

    assert notify_case_client(db, case=case, template_key="document_request", values={}) is False
    fake_send.assert_not_called()


def test_notify_skips_when_client_unsubscribed(fake_send):
    db, case = _notification_db(client_prefs={"email_documents": False})

    assert notify_case_client(db, case=case, template_key="document_request", values={}) is False
    fake_send.assert_not_called()


def test_notify_never_raises_when_sending_fails(fake_send):
    fake_send.side_effect = RuntimeError("Resend is down")
    db, case = _notification_db()

    assert notify_case_client(db, case=case, template_key="reminder", values={}) is False


def test_notify_does_nothing_without_email_configured(monkeypatch):
    monkeypatch.setattr(email_notifications.settings, "resend_api_key", None)
    db = MagicMock()

    assert notify_case_client(db, case=row(), template_key="reminder", values={}) is False
    db.scalar.assert_not_called()


# ── send_notification_email ─────────────────────────────────────────────────


def test_send_notification_email_escapes_values_and_places_banner(monkeypatch):
    from app.services import email

    sent = MagicMock()
    monkeypatch.setattr(email.settings, "resend_api_key", "test-key")
    monkeypatch.setattr(email.resend.Emails, "send", sent)

    email.send_notification_email(
        to_email="client@example.com",
        subject_template="Case {case_number}",
        body_template="Status: {status}\nThanks",
        values={"case_number": "C-1", "status": "<b>Closed</b>"},
        banner_bytes=PNG_BYTES,
        banner_content_type="image/png",
        banner_position="bottom",
    )

    params = sent.call_args.args[0]
    assert params["subject"] == "Case C-1"
    assert "Status: <b>Closed</b>\nThanks" in params["text"]
    assert "Status: &lt;b&gt;Closed&lt;/b&gt;<br>Thanks" in params["html"]
    # Bottom placement: the banner comes after the compliance footer.
    assert params["html"].index("cid:email-banner") > params["html"].index("Unsubscribe")
    assert params["attachments"][0]["content_id"] == "email-banner"
    assert base64.b64decode(params["attachments"][0]["content"]) == PNG_BYTES


def test_custom_notification_template_replaces_the_default_layout(monkeypatch):
    from app.services import email

    sent = MagicMock()
    monkeypatch.setattr(email.settings, "resend_api_key", "test-key")
    monkeypatch.setattr(email.resend.Emails, "send", sent)

    email.send_notification_email(
        to_email="client@example.com",
        subject_template="Case {case_number}: status updated",
        body_template="Subject: Update on {case_number}\nHi {client_name}, now {case_status}. {unknown}",
        values={"case_number": "C-1", "client_name": "Casey", "case_status": "Approved"},
        use_default_layout=False,
    )

    params = sent.call_args.args[0]
    assert params["subject"] == "Update on C-1"
    assert params["text"].startswith("Hi Casey, now Approved. {unknown}")
    assert "Subject:" not in params["html"]
    # No default card wrapper, but the unsubscribe footer is kept.
    assert "border-radius:8px" not in params["html"]
    assert "Unsubscribe" in params["html"]


def test_fill_placeholders_is_single_pass():
    from app.services.email import fill_placeholders

    assert fill_placeholders("{a} {b} {c}", {"a": "{b}", "b": "B"}) == "{b} B {c}"


def _send_invite(monkeypatch, body_template):
    from app.services import email

    sent = MagicMock()
    monkeypatch.setattr(email.settings, "resend_api_key", "test-key")
    monkeypatch.setattr(email.resend.Emails, "send", sent)
    email.send_invitation_email(
        to_email="new@example.com",
        recipient_name="Riley New",
        invitation_url="https://app.example/invite#token=abc",
        organization_name="VisaTest",
        body_template=body_template,
        inviter_name="Avery Admin",
        organization_main_email="hello@visatest.ca",
        organization_support_email="help@visatest.ca",
    )
    return sent.call_args.args[0]


def test_custom_invitation_template_replaces_the_default_layout(monkeypatch):
    params = _send_invite(
        monkeypatch,
        "Subject: Join {organization_name}\nHello {recipient_name},\n{inviter_name} invited you: {invitation_link}\n"
        "Expires in {expiration_time_hours} hours. Questions: {organization_support_email} or "
        "{organization_main_email} (old name: {support_email})",
    )

    assert params["subject"] == "Join VisaTest"
    assert "Hello Riley New," in params["text"]
    assert "Avery Admin invited you: https://app.example/invite#token=abc" in params["text"]
    assert "Questions: help@visatest.ca or hello@visatest.ca (old name: hello@visatest.ca)" in params["text"]
    assert '<a href="https://app.example/invite#token=abc"' in params["html"]
    # The default header bar and button are gone.
    assert "linear-gradient" not in params["html"]
    assert "Activate my account" not in params["html"]


def test_custom_invitation_template_without_link_gets_it_appended(monkeypatch):
    params = _send_invite(monkeypatch, "Hello {recipient_name}, welcome aboard.")

    assert "welcome aboard.\n\nhttps://app.example/invite#token=abc" in params["text"]
    assert '<a href="https://app.example/invite#token=abc"' in params["html"]


# ── Rich-text (HTML) templates ──────────────────────────────────────────────


def test_sanitize_template_html_keeps_formatting_and_drops_unsafe_markup():
    from app.services.email import sanitize_template_html

    dirty = (
        '<p style="text-align: center; position: fixed; color: rgb(37, 99, 235)" onclick="x()">'
        '<span style="font-family: Georgia, serif; background: url(evil.png)">Hi</span> '
        '<a href="javascript:alert(1)">bad</a> <a href="{invitation_url}">ok</a> '
        '<a href="https://example.com">site</a><img src="x" onerror="y()">'
        '<script>alert(1)</script><iframe src="https://evil"></iframe>'
        '<ul><li><b>one</b></li></ul><font color="#ff0000" face="Arial">red</font>'
    )

    clean = sanitize_template_html(dirty)

    assert clean == (
        '<p style="text-align: center; color: rgb(37, 99, 235)">'
        '<span style="font-family: Georgia, serif">Hi</span> '
        '<a>bad</a> <a href="{invitation_url}">ok</a> '
        '<a href="https://example.com">site</a>'
        '<ul><li><b>one</b></li></ul><font color="#ff0000" face="Arial">red</font></p>'
    )


def test_sanitize_template_html_leaves_plain_text_alone():
    from app.services.email import sanitize_template_html

    assert sanitize_template_html("Hi {client_name}\nThanks & bye") == "Hi {client_name}\nThanks & bye"


def test_html_notification_template_is_filled_escaped_and_has_text_version(monkeypatch):
    from app.services import email

    sent = MagicMock()
    monkeypatch.setattr(email.settings, "resend_api_key", "test-key")
    monkeypatch.setattr(email.resend.Emails, "send", sent)

    email.send_notification_email(
        to_email="client@example.com",
        subject_template="Case {case_number}",
        body_template=(
            '<p>Subject: not a subject line</p><p>Hi <b>{client_name}</b>,</p>'
            '<ul><li>{document_name}</li></ul><p><a href="{portal_url}">Open portal</a></p>'
        ),
        values={
            "case_number": "C-1",
            "client_name": "<Casey>",
            "document_name": "- Passport\n- Photo",
            "portal_url": "https://app.example/",
        },
        use_default_layout=False,
    )

    params = sent.call_args.args[0]
    # HTML bodies keep "Subject:" text; the subject has its own field.
    assert params["subject"] == "Case C-1"
    assert "<p>Hi <b>&lt;Casey&gt;</b>,</p>" in params["html"]
    assert "- Passport<br>- Photo" in params["html"]
    assert '<a href="https://app.example/">Open portal</a>' in params["html"]
    assert params["text"].startswith(
        "Subject: not a subject line\nHi <Casey>,\n- - Passport\n- Photo\nOpen portal (https://app.example/)"
    )


def test_html_invitation_template_links_url_and_appends_missing_link(monkeypatch):
    params = _send_invite(monkeypatch, "<p>Welcome to <i>{organization_name}</i></p>")

    assert "<p>Welcome to <i><strong>VisaTest</strong></i></p>" in params["html"]
    assert '<p><a href="https://app.example/invite#token=abc"' in params["html"]
    assert "Welcome to VisaTest\nhttps://app.example/invite#token=abc" in params["text"]
