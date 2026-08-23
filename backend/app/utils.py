import re

import requests
from flask import current_app


SENDGRID_MAIL_SEND_URL = "https://api.sendgrid.com/v3/mail/send"
EMAIL_TIMEOUT_SECONDS = 10


class EmailConfigurationError(RuntimeError):
    """Raised when the required production email transport is not configured."""


def is_valid_email(email):
    pattern = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
    return re.match(pattern, email) is not None


def send_email(recipient, subject, html):
    api_key = current_app.config["SENDGRID_API_KEY"]
    sender = current_app.config["EMAIL_FROM"]
    if not api_key or not sender:
        if current_app.config["ENV"] == "production":
            raise EmailConfigurationError(
                "Invalid email configuration: SENDGRID_API_KEY and EMAIL_FROM are required in production"
            )
        current_app.logger.error("SendGrid email delivery is not configured")
        return False

    try:
        response = requests.post(
            SENDGRID_MAIL_SEND_URL,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={
                "personalizations": [{"to": [{"email": recipient}]}],
                "from": {"email": sender},
                "subject": subject,
                "content": [{"type": "text/html", "value": html}],
            },
            timeout=EMAIL_TIMEOUT_SECONDS,
        )
    except requests.RequestException as error:
        current_app.logger.warning("SendGrid email delivery request failed: %s", type(error).__name__)
        return False

    if not response.ok:
        current_app.logger.warning(
            "SendGrid email delivery rejected: status=%s response=%s",
            response.status_code,
            response.text[:300],
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
