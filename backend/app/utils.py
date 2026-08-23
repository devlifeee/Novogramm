import base64
import re
from email.message import EmailMessage

import requests
from flask import current_app


GOOGLE_OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token"
GMAIL_MESSAGES_SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send"
EMAIL_TIMEOUT_SECONDS = 10


class EmailConfigurationError(RuntimeError):
    """Raised when the required production email transport is not configured."""


def is_valid_email(email):
    pattern = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
    return re.match(pattern, email) is not None


def gmail_access_token():
    try:
        response = requests.post(
            GOOGLE_OAUTH_TOKEN_URL,
            data={
                "client_id": current_app.config["GMAIL_CLIENT_ID"],
                "client_secret": current_app.config["GMAIL_CLIENT_SECRET"],
                "refresh_token": current_app.config["GMAIL_REFRESH_TOKEN"],
                "grant_type": "refresh_token",
            },
            timeout=EMAIL_TIMEOUT_SECONDS,
        )
    except requests.RequestException as error:
        current_app.logger.warning("Gmail OAuth token request failed: %s", type(error).__name__)
        return None

    if not response.ok:
        current_app.logger.warning("Gmail OAuth token request rejected: status=%s", response.status_code)
        return None
    try:
        access_token = response.json().get("access_token")
    except ValueError:
        current_app.logger.warning("Gmail OAuth token response was not valid JSON")
        return None
    if not access_token:
        current_app.logger.warning("Gmail OAuth token response did not contain an access token")
        return None
    return access_token


def send_email(recipient, subject, html):
    sender = current_app.config["EMAIL_FROM"]
    if not all(current_app.config[name] for name in ("GMAIL_CLIENT_ID", "GMAIL_CLIENT_SECRET", "GMAIL_REFRESH_TOKEN", "EMAIL_FROM")):
        if current_app.config["ENV"] == "production":
            raise EmailConfigurationError(
                "Invalid email configuration: GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, and EMAIL_FROM are required in production"
            )
        current_app.logger.error("Gmail API email delivery is not configured")
        return False

    access_token = gmail_access_token()
    if not access_token:
        return False

    message = EmailMessage()
    message["To"] = recipient
    message["From"] = sender
    message["Subject"] = subject
    message.set_content(html, subtype="html")
    raw_message = base64.urlsafe_b64encode(message.as_bytes()).decode().rstrip("=")
    try:
        response = requests.post(
            GMAIL_MESSAGES_SEND_URL,
            headers={"Authorization": f"Bearer {access_token}"},
            json={"raw": raw_message},
            timeout=EMAIL_TIMEOUT_SECONDS,
        )
    except requests.RequestException as error:
        current_app.logger.warning("Gmail API email delivery request failed: %s", type(error).__name__)
        return False

    if not response.ok:
        current_app.logger.warning(
            "Gmail API email delivery rejected: status=%s",
            response.status_code,
        )
        return False
    return True


def send_verification_email(email, code):
    html = f"""
<!DOCTYPE html>
<html><body style="font-family:Arial,sans-serif;background:#f5f5f5;padding:20px;">
  <div style="max-width:600px;margin:auto;background:white;border-radius:10px;padding:30px;text-align:center;">
    <img src="https://i.postimg.cc/N5Z3Xvhg/LOGO2.png" alt="Novogramm" style="width:200px;">
    <h1>Подтверждение создания аккаунта</h1>
    <p>Ваш код подтверждения для Novogramm:</p>
    <p style="font-size:28px;font-weight:bold;letter-spacing:3px;">{code}</p>
    <p><strong>Никому не сообщайте этот код.</strong></p>
  </div>
</body></html>
"""
    return send_email(email, "Код подтверждения регистрации", html)


def send_password_reset_email(email, reset_token):
    reset_link = f"{current_app.config['FRONTEND_URL'].rstrip('/')}/auth/reset-password/{reset_token}"
    html = f"""
<!DOCTYPE html>
<html><body style="font-family:Arial,sans-serif;background:#f5f5f5;padding:20px;">
  <div style="max-width:600px;margin:auto;background:white;border-radius:10px;padding:30px;text-align:center;">
    <img src="https://i.postimg.cc/N5Z3Xvhg/LOGO2.png" alt="Novogramm" style="width:200px;">
    <h1>Восстановление пароля</h1>
    <p>Вы запросили восстановление пароля для аккаунта Novogramm.</p>
    <p><a href="{reset_link}">Создать новый пароль</a></p>
    <p>Если кнопка не работает, используйте ссылку:<br><a href="{reset_link}">{reset_link}</a></p>
    <p>Если вы не запрашивали восстановление, проигнорируйте это письмо.</p>
  </div>
</body></html>
"""
    return send_email(email, "Восстановление пароля - Novogramm", html)
