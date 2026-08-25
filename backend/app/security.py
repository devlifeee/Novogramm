import hashlib
import hmac
import re
import secrets
import threading
import time
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone
from functools import wraps

from flask import current_app, g, jsonify, request

from .database import execute_query


PHONE_RE = re.compile(r"^\+[1-9]\d{7,14}$")


def utcnow():
    return datetime.now(timezone.utc)


def hash_secret(value: str) -> str:
    key = current_app.config["SECRET_KEY"].encode()
    return hmac.new(key, value.encode(), hashlib.sha256).hexdigest()


def issue_session(user_id: int):
    raw = secrets.token_urlsafe(32)
    expires = utcnow() + timedelta(hours=current_app.config["SESSION_TTL_HOURS"])
    execute_query(
        "INSERT INTO sessions (user_id, token_hash, expires_at) VALUES (%s, %s, %s)",
        (user_id, hash_secret(raw), expires),
    )
    return raw, expires


def bearer_token():
    value = request.headers.get("Authorization", "").strip()
    if value.lower().startswith("bearer "):
        return value[7:].strip()
    return value


def current_user():
    raw = bearer_token()
    if not raw:
        return None
    return execute_query(
        """
        SELECT u.id, u.email, u.name, u.username, u.phone, u.phone_verified_at,
               u.verified, u.is_admin, u.banned_at, u.avatar, u.banner, u.bio, u.created_at, u.updated_at
        FROM sessions s JOIN email_auth u ON u.id=s.user_id
        WHERE s.token_hash=%s AND s.revoked_at IS NULL AND s.expires_at>CURRENT_TIMESTAMP
        """,
        (hash_secret(raw),), fetch=True,
    )


def auth_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        user = current_user()
        if not user:
            return jsonify({"success": False, "error": {"code": "unauthorized", "message": "Требуется авторизация"}}), 401
        if user.get("banned_at"):
            return jsonify({"success": False, "error": {"code": "account_banned", "message": "Аккаунт заблокирован"}}), 403
        g.current_user = user
        return view(*args, **kwargs)
    return wrapped


def admin_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        user = current_user()
        if not user:
            return jsonify({"success": False, "error": {"code": "unauthorized", "message": "Требуется авторизация"}}), 401
        if user.get("banned_at"):
            return jsonify({"success": False, "error": {"code": "account_banned", "message": "Аккаунт заблокирован"}}), 403
        if not user.get("is_admin"):
            return jsonify({"success": False, "error": {"code": "forbidden", "message": "Требуются права администратора"}}), 403
        g.current_user = user
        return view(*args, **kwargs)
    return wrapped


class RateLimiter:
    def __init__(self):
        self._events = defaultdict(deque)
        self._lock = threading.Lock()

    def allowed(self, key: str, limit: int, window: int) -> bool:
        now = time.monotonic()
        with self._lock:
            values = self._events[key]
            while values and values[0] <= now - window:
                values.popleft()
            if len(values) >= limit:
                return False
            values.append(now)
            return True


limiter = RateLimiter()


def rate_limit(scope: str, limit: int, window: int, subject=None):
    def decorator(view):
        @wraps(view)
        def wrapped(*args, **kwargs):
            if current_app.config.get("TESTING"):
                return view(*args, **kwargs)
            identity = subject() if subject else request.remote_addr or "unknown"
            active_window = window() if callable(window) else window
            if not limiter.allowed(f"{scope}:{identity}", limit, active_window):
                return jsonify({"success": False, "error": {"code": "rate_limited", "message": "Слишком много запросов"}}), 429
            return view(*args, **kwargs)
        return wrapped
    return decorator


def normalize_phone(value: str):
    phone = re.sub(r"[\s()\-]", "", value or "")
    if phone.startswith("8") and len(phone) == 11:
        phone = "+7" + phone[1:]
    if not PHONE_RE.fullmatch(phone):
        raise ValueError("Телефон должен быть в международном формате, например +79991234567")
    return phone
