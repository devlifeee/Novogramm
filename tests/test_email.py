import base64
import builtins
import secrets
from email import policy
from email.parser import BytesParser

import pytest

from app import utils as email_utils
from app.auth import routes as auth_routes
from app.config import Config


class GmailResponse:
    def __init__(self, payload=None, status_code=200):
        self.payload = payload or {}
        self.status_code = status_code
        self.ok = status_code < 400

    def json(self):
        return self.payload


def decode_raw_message(raw):
    return BytesParser(policy=policy.default).parsebytes(base64.urlsafe_b64decode(raw + "=" * (-len(raw) % 4)))


def test_gmail_api_transport_refreshes_token_and_sends_html(app, monkeypatch):
    monkeypatch.setitem(app.config, "GMAIL_CLIENT_ID", "test-client-id")
    monkeypatch.setitem(app.config, "GMAIL_CLIENT_SECRET", "test-client-secret")
    monkeypatch.setitem(app.config, "GMAIL_REFRESH_TOKEN", "test-refresh-token")
    monkeypatch.setitem(app.config, "EMAIL_FROM", "novogramm.corporation@gmail.com")
    monkeypatch.setitem(app.config, "FRONTEND_URL", "https://novogramm.example")
    requests = []

    def post(url, **kwargs):
        requests.append((url, kwargs))
        if url == email_utils.GOOGLE_OAUTH_TOKEN_URL:
            return GmailResponse({"access_token": "test-access-token"})
        return GmailResponse()

    monkeypatch.setattr(email_utils.requests, "post", post)

    with app.app_context():
        assert email_utils.send_verification_email("user@example.com", "12345")
        assert email_utils.send_password_reset_email("user@example.com", "reset-token")

    assert len(requests) == 4
    token_url, token_request = requests[0]
    assert token_url == email_utils.GOOGLE_OAUTH_TOKEN_URL
    assert token_request["data"] == {
        "client_id": "test-client-id",
        "client_secret": "test-client-secret",
        "refresh_token": "test-refresh-token",
        "grant_type": "refresh_token",
    }
    assert token_request["timeout"] == 10
    send_url, send_request = requests[1]
    assert send_url == email_utils.GMAIL_MESSAGES_SEND_URL
    assert send_request["headers"] == {"Authorization": "Bearer test-access-token"}
    assert send_request["timeout"] == 10
    message = decode_raw_message(send_request["json"]["raw"])
    assert message["From"] == "novogramm.corporation@gmail.com"
    assert message["To"] == "user@example.com"
    assert message.get_content_type() == "text/html"
    assert "12345" in message.get_content()
    assert requests[2][0] == email_utils.GOOGLE_OAUTH_TOKEN_URL
    assert requests[3][0] == email_utils.GMAIL_MESSAGES_SEND_URL
    reset_message = decode_raw_message(requests[3][1]["json"]["raw"])
    assert "https://novogramm.example/auth/reset-password/reset-token" in reset_message.get_content()


def test_production_configuration_requires_gmail_oauth_credentials():
    settings = {
        "ENV": "production",
        "SECRET_KEY": "test-production-secret",
        "USE_SQLITE": False,
        "DATABASE_URL": "postgresql://example.invalid/novogramm",
        "RECAPTCHA_DISABLED": False,
        "RECAPTCHA_SECRET_KEY": "test-recaptcha-secret",
        "SKIP_EMAIL_VERIFICATION": False,
        "GMAIL_CLIENT_ID": "",
        "GMAIL_CLIENT_SECRET": "",
        "GMAIL_REFRESH_TOKEN": "",
        "EMAIL_FROM": "",
    }

    with pytest.raises(
        RuntimeError,
        match="GMAIL_CLIENT_ID is required in production; GMAIL_CLIENT_SECRET is required in production; GMAIL_REFRESH_TOKEN is required in production; EMAIL_FROM is required in production",
    ):
        Config.validate(settings)


def test_production_auth_email_paths_use_gmail_api_without_smtplib(client, app, monkeypatch):
    monkeypatch.setitem(app.config, "ENV", "production")
    monkeypatch.setitem(app.config, "SKIP_EMAIL_VERIFICATION", False)
    monkeypatch.setitem(app.config, "GMAIL_CLIENT_ID", "test-client-id")
    monkeypatch.setitem(app.config, "GMAIL_CLIENT_SECRET", "test-client-secret")
    monkeypatch.setitem(app.config, "GMAIL_REFRESH_TOKEN", "test-refresh-token")
    monkeypatch.setitem(app.config, "EMAIL_FROM", "novogramm.corporation@gmail.com")
    monkeypatch.setitem(app.config, "OTP_RESEND_SECONDS", 0)
    requests = []

    def post(url, **kwargs):
        requests.append((url, kwargs))
        if url == email_utils.GOOGLE_OAUTH_TOKEN_URL:
            return GmailResponse({"access_token": "test-access-token"})
        return GmailResponse()

    original_import = builtins.__import__

    def reject_smtplib(name, *args, **kwargs):
        if name == "smtplib":
            raise AssertionError("production email delivery must not import smtplib")
        return original_import(name, *args, **kwargs)

    monkeypatch.setattr(email_utils.requests, "post", post)
    monkeypatch.setattr(builtins, "__import__", reject_smtplib)
    email = f"production-{secrets.token_hex(4)}@example.com"
    registration = {
        "email": email,
        "password": "StrongPass123",
        "confirm_password": "StrongPass123",
    }

    assert client.post("/register", json=registration).status_code == 200
    assert client.post("/resend", json={"email": email}).status_code == 200
    assert client.post("/forgot-password", json={"email": email}).status_code == 200

    assert len(requests) == 6
    assert all(url == email_utils.GOOGLE_OAUTH_TOKEN_URL for url, _kwargs in requests[::2])
    assert all(url == email_utils.GMAIL_MESSAGES_SEND_URL for url, _kwargs in requests[1::2])
    assert all(kwargs["headers"] == {"Authorization": "Bearer test-access-token"} for _url, kwargs in requests[1::2])


def test_unverified_registration_can_retry_delivery(client, app, monkeypatch):
    monkeypatch.setitem(app.config, "SKIP_EMAIL_VERIFICATION", False)
    email = "retry-email@example.com"
    payload = {
        "email": email,
        "password": "StrongPass123",
        "confirm_password": "StrongPass123",
    }

    monkeypatch.setattr(auth_routes, "send_verification_email", lambda *_args: False)
    assert client.post("/register", json=payload).status_code == 503

    monkeypatch.setattr(auth_routes, "send_verification_email", lambda *_args: True)
    response = client.post("/register", json=payload)
    assert response.status_code == 200
    assert response.get_json()["success"] is True
