import secrets
from pathlib import Path

from flask import Blueprint, abort, current_app, g, jsonify, redirect, request, send_from_directory
from werkzeug.utils import secure_filename

from app.auth.routes import public_user
from app.database import USE_SQLITE, _query, execute_query, transaction
from app.security import admin_required, auth_required, rate_limit


main = Blueprint("main", __name__)
IMAGE_SIGNATURES = {b"\x89PNG\r\n\x1a\n": "png", b"\xff\xd8\xff": "jpg", b"GIF87a": "gif", b"GIF89a": "gif", b"RIFF": "webp"}
UPLOAD_CATEGORIES = {"avatars", "posts"}
MODERATION_REASONS = {"prohibited_content", "spam", "harassment", "other"}


def error(message, status=400, code="invalid_request"):
    return jsonify({"success": False, "error": message, "code": code}), status


def pagination(default=20, maximum=100):
    try:
        limit = min(max(int(request.args.get("limit", default)), 1), maximum)
        offset = max(int(request.args.get("offset", 0)), 0)
    except ValueError:
        raise ValueError("Некорректная пагинация")
    return limit, offset


def serialize_time(row, field="created_at"):
    value = row.get(field)
    return value.isoformat() if hasattr(value, "isoformat") else value


@main.get("/")
def index():
    return redirect(current_app.config.get("FRONTEND_URL", "http://localhost:8888"), 302)


@main.get("/api/profile")
@auth_required
def profile():
    return jsonify({"success": True, "user": public_user(g.current_user, private=True)})


@main.put("/api/profile")
@auth_required
@rate_limit("profile_update", 30, 3600)
def update_profile():
    data = request.get_json(silent=True) or {}
    allowed = {"name", "username", "bio"}
    unknown = set(data) - allowed
    if unknown:
        return error("Недопустимые поля: " + ", ".join(sorted(unknown)))
    name = str(data.get("name", g.current_user.get("name") or "")).strip()
    username = str(data.get("username", g.current_user.get("username") or "")).strip().lower()
    bio = str(data.get("bio", g.current_user.get("bio") or "")).strip()
    if not 1 <= len(name) <= 80 or not 3 <= len(username) <= 30 or not all(c.islower() or c.isdigit() or c in "_." for c in username) or len(bio) > 500:
        return error("Проверьте имя, username и bio")
    duplicate = execute_query("SELECT id FROM email_auth WHERE username=%s AND id<>%s", (username, g.current_user["id"]), fetch=True)
    if duplicate:
        return error("Username уже занят", 409, "conflict")
    execute_query("UPDATE email_auth SET name=%s,username=%s,bio=%s,updated_at=CURRENT_TIMESTAMP WHERE id=%s", (name, username, bio, g.current_user["id"]))
    updated = execute_query("SELECT * FROM email_auth WHERE id=%s", (g.current_user["id"],), fetch=True)
    return jsonify({"success": True, "user": public_user(updated, private=True)})


def validated_image(file):
    if not file or not file.filename:
        raise ValueError("Файл не выбран")
    extension = Path(secure_filename(file.filename)).suffix.lower().lstrip(".")
    header = file.stream.read(16)
    file.stream.seek(0)
    detected = next((kind for signature, kind in IMAGE_SIGNATURES.items() if header.startswith(signature)), None)
    if extension not in current_app.config["ALLOWED_EXTENSIONS"] or detected is None or (extension == "webp" and b"WEBP" not in header):
        raise ValueError("Разрешены только PNG, JPEG, GIF и WebP")
    return "jpg" if detected == "jpg" else detected


def upload_directory(category):
    if category not in UPLOAD_CATEGORIES:
        raise ValueError("Unknown upload category")
    return Path(current_app.config["UPLOAD_DIR"]) / category


def delete_post_upload(image_path):
    prefix = "/static/uploads/posts/"
    if not image_path or not image_path.startswith(prefix):
        return
    filename = image_path[len(prefix):]
    if filename != secure_filename(filename) or Path(filename).name != filename:
        current_app.logger.warning("Refused unsafe moderated post image path")
        return
    posts_directory = upload_directory("posts").resolve()
    target = (posts_directory / filename).resolve()
    if target.parent != posts_directory or not target.is_file():
        return
    try:
        target.unlink()
    except OSError as error:
        current_app.logger.warning("Could not remove moderated post image: %s", type(error).__name__)


@main.get("/static/uploads/<category>/<filename>")
def uploaded_media(category, filename):
    if category not in UPLOAD_CATEGORIES or filename != secure_filename(filename):
        abort(404)
    if Path(filename).suffix.lower().lstrip(".") not in current_app.config["ALLOWED_EXTENSIONS"]:
        abort(404)
    return send_from_directory(upload_directory(category), filename)


@main.post("/api/profile/avatar")
@auth_required
@rate_limit("avatar_upload", 10, 3600)
def upload_avatar():
    try:
        extension = validated_image(request.files.get("avatar"))
    except ValueError as exc:
        return error(str(exc))
    file = request.files["avatar"]
    upload_dir = upload_directory("avatars")
    filename = f"{secrets.token_hex(20)}.{extension}"
    file.save(upload_dir / filename)
    avatar = f"/static/uploads/avatars/{filename}"
    execute_query("UPDATE email_auth SET avatar=%s,updated_at=CURRENT_TIMESTAMP WHERE id=%s", (avatar, g.current_user["id"]))
    return jsonify({"success": True, "avatar_url": avatar})


POST_SELECT = """
SELECT p.id,p.user_id,p.content,p.image_path,p.created_at,p.updated_at,
 u.name AS user_name,u.username AS user_username,u.avatar AS user_avatar,
 (SELECT COUNT(*) FROM post_likes l WHERE l.post_id=p.id) AS likes_count,
 (SELECT COUNT(*) FROM comments c WHERE c.post_id=p.id AND c.deleted_at IS NULL) AS comments_count,
 EXISTS(SELECT 1 FROM post_likes l WHERE l.post_id=p.id AND l.user_id=%s) AS is_liked
FROM posts p JOIN email_auth u ON u.id=p.user_id
WHERE p.deleted_at IS NULL
"""


def serialize_post(row):
    return {"id": row["id"], "user_id": row["user_id"], "content": row["content"], "image_path": row.get("image_path"), "created_at": serialize_time(row), "updated_at": serialize_time(row, "updated_at"), "user_name": row.get("user_name"), "user_username": row.get("user_username"), "user_avatar": row.get("user_avatar") or "/static/images/default-avatar.png", "likes_count": int(row.get("likes_count", 0)), "comments_count": int(row.get("comments_count", 0)), "is_liked": bool(row.get("is_liked"))}


@main.post("/create_post")
@main.post("/api/posts")
@auth_required
@rate_limit("create_post", 30, 3600, subject=lambda: str(g.current_user["id"]))
@rate_limit("create_post_cooldown", 1, lambda: current_app.config["POST_COOLDOWN_SECONDS"], subject=lambda: str(g.current_user["id"]))
def create_post():
    content = str(request.form.get("content") if request.files or request.form else (request.get_json(silent=True) or {}).get("content", "")).strip()
    if not 1 <= len(content) <= current_app.config["MAX_POST_LENGTH"]:
        return error(f"Текст должен содержать 1–{current_app.config['MAX_POST_LENGTH']} символов")
    image_path = None
    image = request.files.get("image")
    if image and image.filename:
        try:
            extension = validated_image(image)
        except ValueError as exc:
            return error(str(exc))
        upload_dir = upload_directory("posts")
        filename = f"{secrets.token_hex(20)}.{extension}"
        image.save(upload_dir / filename)
        image_path = f"/static/uploads/posts/{filename}"
    inserted = execute_query("INSERT INTO posts(user_id,content,image_path) VALUES(%s,%s,%s) RETURNING id", (g.current_user["id"], content, image_path), fetch=True)
    row = execute_query(POST_SELECT + " AND p.id=%s", (g.current_user["id"], inserted["id"]), fetch=True)
    return jsonify({"success": True, "post": serialize_post(row)}), 201


@main.get("/get_posts")
@main.get("/api/posts")
@auth_required
def list_posts():
    try:
        limit, offset = pagination()
    except ValueError as exc:
        return error(str(exc))
    rows = execute_query(POST_SELECT + " ORDER BY p.created_at DESC,p.id DESC LIMIT %s OFFSET %s", (g.current_user["id"], limit, offset), fetchall=True)
    posts = [serialize_post(row) for row in rows]
    if request.path == "/get_posts":
        return jsonify(posts)
    return jsonify({"success": True, "items": posts, "limit": limit, "offset": offset, "has_more": len(posts) == limit})


@main.get("/api/posts/<int:post_id>")
@auth_required
def get_post(post_id):
    row = execute_query(POST_SELECT + " AND p.id=%s", (g.current_user["id"], post_id), fetch=True)
    return jsonify({"success": True, "post": serialize_post(row)}) if row else error("Пост не найден", 404, "not_found")


@main.put("/api/posts/<int:post_id>")
@auth_required
def edit_post(post_id):
    content = str((request.get_json(silent=True) or {}).get("content", "")).strip()
    if not 1 <= len(content) <= current_app.config["MAX_POST_LENGTH"]:
        return error("Некорректный текст поста")
    result = execute_query("UPDATE posts SET content=%s,updated_at=CURRENT_TIMESTAMP WHERE id=%s AND user_id=%s AND deleted_at IS NULL RETURNING id", (content, post_id, g.current_user["id"]), fetch=True)
    if result:
        return jsonify({"success": True})
    return error("Пост не найден или недоступен", 404, "not_found")


@main.delete("/api/posts/<int:post_id>")
@auth_required
def delete_post(post_id):
    result = execute_query("DELETE FROM posts WHERE id=%s AND user_id=%s AND deleted_at IS NULL RETURNING id", (post_id, g.current_user["id"]), fetch=True)
    return (jsonify({"success": True}), 200) if result else error("Пост не найден или недоступен", 404, "not_found")


@main.delete("/api/posts/<int:post_id>/moderate")
@admin_required
def moderate_post(post_id):
    data = request.get_json(silent=True) or {}
    reason = data.get("reason")
    if reason is not None:
        reason = str(reason).strip()
        if not reason:
            reason = None
        elif reason not in MODERATION_REASONS:
            return error("Недопустимая причина модерации")

    with transaction() as cursor:
        cursor.execute(_query("SELECT id,user_id,image_path FROM posts WHERE id=%s AND deleted_at IS NULL"), (post_id,))
        post = cursor.fetchone()
        if not post:
            return error("Пост не найден", 404, "not_found")
        post = dict(post)
        cursor.execute(
            _query("UPDATE posts SET deleted_at=CURRENT_TIMESTAMP,moderated_by=%s,moderation_reason=%s,updated_at=CURRENT_TIMESTAMP WHERE id=%s"),
            (g.current_user["id"], reason, post_id),
        )
        cursor.execute(
            _query("INSERT INTO post_moderation_audit(moderator_user_id,post_id,post_author_id,reason) VALUES(%s,%s,%s,%s)"),
            (g.current_user["id"], post_id, post["user_id"], reason),
        )
    delete_post_upload(post["image_path"])
    return jsonify({"success": True})


@main.post("/api/like_post/<int:post_id>")
@auth_required
@rate_limit("like", 120, 60, subject=lambda: str(g.current_user["id"]))
def toggle_like(post_id):
    if not execute_query("SELECT id FROM posts WHERE id=%s AND deleted_at IS NULL", (post_id,), fetch=True):
        return error("Пост не найден", 404, "not_found")
    with transaction() as cursor:
        cursor.execute(_query("SELECT 1 FROM post_likes WHERE user_id=%s AND post_id=%s"), (g.current_user["id"], post_id))
        if cursor.fetchone():
            cursor.execute(_query("DELETE FROM post_likes WHERE user_id=%s AND post_id=%s"), (g.current_user["id"], post_id))
            action = "unlike"
        else:
            cursor.execute(_query("INSERT INTO post_likes(user_id,post_id) VALUES(%s,%s)"), (g.current_user["id"], post_id))
            action = "like"
        cursor.execute(_query("SELECT COUNT(*) AS count FROM post_likes WHERE post_id=%s"), (post_id,))
        count_row = cursor.fetchone()
    count = count_row[0] if USE_SQLITE else count_row["count"]
    return jsonify({"success": True, "action": action, "likes_count": count})


@main.post("/api/comment_post/<int:post_id>")
@main.post("/api/posts/<int:post_id>/comments")
@auth_required
@rate_limit("comment", 30, 300, subject=lambda: str(g.current_user["id"]))
def create_comment(post_id):
    content = str((request.get_json(silent=True) or {}).get("content", "")).strip()
    if not 1 <= len(content) <= current_app.config["MAX_COMMENT_LENGTH"]:
        return error("Некорректный текст комментария")
    if not execute_query("SELECT id FROM posts WHERE id=%s AND deleted_at IS NULL", (post_id,), fetch=True):
        return error("Пост не найден", 404, "not_found")
    row = execute_query("INSERT INTO comments(user_id,post_id,content) VALUES(%s,%s,%s) RETURNING id,created_at", (g.current_user["id"], post_id, content), fetch=True)
    response = {"success": True, "id": row["id"], "post_id": post_id, "user_id": g.current_user["id"], "user_name": g.current_user["name"], "user_username": g.current_user["username"], "user_avatar": g.current_user.get("avatar") or "/static/images/default-avatar.png", "content": content, "created_at": serialize_time(row)}
    return jsonify(response), 201


@main.get("/api/get_comments/<int:post_id>")
@main.get("/api/posts/<int:post_id>/comments")
@auth_required
def comments(post_id):
    if not execute_query("SELECT id FROM posts WHERE id=%s AND deleted_at IS NULL", (post_id,), fetch=True):
        return error("Пост не найден", 404, "not_found")
    try:
        limit, offset = pagination(50, 100)
    except ValueError as exc:
        return error(str(exc))
    rows = execute_query("SELECT c.id,c.user_id,c.content,c.created_at,c.updated_at,u.name AS user_name,u.username AS user_username,u.avatar AS user_avatar FROM comments c JOIN email_auth u ON u.id=c.user_id WHERE c.post_id=%s AND c.deleted_at IS NULL ORDER BY c.created_at,c.id LIMIT %s OFFSET %s", (post_id, limit, offset), fetchall=True)
    return jsonify([{**row, "created_at": serialize_time(row), "updated_at": serialize_time(row, "updated_at"), "user_avatar": row.get("user_avatar") or "/static/images/default-avatar.png"} for row in rows])


@main.put("/api/comments/<int:comment_id>")
@auth_required
def edit_comment(comment_id):
    content = str((request.get_json(silent=True) or {}).get("content", "")).strip()
    if not 1 <= len(content) <= current_app.config["MAX_COMMENT_LENGTH"]:
        return error("Некорректный комментарий")
    result = execute_query("UPDATE comments SET content=%s,updated_at=CURRENT_TIMESTAMP WHERE id=%s AND user_id=%s AND deleted_at IS NULL RETURNING id", (content, comment_id, g.current_user["id"]), fetch=True)
    return jsonify({"success": True}) if result else error("Комментарий не найден или недоступен", 404, "not_found")


@main.delete("/api/comments/<int:comment_id>")
@auth_required
def delete_comment(comment_id):
    result = execute_query("DELETE FROM comments WHERE id=%s AND user_id=%s AND deleted_at IS NULL RETURNING id", (comment_id, g.current_user["id"]), fetch=True)
    return jsonify({"success": True}) if result else error("Комментарий не найден или недоступен", 404, "not_found")


@main.delete("/api/comments/<int:comment_id>/moderate")
@admin_required
def moderate_comment(comment_id):
    data = request.get_json(silent=True) or {}
    reason = data.get("reason")
    if reason is not None:
        reason = str(reason).strip()
        if not reason:
            reason = None
        elif reason not in MODERATION_REASONS:
            return error("Недопустимая причина модерации")

    with transaction() as cursor:
        cursor.execute(
            _query("SELECT c.id,c.user_id,c.post_id FROM comments c JOIN posts p ON p.id=c.post_id WHERE c.id=%s AND c.deleted_at IS NULL AND p.deleted_at IS NULL"),
            (comment_id,),
        )
        comment = cursor.fetchone()
        if not comment:
            return error("Комментарий не найден", 404, "not_found")
        comment = dict(comment)
        cursor.execute(
            _query("UPDATE comments SET deleted_at=CURRENT_TIMESTAMP,moderated_by=%s,moderation_reason=%s,updated_at=CURRENT_TIMESTAMP WHERE id=%s"),
            (g.current_user["id"], reason, comment_id),
        )
        cursor.execute(
            _query("INSERT INTO comment_moderation_audit(moderator_user_id,comment_id,comment_author_id,post_id,reason) VALUES(%s,%s,%s,%s,%s)"),
            (g.current_user["id"], comment_id, comment["user_id"], comment["post_id"], reason),
        )
    return jsonify({"success": True})


@main.post("/api/follow/<int:user_id>")
@auth_required
def toggle_follow(user_id):
    if user_id == g.current_user["id"]:
        return error("Нельзя подписаться на себя")
    if not execute_query("SELECT id FROM email_auth WHERE id=%s", (user_id,), fetch=True):
        return error("Пользователь не найден", 404, "not_found")
    with transaction() as cursor:
        cursor.execute(_query("SELECT 1 FROM follows WHERE follower_id=%s AND following_id=%s"), (g.current_user["id"], user_id))
        if cursor.fetchone():
            cursor.execute(_query("DELETE FROM follows WHERE follower_id=%s AND following_id=%s"), (g.current_user["id"], user_id))
            action = "unfollow"
        else:
            cursor.execute(_query("INSERT INTO follows(follower_id,following_id) VALUES(%s,%s)"), (g.current_user["id"], user_id))
            action = "follow"
        cursor.execute(_query("SELECT COUNT(*) AS count FROM follows WHERE following_id=%s"), (user_id,))
        row = cursor.fetchone()
    return jsonify({"success": True, "action": action, "followers_count": row[0] if USE_SQLITE else row["count"]})


@main.get("/api/search_users")
@auth_required
@rate_limit("search", 60, 60, subject=lambda: str(g.current_user["id"]))
def search_users():
    query = request.args.get("q", "").strip().lower()[:80]
    if len(query) < 2:
        return jsonify({"success": True, "users": []})
    pattern = f"%{query}%"
    rows = execute_query("SELECT u.id,u.name,u.username,u.avatar,u.bio,(SELECT COUNT(*) FROM follows f WHERE f.following_id=u.id) AS followers_count,EXISTS(SELECT 1 FROM follows f WHERE f.follower_id=%s AND f.following_id=u.id) AS is_following FROM email_auth u WHERE u.id<>%s AND (LOWER(u.name) LIKE %s OR LOWER(u.username) LIKE %s) ORDER BY followers_count DESC,u.id LIMIT 20", (g.current_user["id"], g.current_user["id"], pattern, pattern), fetchall=True)
    return jsonify({"success": True, "users": [{**row, "is_following": bool(row["is_following"]), "avatar": row.get("avatar") or "/static/images/default-avatar.png"} for row in rows]})


@main.get("/api/get_user/<int:user_id>")
@auth_required
def get_user(user_id):
    row = execute_query("SELECT u.id,u.name,u.username,u.avatar,u.bio,u.created_at,(SELECT COUNT(*) FROM follows WHERE following_id=u.id) AS followers_count,(SELECT COUNT(*) FROM follows WHERE follower_id=u.id) AS following_count,EXISTS(SELECT 1 FROM follows WHERE follower_id=%s AND following_id=u.id) AS is_following FROM email_auth u WHERE u.id=%s", (g.current_user["id"], user_id), fetch=True)
    if not row:
        return error("Пользователь не найден", 404, "not_found")
    row["is_following"] = bool(row["is_following"])
    row["created_at"] = serialize_time(row)
    return jsonify({"success": True, "user": row})


@main.get("/api/get_user_posts/<int:user_id>")
@auth_required
def user_posts(user_id):
    rows = execute_query(POST_SELECT + " AND p.user_id=%s ORDER BY p.created_at DESC LIMIT 100", (g.current_user["id"], user_id), fetchall=True)
    return jsonify([serialize_post(row) for row in rows])


@main.post("/api/conversations")
@auth_required
def create_conversation():
    recipient_id = (request.get_json(silent=True) or {}).get("recipient_id")
    if not isinstance(recipient_id, int) or recipient_id == g.current_user["id"]:
        return error("Некорректный получатель")
    if not execute_query("SELECT id FROM email_auth WHERE id=%s", (recipient_id,), fetch=True):
        return error("Пользователь не найден", 404, "not_found")
    existing = execute_query("SELECT cp.conversation_id FROM conversation_participants cp JOIN conversation_participants other ON other.conversation_id=cp.conversation_id WHERE cp.user_id=%s AND other.user_id=%s AND (SELECT COUNT(*) FROM conversation_participants x WHERE x.conversation_id=cp.conversation_id)=2 LIMIT 1", (g.current_user["id"], recipient_id), fetch=True)
    if existing:
        return jsonify({"success": True, "conversation_id": existing["conversation_id"]})
    with transaction() as cursor:
        cursor.execute("INSERT INTO conversations DEFAULT VALUES RETURNING id")
        row = cursor.fetchone()
        conversation_id = row[0] if USE_SQLITE else row["id"]
        cursor.execute(_query("INSERT INTO conversation_participants(conversation_id,user_id) VALUES(%s,%s)"), (conversation_id, g.current_user["id"]))
        cursor.execute(_query("INSERT INTO conversation_participants(conversation_id,user_id) VALUES(%s,%s)"), (conversation_id, recipient_id))
    return jsonify({"success": True, "conversation_id": conversation_id}), 201


def conversation_access(conversation_id):
    return execute_query("SELECT 1 AS ok FROM conversation_participants WHERE conversation_id=%s AND user_id=%s", (conversation_id, g.current_user["id"]), fetch=True)


@main.get("/api/conversations")
@auth_required
def conversations():
    rows = execute_query("SELECT c.id,c.updated_at,(SELECT m.content FROM messages m WHERE m.conversation_id=c.id ORDER BY m.created_at DESC,m.id DESC LIMIT 1) AS last_message FROM conversations c JOIN conversation_participants cp ON cp.conversation_id=c.id WHERE cp.user_id=%s ORDER BY c.updated_at DESC LIMIT 100", (g.current_user["id"],), fetchall=True)
    return jsonify({"success": True, "items": rows})


@main.get("/api/conversations/<int:conversation_id>/messages")
@auth_required
def messages(conversation_id):
    if not conversation_access(conversation_id):
        return error("Диалог не найден", 404, "not_found")
    try:
        limit, offset = pagination(50, 100)
    except ValueError as exc:
        return error(str(exc))
    rows = execute_query("SELECT m.id,m.sender_id,m.content,m.created_at,m.edited_at,u.name AS sender_name,u.username AS sender_username FROM messages m JOIN email_auth u ON u.id=m.sender_id WHERE m.conversation_id=%s ORDER BY m.created_at,m.id LIMIT %s OFFSET %s", (conversation_id, limit, offset), fetchall=True)
    return jsonify({"success": True, "items": rows})


@main.post("/api/conversations/<int:conversation_id>/messages")
@auth_required
@rate_limit("message", 60, 60, subject=lambda: str(g.current_user["id"]))
def send_message(conversation_id):
    if not conversation_access(conversation_id):
        return error("Диалог не найден", 404, "not_found")
    content = str((request.get_json(silent=True) or {}).get("content", "")).strip()
    if not 1 <= len(content) <= current_app.config["MAX_MESSAGE_LENGTH"]:
        return error("Некорректное сообщение")
    with transaction() as cursor:
        cursor.execute(_query("INSERT INTO messages(conversation_id,sender_id,content) VALUES(%s,%s,%s) RETURNING id,created_at"), (conversation_id, g.current_user["id"], content))
        row = cursor.fetchone()
        cursor.execute(_query("UPDATE conversations SET updated_at=CURRENT_TIMESTAMP WHERE id=%s"), (conversation_id,))
    result = dict(row) if not USE_SQLITE else {"id": row[0], "created_at": row[1]}
    return jsonify({"success": True, "message": {**result, "sender_id": g.current_user["id"], "content": content}}), 201


@main.get("/api/notifications")
@auth_required
def notifications():
    rows = execute_query("SELECT id,actor_id,kind,entity_id,read_at,created_at FROM notifications WHERE user_id=%s ORDER BY created_at DESC LIMIT 100", (g.current_user["id"],), fetchall=True)
    return jsonify({"success": True, "items": rows})
