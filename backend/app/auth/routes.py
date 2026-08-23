import re
import secrets
from datetime import datetime, timedelta, timezone

import bcrypt
import requests
from flask import Blueprint, current_app, g, jsonify, request
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

from app.database import execute_query, transaction, _query
from app.security import (
    auth_required, bearer_token, current_user, hash_secret, issue_session, normalize_phone,
    rate_limit, utcnow,
)
from app.utils import is_valid_email, send_password_reset_email, send_verification_email


auth_bp = Blueprint("auth", __name__)
USERNAME_RE = re.compile(r"^[a-z0-9_.]{3,30}$")


def error(message, status=400, code="invalid_request"):
    return jsonify({"success": False, "error": message, "code": code}), status


def registration_token(email):
    return URLSafeTimedSerializer(current_app.config["SECRET_KEY"], salt="registration").dumps(email)


def registration_email(token):
    return URLSafeTimedSerializer(current_app.config["SECRET_KEY"], salt="registration").loads(token, max_age=1800)


def strong_password(value):
    return isinstance(value, str) and len(value) >= 10 and re.search(r"[a-z]", value) and re.search(r"[A-Z]", value) and re.search(r"\d", value)


def verify_recaptcha(token):
    if current_app.config["RECAPTCHA_DISABLED"]:
        return True
    if not token or not current_app.config["RECAPTCHA_SECRET_KEY"]:
        return False
    try:
        response = requests.post("https://www.google.com/recaptcha/api/siteverify", data={"secret": current_app.config["RECAPTCHA_SECRET_KEY"], "response": token, "remoteip": request.remote_addr}, timeout=5)
        return response.ok and response.json().get("success") is True
    except requests.RequestException:
        return False


def save_code(subject, purpose, code):
    now = utcnow()
    execute_query("DELETE FROM verification_codes WHERE subject=%s AND purpose=%s", (subject, purpose))
    execute_query(
        "INSERT INTO verification_codes (subject,purpose,code_hash,expires_at,last_sent_at) VALUES (%s,%s,%s,%s,%s)",
        (subject, purpose, hash_secret(code), now + timedelta(minutes=current_app.config["OTP_TTL_MINUTES"]), now),
    )


def resend_available(subject, purpose):
    row = execute_query(
        "SELECT last_sent_at FROM verification_codes WHERE subject=%s AND purpose=%s",
        (subject, purpose), fetch=True,
    )
    if not row:
        return True
    sent_at = row["last_sent_at"]
    if isinstance(sent_at, str):
        sent_at = datetime.fromisoformat(sent_at.replace("Z", "+00:00"))
    if sent_at.tzinfo is None:
        sent_at = sent_at.replace(tzinfo=timezone.utc)
    return utcnow() >= sent_at + timedelta(seconds=current_app.config["OTP_RESEND_SECONDS"])


def check_code(subject, purpose, code):
    row = execute_query("SELECT id,code_hash,attempts FROM verification_codes WHERE subject=%s AND purpose=%s AND consumed_at IS NULL AND expires_at>CURRENT_TIMESTAMP", (subject, purpose), fetch=True)
    if not row or row["attempts"] >= current_app.config["OTP_MAX_ATTEMPTS"]:
        return False
    if not secrets.compare_digest(row["code_hash"], hash_secret(code)):
        execute_query("UPDATE verification_codes SET attempts=attempts+1 WHERE id=%s", (row["id"],))
        return False
    execute_query("UPDATE verification_codes SET consumed_at=CURRENT_TIMESTAMP WHERE id=%s", (row["id"],))
    return True


def deliver_verification_code(email):
    code = f"{secrets.randbelow(100000):05d}"
    if not send_verification_email(email, code):
        return False
    save_code(email, "email", code)
    return True


@auth_bp.post("/register")
@rate_limit("register", 5, 3600)
def register():
    data = request.get_json(silent=True) or {}
    email = str(data.get("email", "")).strip().lower()
    password = data.get("password")
    confirmation = data.get("confirmPassword") or data.get("confirm_password")
    if not is_valid_email(email):
        return error("Некорректный email")
    if password != confirmation:
        return error("Пароли не совпадают")
    if not strong_password(password):
        return error("Пароль: минимум 10 символов, заглавная и строчная буквы, цифра")
    if not verify_recaptcha(data.get("g-recaptcha-response")):
        return error("Подтверждение reCAPTCHA не пройдено")
    existing_user = execute_query("SELECT verified FROM email_auth WHERE email=%s", (email,), fetch=True)
    if existing_user:
        if existing_user["verified"]:
            return error("Не удалось зарегистрировать аккаунт с указанными данными", 409, "conflict")
        if not resend_available(email, "email"):
            return error("Аккаунт ожидает подтверждения. Повторный код можно запросить позже", 429, "cooldown")
        if not deliver_verification_code(email):
            return error("Не удалось отправить код. Повторите позже", 503, "provider_unavailable")
        return jsonify({"success": True, "message": "Код подтверждения отправлен повторно"})

    password_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=12)).decode()
    execute_query("INSERT INTO email_auth(email,password,verified) VALUES(%s,%s,%s)", (email, password_hash, current_app.config["SKIP_EMAIL_VERIFICATION"]))
    if current_app.config["SKIP_EMAIL_VERIFICATION"]:
        return jsonify({"success": True, "skip_verification": True, "registration_token": registration_token(email)})

    if not deliver_verification_code(email):
        return error("Не удалось отправить код. Повторите позже", 503, "provider_unavailable")
    return jsonify({"success": True})


@auth_bp.post("/resend")
@rate_limit("email_resend", 3, 3600)
def resend():
    email = str((request.get_json(silent=True) or {}).get("email", "")).strip().lower()
    user = execute_query("SELECT verified FROM email_auth WHERE email=%s", (email,), fetch=True)
    if not user or user["verified"]:
        return jsonify({"success": True, "message": "Если аккаунт ожидает подтверждения, код отправлен"})
    if not resend_available(email, "email"):
        return error("Повторный код можно запросить позже", 429, "cooldown")
    if not deliver_verification_code(email):
        return error("Не удалось отправить код. Повторите позже", 503)
    return jsonify({"success": True})


@auth_bp.post("/verify")
@auth_bp.post("/verify_code")
@rate_limit("email_verify", 10, 900)
def verify_email():
    data = request.get_json(silent=True) or {}
    email, code = str(data.get("email", "")).strip().lower(), str(data.get("code", ""))
    if not re.fullmatch(r"\d{5}", code) or not check_code(email, "email", code):
        return error("Неверный или истёкший код", 400, "invalid_code")
    execute_query("UPDATE email_auth SET verified=%s,updated_at=CURRENT_TIMESTAMP WHERE email=%s", (True, email))
    return jsonify({"success": True, "registration_token": registration_token(email)})


@auth_bp.post("/complete_registration")
@rate_limit("complete_registration", 10, 3600)
def complete_registration():
    data = request.get_json(silent=True) or {}
    token = data.get("registration_token", "")
    try:
        email = registration_email(token)
    except (BadSignature, SignatureExpired):
        return error("Сессия регистрации истекла", 401, "invalid_registration_token")
    name, username = str(data.get("name", "")).strip(), str(data.get("username", "")).strip().lower()
    if not 1 <= len(name) <= 80 or not USERNAME_RE.fullmatch(username):
        return error("Проверьте имя и username (3–30 латинских символов)")
    user = execute_query("SELECT id,verified FROM email_auth WHERE email=%s", (email,), fetch=True)
    if not user or not user["verified"]:
        return error("Email не подтверждён", 403)
    if execute_query("SELECT id FROM email_auth WHERE username=%s AND id<>%s", (username, user["id"]), fetch=True):
        return error("Этот username уже занят", 409, "conflict")
    execute_query("UPDATE email_auth SET name=%s,username=%s,updated_at=CURRENT_TIMESTAMP WHERE id=%s", (name, username, user["id"]))
    raw, expires = issue_session(user["id"])
    return jsonify({"success": True, "user": {"id": user["id"], "email": email, "name": name, "username": username, "token": raw}, "expires_at": expires.isoformat()})


@auth_bp.post("/login")
@rate_limit("login", 10, 900)
def login():
    data = request.get_json(silent=True) or {}
    email, password = str(data.get("email", "")).strip().lower(), data.get("password", "")
    if not verify_recaptcha(data.get("g-recaptcha-response")):
        return error("Подтверждение reCAPTCHA не пройдено")
    user = execute_query("SELECT * FROM email_auth WHERE email=%s", (email,), fetch=True)
    if not user or not bcrypt.checkpw(password.encode(), user["password"].encode()):
        return error("Неверный email или пароль", 401, "invalid_credentials")
    if not user["verified"]:
        return error("Подтвердите email перед входом", 403, "email_unverified")
    raw, expires = issue_session(user["id"])
    return jsonify({"success": True, "token": raw, "expires_at": expires.isoformat(), "user": public_user(user, private=True)})


@auth_bp.post("/logout")
@auth_required
def logout():
    execute_query("UPDATE sessions SET revoked_at=CURRENT_TIMESTAMP WHERE token_hash=%s", (hash_secret(bearer_token()),))
    return jsonify({"success": True})


def public_user(user, private=False):
    result = {"id": user["id"], "name": user.get("name"), "username": user.get("username"), "avatar": user.get("avatar") or "/static/images/default-avatar.png", "bio": user.get("bio") or "", "created_at": user.get("created_at")}
    if private:
        result.update({"email": user.get("email"), "phone": user.get("phone"), "phone_verified_at": user.get("phone_verified_at"), "verified": bool(user.get("verified")), "is_admin": bool(user.get("is_admin")), "banner": user.get("banner")})
    return result


@auth_bp.get("/api/get_user_data")
@auth_required
def get_user_data():
    return jsonify({"success": True, "user": public_user(g.current_user, private=True)})


@auth_bp.post("/forgot-password")
@auth_bp.post("/api/forgot-password")
@rate_limit("forgot_password", 5, 3600)
def forgot_password():
    data = request.get_json(silent=True) or {}
    email = str(data.get("email", "")).strip().lower()
    if not verify_recaptcha(data.get("g-recaptcha-response")):
        return error("Подтверждение reCAPTCHA не пройдено")
    user = execute_query("SELECT id FROM email_auth WHERE email=%s", (email,), fetch=True)
    if user:
        raw = secrets.token_urlsafe(32)
        if send_password_reset_email(email, raw):
            execute_query("INSERT INTO password_resets(user_id,token_hash,expires_at) VALUES(%s,%s,%s)", (user["id"], hash_secret(raw), utcnow()+timedelta(minutes=current_app.config["PASSWORD_RESET_TTL_MINUTES"])))
    return jsonify({"success": True, "message": "Если аккаунт существует, инструкция отправлена"})


@auth_bp.post("/reset-password")
@rate_limit("reset_password", 10, 3600)
def reset_password():
    data = request.get_json(silent=True) or {}
    raw, password, confirmation = data.get("token", ""), data.get("new_password", ""), data.get("confirm_password", "")
    if password != confirmation or not strong_password(password):
        return error("Новый пароль не соответствует требованиям")
    reset = execute_query("SELECT id,user_id FROM password_resets WHERE token_hash=%s AND consumed_at IS NULL AND expires_at>CURRENT_TIMESTAMP", (hash_secret(raw),), fetch=True)
    if not reset:
        return error("Ссылка недействительна или истекла", 400, "invalid_token")
    password_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=12)).decode()
    with transaction() as cursor:
        cursor.execute(_query("UPDATE email_auth SET password=%s,updated_at=CURRENT_TIMESTAMP WHERE id=%s"), (password_hash, reset["user_id"]))
        cursor.execute(_query("UPDATE password_resets SET consumed_at=CURRENT_TIMESTAMP WHERE id=%s"), (reset["id"],))
        cursor.execute(_query("UPDATE sessions SET revoked_at=CURRENT_TIMESTAMP WHERE user_id=%s AND revoked_at IS NULL"), (reset["user_id"],))
    return jsonify({"success": True, "message": "Пароль изменён"})


def send_sms(phone, code):
    provider = current_app.config["SMS_PROVIDER"]
    if provider == "webhook" and current_app.config["SMS_WEBHOOK_URL"]:
        response = requests.post(current_app.config["SMS_WEBHOOK_URL"], json={"to": phone, "from": current_app.config["SMS_FROM"], "message": f"Novogramm code: {code}"}, headers={"Authorization": f"Bearer {current_app.config['SMS_WEBHOOK_TOKEN']}"}, timeout=8)
        response.raise_for_status()
        return True
    if provider == "console" and current_app.config["ENV"] != "production":
        current_app.logger.warning("Development SMS requested for phone suffix=%s", phone[-4:])
        return True
    return False


@auth_bp.post("/api/phone/request")
@auth_required
@rate_limit("phone_otp", 3, 3600, subject=lambda: str(current_user()["id"]) if current_user() else "anonymous")
def request_phone_code():
    try:
        phone = normalize_phone((request.get_json(silent=True) or {}).get("phone", ""))
    except ValueError as exc:
        return error(str(exc))
    owner = execute_query("SELECT id FROM email_auth WHERE phone=%s AND id<>%s", (phone, g.current_user["id"]), fetch=True)
    if owner:
        return error("Номер уже используется", 409, "conflict")
    if not resend_available(phone, "phone"):
        return error("Повторный код можно запросить позже", 429, "cooldown")
    code = f"{secrets.randbelow(1000000):06d}"
    save_code(phone, "phone", code)
    try:
        if not send_sms(phone, code):
            return error("SMS-провайдер не настроен", 503, "provider_unavailable")
    except requests.RequestException:
        return error("SMS временно недоступны", 503, "provider_unavailable")
    execute_query("UPDATE email_auth SET phone=%s,phone_verified_at=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=%s", (phone, g.current_user["id"]))
    return jsonify({"success": True, "message": "Код отправлен"}), 202


@auth_bp.post("/api/phone/verify")
@auth_required
@rate_limit("phone_verify", 10, 900, subject=lambda: str(current_user()["id"]) if current_user() else "anonymous")
def verify_phone_code():
    code = str((request.get_json(silent=True) or {}).get("code", ""))
    phone = execute_query("SELECT phone FROM email_auth WHERE id=%s", (g.current_user["id"],), fetch=True)["phone"]
    if not phone or not re.fullmatch(r"\d{6}", code) or not check_code(phone, "phone", code):
        return error("Неверный или истёкший код", 400, "invalid_code")
    execute_query("UPDATE email_auth SET phone_verified_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=%s", (g.current_user["id"],))
    return jsonify({"success": True, "phone_verified": True})
