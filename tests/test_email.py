from app import utils as email_utils
from app.auth import routes as auth_routes


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
