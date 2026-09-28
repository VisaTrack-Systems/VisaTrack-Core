from app.services.email_compliance import (
    compliance_html_footer,
    compliance_plain_footer,
    unsubscribe_url,
    verify_unsubscribe_token,
)


def test_email_footer_includes_address_and_unsubscribe_link():
    footer = compliance_plain_footer("Person@Example.com")
    assert "VisaTrack Systems" in footer
    assert "Ottawa, Ontario, Canada" in footer
    assert "Unsubscribe:" in footer
    assert "/unsubscribe?email=person%40example.com&token=" in footer

    html = compliance_html_footer("person@example.com")
    assert "Unsubscribe" in html
    assert "Ottawa, Ontario, Canada" in html


def test_unsubscribe_token_matches_the_link():
    url = unsubscribe_url("person@example.com")
    token = url.split("token=", 1)[1]
    assert verify_unsubscribe_token("person@example.com", token)
    assert not verify_unsubscribe_token("other@example.com", token)
