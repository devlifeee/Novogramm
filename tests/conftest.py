import os
import tempfile

os.environ.update({
    "APP_ENV": "test", "TESTING": "true", "USE_SQLITE": "true",
    "SECRET_KEY": "test-only-secret", "RECAPTCHA_DISABLED": "true",
    "SKIP_EMAIL_VERIFICATION": "true",
    "SQLITE_PATH": tempfile.mktemp(prefix="novogramm-test-", suffix=".db"),
})

import pytest
from app import create_app


@pytest.fixture(scope="session")
def app():
    return create_app({"TESTING": True})


@pytest.fixture()
def client(app):
    return app.test_client()


def create_user(client, suffix):
    email = f"user{suffix}@example.com"
    response = client.post("/register", json={"email": email, "password": "StrongPass123", "confirm_password": "StrongPass123"})
    token = response.get_json()["registration_token"]
    response = client.post("/complete_registration", json={"registration_token": token, "name": f"User {suffix}", "username": f"user{suffix}"})
    return response.get_json()["user"]


@pytest.fixture()
def users(client):
    import secrets
    suffix = secrets.token_hex(3)
    return create_user(client, suffix + "a"), create_user(client, suffix + "b")
