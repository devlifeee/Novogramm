import builtins
import secrets

import pytest

from app import utils as email_utils
from app.auth import routes as auth_routes
from app.config import Config


class ResendResponse:
    ok = True
    status_code = 200
    text = ""


def test_resend_transport_uses_https_and_verified_sender(app, monkeypatch):
    monkeypatch.setitem(app.config, "RESEND_API_KEY", "re_test_key")
    monkeypatch.setitem(app.config, "EMAIL_FROM", "Novogramm <noreply@example.com>")
    monkeypatch.setitem(app.config, "FRONTEND_URL", "https://novogramm.example")
    request = {}

    def post(url, **kwargs):
        request["url"] = url
        request.update(kwargs)
        return ResendResponse()

    monkeypatch.setattr(email_utils.requests, "post", post)

    with app.app_context():
        assert email_utils.send_verification_email("user@example.com", "12345")
        assert email_utils.send_password_reset_email("user@example.com", "reset-token")

    assert request["url"] == "https://api.resend.com/emails"
    assert request["headers"] == {"Authorization": "Bearer re_test_key"}
    assert request["timeout"] == 10
    assert request["json"]["from"] == "Novogramm <noreply@example.com>"
    assert request["json"]["to"] == ["user@example.com"]
    assert "https://novogramm.example/auth/reset-password/reset-token" in request["json"]["html"]


def test_production_configuration_requires_resend_credentials():
    settings = {
        "ENV": "production",
        "SECRET_KEY": "test-production-secret",
        "USE_SQLITE": False,
        "DATABASE_URL": "postgresql://example.invalid/novogramm",
        "RECAPTCHA_DISABLED": False,
        "RECAPTCHA_SECRET_KEY": "test-recaptcha-secret",
        "SKIP_EMAIL_VERIFICATION": False,
        "RESEND_API_KEY": "",
        "EMAIL_FROM": "",
    }

    with pytest.raises(RuntimeError, match="RESEND_API_KEY is required in production; EMAIL_FROM is required in production"):
        Config.validate(settings)


def test_production_auth_email_paths_use_resend_without_smtplib(client, app, monkeypatch):
    monkeypatch.setitem(app.config, "ENV", "production")
    monkeypatch.setitem(app.config, "SKIP_EMAIL_VERIFICATION", False)
    monkeypatch.setitem(app.config, "RESEND_API_KEY", "re_test_key")
    monkeypatch.setitem(app.config, "EMAIL_FROM", "Novogramm <noreply@example.com>")
    monkeypatch.setitem(app.config, "OTP_RESEND_SECONDS", 0)
    requests = []

    def post(url, **kwargs):
        requests.append((url, kwargs))
        return ResendResponse()

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

    assert len(requests) == 3
    assert all(url == email_utils.RESEND_EMAILS_URL for url, _kwargs in requests)
    assert all(kwargs["headers"] == {"Authorization": "Bearer re_test_key"} for _url, kwargs in requests)


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
