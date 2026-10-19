from __future__ import annotations

import base64
import html as html_lib
import logging
import re
from html.parser import HTMLParser

import resend

from app.core.config import settings
from app.services.email_compliance import (
    compliance_html_footer,
    compliance_plain_footer,
    unsubscribe_url,
)

logger = logging.getLogger(__name__)

# Placeholders an invitation template may use. {invitation_link} is an alias of {invitation_url},
# {lawyer_name} is the same as {inviter_name}, and templates saved before the rename may still
# use {support_email} (same as {organization_main_email}).
INVITATION_VARIABLES = [
    "{recipient_name}", "{lawyer_name}", "{inviter_name}", "{organization_name}",
    "{organization_phone_number}", "{organization_main_email}", "{organization_support_email}",
    "{license_number}", "{invitation_url}", "{expiration_time_hours}", "{portal_url}",
]

DEFAULT_INVITATION_SUBJECT = "Invitation to join {organization_name} on VisaTrack"

# The default invitation email body.
DEFAULT_INVITATION_TEMPLATE = (
    "Hi {recipient_name},\n\n"
    "You have been invited by {lawyer_name} to join {organization_name} on VisaTrack, "
    "a secure legal workflow platform.\n\n"
    "To activate your account and set your password, please click the link below:\n"
    "{invitation_url}\n\n"
    "This link is secure and will expire in 72 hours. If you were not expecting this invitation, "
    "please disregard this email or contact us immediately.\n\n"
    "---\n\n"
    "IMPORTANT CONFIDENTIALITY & LEGAL NOTICE:\n"
    "This email and any attachments are intended solely for the confidential use of the intended "
    "recipient. VisaTrack is a software platform provider and does not provide legal representation "
    "or immigration advice. Legal services are provided directly by {organization_name}.\n\n"
    "{organization_name}\n"
    "Contact: {organization_main_email}\n"
    "RCIC / Law Society License #: {license_number}\n\n"
    "VisaTrack Technologies Inc. | support@visatrack.ca"
)

# Placeholders every case email may use. {redacted_case_number} hides most of the case number
# so it is safe in a subject line ({case_number_masked} is an alias). Older templates may still
# use {recipient_name} (same as {client_name}) and {status} (same as {case_status}).
CASE_EMAIL_VARIABLES = [
    "{client_name}", "{client_given_name}", "{case_number}", "{redacted_case_number}",
    "{case_status}", "{lawyer_name}", "{lawyer_phone_number}", "{document_name}",
    "{organization_name}", "{organization_phone_number}", "{organization_main_email}",
    "{organization_support_email}", "{license_number}", "{portal_url}",
]

# The notice and firm contact block shared by the default case emails.
_CASE_EMAIL_FOOTER = (
    "---\n\n"
    "CONFIDENTIALITY & PRIVACY NOTICE:\n"
    "This email contains confidential information intended solely for the recipient. If you "
    "received this email in error, please notify the sender immediately and delete it. VisaTrack "
    "provides secure portal infrastructure for legal professionals and does not provide legal "
    "advice or representation.\n\n"
    "{organization_name}\n"
    "Contact: {organization_phone_number} | {organization_main_email}\n\n"
    "VisaTrack Technologies Inc. | visatrack.support@gmail.com"
)

# Notification emails sent to clients about their case. Each entry holds the
# default body (used until an admin saves a custom one), the subject line, and
# the placeholders the body may use. The keys are also the names stored in
# Organization.settings["email_templates"] and in the toggle settings.
DEFAULT_NOTIFICATION_TEMPLATES: dict[str, dict] = {
    "case_status_update": {
        "label": "Case status update",
        "description": "Sent to clients when their case status changes.",
        "subject": "Update regarding your immigration matter - Case ref: {redacted_case_number}",
        "body": (
            "Hi {client_name},\n\n"
            "An update has been posted to your file by {organization_name}.\n\n"
            "For security and privacy reasons, full case details and official documents are not "
            "included in this email. You can view the latest status and updates securely by logging "
            "into your account:\n\n"
            "{portal_url}\n\n"
            "If you have questions about this update or need assistance accessing your account, "
            "please reach out to your legal representative directly using the contact details below.\n\n"
            + _CASE_EMAIL_FOOTER
        ),
        "variables": CASE_EMAIL_VARIABLES,
    },
    "document_request": {
        "label": "Document request",
        "description": "Sent to clients when documents are requested on their case.",
        "subject": "Action required: Document request for your matter (Ref: {redacted_case_number})",
        "body": (
            "Hi {client_given_name},\n\n"
            "{organization_name} has requested supporting documentation for your immigration file "
            "(Reference: {redacted_case_number}).\n\n"
            "To protect the privacy and security of your personal information, please do not send "
            "documents or personal records by email. Instead, please log in to your secure client "
            "portal to view the requested items and upload them directly:\n\n"
            "{portal_url}\n\n"
            "If you have questions regarding the requested documents or need assistance with "
            "uploading, please contact your legal representative directly using the information below.\n\n"
            + _CASE_EMAIL_FOOTER
        ),
        "variables": CASE_EMAIL_VARIABLES,
    },
    "reminder": {
        "label": "Reminder",
        "description": "Sent to clients when a reminder with email notification is posted on their case.",
        "subject": "Reminder regarding your matter (Ref: {redacted_case_number})",
        "body": (
            "Hi {client_given_name},\n\n"
            "This is a reminder from {organization_name} regarding your immigration file "
            "(Reference: {redacted_case_number}).\n\n"
            "{reminder_title}\n\n"
            "To view the complete details of this reminder or take action, please log in to your "
            "secure client portal:\n\n"
            "{portal_url}\n\n"
            "For your privacy and security, please do not reply to this email with sensitive personal "
            "information or attachments. If you have questions, please reach out to your legal "
            "representative directly using the contact details below.\n\n"
            + _CASE_EMAIL_FOOTER
        ),
        "variables": [*CASE_EMAIL_VARIABLES, "{reminder_title}", "{reminder_body}"],
    },
}

# Where a lawyer's banner image goes in notification emails. Admins choose per organization.
BANNER_POSITIONS = ("top", "bottom")
DEFAULT_BANNER_POSITION = "top"

# Content ID that ties the inline banner attachment to the <img> tag in the HTML body.
_BANNER_CONTENT_ID = "email-banner"


class EmailNotConfiguredError(Exception):
    pass


_PLACEHOLDER = re.compile(r"\{(\w+)\}")
# Stands in for {invitation_url} in the default invitation so the HTML email can show a button there.
_INVITATION_BUTTON_MARKER = "[[invitation-button]]"
_SUBJECT_LINE = re.compile(r"^[ \t]*subject[ \t]*:[ \t]*(.+?)[ \t]*$", re.IGNORECASE | re.MULTILINE)


def portal_url() -> str:
    """The {portal_url} value: the app's landing page, where clients and staff sign in."""
    return settings.frontend_origin.split(",")[0].strip().rstrip("/") + "/"


def fill_placeholders(template: str, values: dict[str, str]) -> str:
    """Replace {name} placeholders in one pass. Unknown names and stray braces are left as
    written, and a value that itself contains braces is never substituted again."""
    return _PLACEHOLDER.sub(lambda match: values.get(match.group(1), match.group(0)), template)


def split_subject_line(template: str) -> tuple[str | None, str]:
    """Pull a "Subject: ..." line out of an uploaded template.

    Returns (subject, body without that line), or (None, template) if there is no such line.
    """
    match = _SUBJECT_LINE.search(template)
    if match is None:
        return None, template
    body = template[: match.start()] + template[match.end():]
    return match.group(1), body.strip("\n")


def _placeholder_html(
    name: str,
    value: str,
    *,
    link_names: tuple[str, ...],
    bold_names: tuple[str, ...],
    allow_links: bool = True,
) -> str:
    """One filled placeholder as HTML: escaped, and linked or bolded if its name is listed."""
    escaped = html_lib.escape(value)
    if allow_links and name in link_names:
        return f'<a href="{escaped}" style="color:#2563eb;">{escaped}</a>'
    if name in bold_names:
        return f"<strong>{escaped}</strong>"
    return escaped


def _custom_body_html(
    template: str,
    values: dict[str, str],
    *,
    link_names: tuple[str, ...] = (),
    bold_names: tuple[str, ...] = (),
) -> str:
    """HTML for a plain-text template: escaped, placeholders filled, line breaks kept.

    Values named in link_names become clickable links; values in bold_names are bolded.
    """
    def replacement(match: re.Match) -> str:
        name = match.group(1)
        if name not in values:
            return match.group(0)
        return _placeholder_html(name, values[name], link_names=link_names, bold_names=bold_names)

    return _PLACEHOLDER.sub(replacement, html_lib.escape(template)).replace("\n", "<br>")


# ── Rich-text (HTML) templates ───────────────────────────────────────────────
# The admin settings editor saves templates as HTML. Only the tags, attributes and CSS
# properties below are kept; everything else (scripts, event handlers, images, unknown
# styles) is dropped, both when a template is saved and again when it is sent.

_ALLOWED_TAGS = {
    "p", "div", "br", "span", "strong", "b", "em", "i", "u", "s", "a",
    "ul", "ol", "li", "font", "blockquote", "h1", "h2", "h3",
}
_VOID_TAGS = {"br"}
# Tags whose text content is dropped along with the tag itself.
_DROPPED_CONTENT_TAGS = {"script", "style", "head", "title", "template"}
_BLOCK_TAGS = {"p", "div", "li", "blockquote", "h1", "h2", "h3"}
_ALLOWED_STYLES = {
    "color", "background-color", "font-family", "font-size", "font-weight",
    "font-style", "text-decoration", "text-decoration-line", "text-align",
}
_FONT_ATTRIBUTES = {"color", "face", "size"}
# rgb()/rgba() is the only CSS function allowed; it is what browsers write for picked colors.
_CSS_COLOR_FUNCTION = re.compile(r"rgba?\([\d\s.,%]+\)", re.IGNORECASE)
_SAFE_CSS_VALUE = re.compile(r"[\w\s#,.%'\"-]+")
_SAFE_LINK = re.compile(r"^(https?://|mailto:)", re.IGNORECASE)
_LINK_PLACEHOLDER = re.compile(r"^\{\w+\}$")
_HTML_TAG = re.compile(r"</?[a-zA-Z][^>]*>")


def is_html_template(template: str) -> bool:
    """True for a template saved by the rich-text editor; False for older plain-text ones."""
    return bool(_HTML_TAG.search(template))


def _is_safe_css_value(value: str) -> bool:
    return bool(_SAFE_CSS_VALUE.fullmatch(_CSS_COLOR_FUNCTION.sub("0", value)))


def _clean_style(style: str) -> str:
    """Keep only allowed CSS properties whose values have no url(), expression() or similar."""
    rules = []
    for declaration in style.split(";"):
        prop, _, value = declaration.partition(":")
        prop = prop.strip().lower()
        value = value.strip()
        if prop in _ALLOWED_STYLES and _is_safe_css_value(value):
            rules.append(f"{prop}: {value}")
    return "; ".join(rules)


class _TemplateHtmlRenderer(HTMLParser):
    """Rebuilds template HTML from an allowlist of tags, attributes and styles.

    With values given, {placeholders} are filled as well (escaped, like plain-text templates).
    Without values, the placeholders are kept, which is how templates are cleaned before saving.
    The output is always balanced: unclosed tags are closed at the end.
    """

    def __init__(
        self,
        values: dict[str, str] | None = None,
        *,
        link_names: tuple[str, ...] = (),
        bold_names: tuple[str, ...] = (),
    ) -> None:
        super().__init__(convert_charrefs=True)
        self.values = values
        self.link_names = link_names
        self.bold_names = bold_names
        self.parts: list[str] = []
        self.open_tags: list[str] = []
        self.dropped_depth = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in _DROPPED_CONTENT_TAGS:
            self.dropped_depth += 1
            return
        if tag not in _ALLOWED_TAGS or self.dropped_depth:
            return
        self.parts.append(f"<{tag}{self._clean_attributes(tag, attrs)}>")
        if tag not in _VOID_TAGS:
            self.open_tags.append(tag)

    def handle_endtag(self, tag: str) -> None:
        if tag in _DROPPED_CONTENT_TAGS:
            self.dropped_depth = max(0, self.dropped_depth - 1)
            return
        if tag not in self.open_tags:
            return
        # Close anything opened inside this tag too, so the output stays well formed.
        while self.open_tags:
            open_tag = self.open_tags.pop()
            self.parts.append(f"</{open_tag}>")
            if open_tag == tag:
                break

    def handle_data(self, data: str) -> None:
        if self.dropped_depth:
            return
        if self.values is None:
            self.parts.append(html_lib.escape(data, quote=False))
            return
        values = self.values
        inside_link = "a" in self.open_tags

        def replacement(match: re.Match) -> str:
            name = match.group(1)
            if name not in values:
                return match.group(0)
            filled = _placeholder_html(
                name,
                values[name],
                link_names=self.link_names,
                bold_names=self.bold_names,
                allow_links=not inside_link,
            )
            return filled.replace("\n", "<br>")

        # Escape the text between placeholders; braces and names are unchanged by escaping.
        self.parts.append(_PLACEHOLDER.sub(replacement, html_lib.escape(data, quote=False)))

    def _clean_attributes(self, tag: str, attrs: list[tuple[str, str | None]]) -> str:
        kept: list[tuple[str, str]] = []
        for name, raw_value in attrs:
            value = (raw_value or "").strip()
            if tag == "a" and name == "href":
                href = self._link(value)
                if href:
                    kept.append(("href", href))
            elif name == "style":
                style = _clean_style(value)
                if style:
                    kept.append(("style", style))
            elif tag == "font" and name in _FONT_ATTRIBUTES and _is_safe_css_value(value):
                kept.append((name, value))
        return "".join(f' {name}="{html_lib.escape(value)}"' for name, value in kept)

    def _link(self, href: str) -> str | None:
        """The href to keep, or None. A lone {placeholder} is allowed and filled when sending."""
        if self.values is None:
            return href if _SAFE_LINK.match(href) or _LINK_PLACEHOLDER.match(href) else None
        filled = fill_placeholders(href, self.values)
        return filled if _SAFE_LINK.match(filled) else None

    def result(self) -> str:
        self.close()
        closing = "".join(f"</{tag}>" for tag in reversed(self.open_tags))
        self.open_tags = []
        return "".join(self.parts) + closing


class _HtmlToText(HTMLParser):
    """Plain-text version of a template, for the text part of the email."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self.link_stack: list[str] = []
        self.dropped_depth = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in _DROPPED_CONTENT_TAGS:
            self.dropped_depth += 1
        elif tag == "br":
            self.parts.append("\n")
        elif tag == "li":
            self.parts.append("- ")
        elif tag == "a":
            self.link_stack.append(dict(attrs).get("href") or "")

    def handle_endtag(self, tag: str) -> None:
        if tag in _DROPPED_CONTENT_TAGS:
            self.dropped_depth = max(0, self.dropped_depth - 1)
        elif tag in _BLOCK_TAGS:
            self.parts.append("\n")
        elif tag == "a" and self.link_stack:
            # Keep the address visible, since plain text cannot hold a link.
            href = self.link_stack.pop()
            if href:
                self.parts.append(f" ({href})")

    def handle_data(self, data: str) -> None:
        if not self.dropped_depth:
            self.parts.append(data)

    def result(self) -> str:
        self.close()
        text = "".join(self.parts).replace("\xa0", " ")
        lines = [line.rstrip() for line in text.split("\n")]
        return re.sub(r"\n{3,}", "\n\n", "\n".join(lines)).strip()


def sanitize_template_html(template: str) -> str:
    """Clean a template before saving it. Plain-text templates are returned unchanged."""
    if not is_html_template(template):
        return template
    renderer = _TemplateHtmlRenderer()
    renderer.feed(template)
    return renderer.result()


def html_template_to_text(template: str) -> str:
    """The text of an HTML template, with its {placeholders} kept."""
    converter = _HtmlToText()
    converter.feed(template)
    return converter.result()


def render_template_body(
    template: str,
    values: dict[str, str],
    *,
    link_names: tuple[str, ...] = (),
    bold_names: tuple[str, ...] = (),
) -> tuple[str, str]:
    """Return (html, plain text) for a custom template, which may be HTML or plain text."""
    if is_html_template(template):
        renderer = _TemplateHtmlRenderer(values, link_names=link_names, bold_names=bold_names)
        renderer.feed(template)
        return renderer.result(), fill_placeholders(html_template_to_text(template), values)
    html = _custom_body_html(template, values, link_names=link_names, bold_names=bold_names)
    return html, fill_placeholders(template, values)


def _standalone_email_html(content_html: str, to_email: str, *, top: str = "", bottom: str = "") -> str:
    """A minimal page for custom templates: the admin's text only, with no header, card, or
    button around it. The unsubscribe footer is always kept (required for compliance)."""
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:16px;font-family:Arial,Helvetica,sans-serif;color:#111827;line-height:1.6;">
  {top}
  <div style="max-width:600px;">{content_html}</div>
  {compliance_html_footer(to_email)}
  {bottom}
</body>
</html>"""


def _darken_hex(hex_color: str, factor: float = 0.8) -> str:
    """Return a slightly darker shade of a hex color for gradient use."""
    hex_color = hex_color.lstrip("#")
    if len(hex_color) == 3:
        hex_color = "".join(c * 2 for c in hex_color)
    try:
        r = int(int(hex_color[0:2], 16) * factor)
        g = int(int(hex_color[2:4], 16) * factor)
        b = int(int(hex_color[4:6], 16) * factor)
        return f"#{r:02x}{g:02x}{b:02x}"
    except (ValueError, IndexError):
        return f"#{hex_color}"


def send_invitation_email(
    to_email: str,
    recipient_name: str,
    invitation_url: str,
    organization_name: str = "VisaTrack",
    body_template: str | None = None,
    button_color: str = "#dc2626",
    button_label: str = "Activate my account",
    subject_template: str | None = None,
    bold_org_name: bool = True,
    inviter_name: str = "",
    organization_main_email: str = "",
    organization_support_email: str = "",
    organization_phone_number: str = "",
    license_number: str = "",
) -> None:
    """Send an invitation email via Resend.

    If body_template is provided it replaces the whole default email (header, button and
    layout), not just the message text. See INVITATION_VARIABLES for its placeholders. A
    custom template without {invitation_url} gets the link appended so the invite always
    works, and a "Subject: ..." line in a plain-text one is used as the subject. A template
    saved by the rich-text editor is HTML and is sanitized before sending.

    button_color and button_label apply only to the default template; subject_template
    and bold_org_name apply to both.

    Raises EmailNotConfiguredError if RESEND_API_KEY is not set.
    Raises resend.exceptions.ResendError on API/delivery failure.
    """
    if not settings.resend_api_key:
        raise EmailNotConfiguredError(
            "Resend is not configured. Set RESEND_API_KEY in your environment."
        )

    resend.api_key = settings.resend_api_key

    from_address = f"{settings.resend_from_name} <{settings.resend_from_email}>"

    main_email = organization_main_email or settings.resend_from_email
    values = {
        "recipient_name": recipient_name,
        "organization_name": organization_name,
        "invitation_url": invitation_url,
        "invitation_link": invitation_url,
        "inviter_name": inviter_name or organization_name,
        "lawyer_name": inviter_name or organization_name,
        "license_number": license_number,
        "expiration_time_hours": str(settings.invitation_expiry_hours),
        "organization_main_email": main_email,
        "organization_support_email": organization_support_email or main_email,
        # Older templates may still use {support_email}.
        "support_email": main_email,
        "organization_phone_number": organization_phone_number,
        "portal_url": portal_url(),
    }
    subject = fill_placeholders(subject_template or DEFAULT_INVITATION_SUBJECT, values)

    if body_template:
        is_html = is_html_template(body_template)
        if "{invitation_url}" not in body_template and "{invitation_link}" not in body_template:
            logger.warning("Custom invitation template has no {invitation_url}; appending the link.")
            link_line = "<p>{invitation_url}</p>" if is_html else "\n\n{invitation_url}"
            body_template = body_template.rstrip() + link_line
        if not is_html:
            file_subject, body_template = split_subject_line(body_template)
            if file_subject:
                subject = fill_placeholders(file_subject, values)

        content_html, content_text = render_template_body(
            body_template,
            values,
            link_names=("invitation_url", "invitation_link"),
            bold_names=("organization_name",) if bold_org_name else (),
        )
        resend.Emails.send({
            "from": from_address,
            "to": [to_email],
            "subject": subject,
            "text": content_text + compliance_plain_footer(to_email),
            "html": _standalone_email_html(content_html, to_email),
            "click_tracking": False,
            "headers": {"List-Unsubscribe": f"<{unsubscribe_url(to_email)}>"},
        })
        logger.info("Invitation email (custom template) sent to %s via Resend", to_email)
        return

    plain = fill_placeholders(DEFAULT_INVITATION_TEMPLATE, values) + compliance_plain_footer(to_email)

    # Pre-escape values shared across both HTML paths.
    darker = _darken_hex(button_color)
    escaped_url = html_lib.escape(invitation_url)
    escaped_org = html_lib.escape(organization_name)
    escaped_label = html_lib.escape(button_label)

    # CTA button — inline-block anchor, widely supported.
    button_html = (
        f'<p style="margin:24px 0;text-align:center;">'
        f'<a href="{escaped_url}"'
        f' style="background:{button_color};color:#ffffff;padding:12px 28px;'
        f'border-radius:6px;text-decoration:none;font-weight:600;font-size:15px;display:inline-block;">'
        f'{escaped_label}</a>'
        f'</p>'
    )

    # Banner — a full-width table row so the gradient stretches edge-to-edge inside the card.
    banner_html = (
        f'<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">'
        f'<tr><td style="background:linear-gradient(135deg,{button_color},{darker});'
        f'padding:24px 28px;">'
        f'<span style="color:#ffffff;font-size:20px;font-weight:600;font-family:Arial,Helvetica,sans-serif;">'
        f'{escaped_org}</span>'
        f'</td></tr></table>'
    )

    # The default text, with the invitation link shown as the button.
    default_html, _ = render_template_body(
        DEFAULT_INVITATION_TEMPLATE.replace("{invitation_url}", _INVITATION_BUTTON_MARKER),
        values,
        bold_names=("organization_name",) if bold_org_name else (),
    )
    body_html = (
        '<div style="color:#374151;line-height:1.65;">'
        + default_html.replace(_INVITATION_BUTTON_MARKER, button_html)
        + "</div>"
    )

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:32px 16px;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;border:1px solid #e5e7eb;">
    {banner_html}
    <div style="padding:28px 28px 32px;">
      {body_html}
      {compliance_html_footer(to_email)}
    </div>
  </div>
</body>
</html>"""

    resend.Emails.send({
        "from": from_address,
        "to": [to_email],
        "subject": subject,
        "text": plain,
        "html": html,
        "click_tracking": False,
        "headers": {"List-Unsubscribe": f"<{unsubscribe_url(to_email)}>"},
    })

    logger.info("Invitation email sent to %s via Resend", to_email)


def send_notification_email(
    *,
    to_email: str,
    subject_template: str,
    body_template: str,
    values: dict[str, str],
    banner_bytes: bytes | None = None,
    banner_content_type: str | None = None,
    banner_position: str = DEFAULT_BANNER_POSITION,
    use_default_layout: bool = True,
) -> None:
    """Send a case notification email (status update, document request, reminder) via Resend.

    The body is plain text or (from the rich-text editor) HTML with {placeholders}; values
    are substituted and HTML-escaped, and HTML bodies are sanitized.
    If banner_bytes is given, the image is attached inline and shown at the top or bottom.
    With use_default_layout=False (an admin's custom template) the body is sent on its own,
    without the default card layout, and a "Subject: ..." line in a plain-text body becomes
    the subject.

    Raises EmailNotConfiguredError if RESEND_API_KEY is not set.
    Raises resend.exceptions.ResendError on API/delivery failure.
    """
    if not settings.resend_api_key:
        raise EmailNotConfiguredError(
            "Resend is not configured. Set RESEND_API_KEY in your environment."
        )

    resend.api_key = settings.resend_api_key

    from_address = f"{settings.resend_from_name} <{settings.resend_from_email}>"
    if not use_default_layout and not is_html_template(body_template):
        file_subject, body_template = split_subject_line(body_template)
        subject_template = file_subject or subject_template
    subject = fill_placeholders(subject_template, values)
    body_html, body_text = render_template_body(body_template, values)
    plain = body_text + compliance_plain_footer(to_email)

    banner_html = ""
    if banner_bytes:
        banner_html = (
            f'<img src="cid:{_BANNER_CONTENT_ID}" alt="" '
            'style="display:block;width:100%;max-width:600px;height:auto;border:0;">'
        )
    top_banner = banner_html if banner_position == "top" else ""
    bottom_banner = banner_html if banner_position == "bottom" else ""

    if not use_default_layout:
        html = _standalone_email_html(body_html, to_email, top=top_banner, bottom=bottom_banner)
    else:
        html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:32px 16px;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;border:1px solid #e5e7eb;overflow:hidden;">
    {top_banner}
    <div style="padding:28px 28px 32px;">
      <div style="color:#374151;line-height:1.65;margin:0;">{body_html}</div>
      {compliance_html_footer(to_email)}
    </div>
    {bottom_banner}
  </div>
</body>
</html>"""

    send_params: dict = {
        "from": from_address,
        "to": [to_email],
        "subject": subject,
        "text": plain,
        "html": html,
        "click_tracking": False,
        "headers": {"List-Unsubscribe": f"<{unsubscribe_url(to_email)}>"},
    }
    if banner_bytes:
        send_params["attachments"] = [
            {
                "filename": "banner",
                "content": base64.b64encode(banner_bytes).decode("ascii"),
                "content_type": banner_content_type or "image/png",
                "content_id": _BANNER_CONTENT_ID,
            }
        ]

    resend.Emails.send(send_params)

    logger.info("Notification email '%s' sent to %s via Resend", subject, to_email)


def send_bug_report_email(
    *,
    to_email: str,
    report_title: str,
    report_details: str,
    path: str,
    origin: str | None,
    reported_at_utc: str,
    screenshot_captured_at: str | None,
    screenshot_filename: str | None,
    screenshot_content_type: str | None,
    screenshot_base64_content: str | None,
    delivery_channel: str,
) -> None:
    """Send a bug report email via Resend."""
    if not settings.resend_api_key:
        raise EmailNotConfiguredError(
            "Resend is not configured. Set RESEND_API_KEY in your environment."
        )

    resend.api_key = settings.resend_api_key

    from_address = f"{settings.resend_from_name} <{settings.resend_from_email}>"
    subject = f"[Bug Report] {report_title.strip()}"

    plain_text = (
        "Bug report submitted from VisaTrack\n\n"
        f"Title: {report_title}\n"
        f"Details:\n{report_details}\n\n"
        "Context\n"
        f"- Path: {path}\n"
        f"- Origin: {origin or 'unknown'}\n"
        f"- Reported at (UTC): {reported_at_utc}\n"
        f"- Channel selected: {delivery_channel}\n"
        f"- Screenshot captured at (UTC): {screenshot_captured_at or 'not provided'}\n"
        f"- Screenshot attached: {'yes' if screenshot_base64_content else 'no'}\n"
        + compliance_plain_footer(to_email)
    )

    escaped_title = html_lib.escape(report_title)
    escaped_details = html_lib.escape(report_details).replace("\n", "<br>")
    escaped_path = html_lib.escape(path)
    escaped_origin = html_lib.escape(origin or "unknown")
    escaped_reported_at = html_lib.escape(reported_at_utc)
    escaped_channel = html_lib.escape(delivery_channel)
    escaped_screenshot = html_lib.escape(screenshot_captured_at or "not provided")
    escaped_screenshot_attached = "yes" if screenshot_base64_content else "no"

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:24px;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:700px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
    <div style="background:#111827;color:#ffffff;padding:16px 20px;font-size:18px;font-weight:600;">
      VisaTrack Bug Report
    </div>
    <div style="padding:20px;">
      <h2 style="margin:0 0 12px;color:#111827;font-size:20px;">{escaped_title}</h2>
      <p style="margin:0 0 16px;color:#374151;line-height:1.65;">{escaped_details}</p>

      <h3 style="margin:20px 0 8px;color:#111827;font-size:16px;">Context</h3>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        <tr><td style="padding:6px 0;color:#374151;">Path</td><td style="padding:6px 0;color:#111827;">{escaped_path}</td></tr>
        <tr><td style="padding:6px 0;color:#374151;">Origin</td><td style="padding:6px 0;color:#111827;">{escaped_origin}</td></tr>
        <tr><td style="padding:6px 0;color:#374151;">Reported at (UTC)</td><td style="padding:6px 0;color:#111827;">{escaped_reported_at}</td></tr>
        <tr><td style="padding:6px 0;color:#374151;">Channel selected</td><td style="padding:6px 0;color:#111827;">{escaped_channel}</td></tr>
        <tr><td style="padding:6px 0;color:#374151;">Screenshot captured</td><td style="padding:6px 0;color:#111827;">{escaped_screenshot}</td></tr>
        <tr><td style="padding:6px 0;color:#374151;">Screenshot attached</td><td style="padding:6px 0;color:#111827;">{escaped_screenshot_attached}</td></tr>
      </table>
      {compliance_html_footer(to_email)}
    </div>
  </div>
</body>
</html>"""

    send_params: dict = {
        "from": from_address,
        "to": [to_email],
        "subject": subject,
        "text": plain_text,
        "html": html,
        "click_tracking": False,
        "headers": {"List-Unsubscribe": f"<{unsubscribe_url(to_email)}>"},
    }

    if screenshot_base64_content and screenshot_filename:
        send_params["attachments"] = [
            {
                "filename": screenshot_filename,
                "content": screenshot_base64_content,
                "content_type": screenshot_content_type or "image/png",
            }
        ]

    resend.Emails.send(send_params)

    logger.info("Bug report email sent to %s via Resend", to_email)
