from io import BytesIO

from app.database import execute_query


PNG = b"\x89PNG\r\n\x1a\nNovogramm-moderation-image"


def headers(user):
    return {"Authorization": f"Bearer {user['token']}"}


def promote_to_admin(user):
    execute_query("UPDATE email_auth SET is_admin=%s WHERE id=%s", (True, user["id"]))


def test_anonymous_user_cannot_moderate_post(client):
    assert client.delete("/api/posts/1/moderate").status_code == 401


def test_normal_user_cannot_moderate_another_users_post(client, users):
    owner, other_user = users
    post = client.post("/api/posts", json={"content": "owner post"}, headers=headers(owner)).get_json()["post"]

    assert client.delete(f"/api/posts/{post['id']}/moderate", headers=headers(other_user)).status_code == 403
    assert client.get(f"/api/posts/{post['id']}", headers=headers(owner)).status_code == 200


def test_admin_moderation_hides_comment_and_writes_audit(client, users):
    owner, admin = users
    promote_to_admin(admin)
    post = client.post("/api/posts", json={"content": "post"}, headers=headers(owner)).get_json()["post"]
    comment = client.post(f"/api/posts/{post['id']}/comments", json={"content": "unsafe comment"}, headers=headers(owner)).get_json()

    assert client.delete(f"/api/comments/{comment['id']}/moderate", headers=headers(owner)).status_code == 403
    response = client.delete(
        f"/api/comments/{comment['id']}/moderate",
        json={"reason": "harassment"},
        headers=headers(admin),
    )
    assert response.status_code == 200
    assert client.get(f"/api/posts/{post['id']}/comments", headers=headers(owner)).get_json() == []
    assert client.delete(f"/api/comments/{comment['id']}", headers=headers(owner)).status_code == 404
    assert client.delete(f"/api/comments/{comment['id']}/moderate", headers=headers(admin)).status_code == 404

    audit = execute_query(
        "SELECT moderator_user_id,comment_id,comment_author_id,post_id,reason,created_at FROM comment_moderation_audit WHERE comment_id=%s",
        (comment["id"],),
        fetch=True,
    )
    assert audit["moderator_user_id"] == admin["id"]
    assert audit["comment_author_id"] == owner["id"]
    assert audit["post_id"] == post["id"]
    assert audit["reason"] == "harassment"
    assert audit["created_at"] is not None


def test_admin_moderation_hides_post_removes_image_and_writes_audit(client, app, users, tmp_path, monkeypatch):
    from app import initialize_upload_directories

    owner, admin = users
    promote_to_admin(admin)
    monkeypatch.setitem(app.config, "UPLOAD_DIR", str(tmp_path / "uploads"))
    initialize_upload_directories(app)
    created = client.post(
        "/api/posts",
        data={"content": "moderated image post", "image": (BytesIO(PNG), "post.png")},
        headers=headers(owner),
    ).get_json()["post"]
    image_path = tmp_path / "uploads" / "posts" / created["image_path"].rsplit("/", 1)[1]
    assert image_path.is_file()

    response = client.delete(
        f"/api/posts/{created['id']}/moderate",
        json={"reason": "spam"},
        headers=headers(admin),
    )
    assert response.status_code == 200
    assert not image_path.exists()
    assert client.get(f"/api/posts/{created['id']}", headers=headers(owner)).status_code == 404
    assert all(post["id"] != created["id"] for post in client.get("/get_posts", headers=headers(owner)).get_json())
    assert client.get(f"/api/get_user_posts/{owner['id']}", headers=headers(owner)).get_json() == []
    assert client.get(f"/api/posts/{created['id']}/comments", headers=headers(owner)).status_code == 404

    audit = execute_query(
        "SELECT moderator_user_id,post_id,post_author_id,reason,created_at FROM post_moderation_audit WHERE post_id=%s",
        (created["id"],),
        fetch=True,
    )
    assert audit["moderator_user_id"] == admin["id"]
    assert audit["post_author_id"] == owner["id"]
    assert audit["reason"] == "spam"
    assert audit["created_at"] is not None
    assert client.delete("/api/posts/999999/moderate", headers=headers(admin)).status_code == 404


def test_moderation_never_deletes_a_path_outside_upload_dir(client, app, users, tmp_path, monkeypatch):
    from app import initialize_upload_directories

    owner, admin = users
    promote_to_admin(admin)
    monkeypatch.setitem(app.config, "UPLOAD_DIR", str(tmp_path / "uploads"))
    initialize_upload_directories(app)
    post = client.post("/api/posts", json={"content": "unsafe image path"}, headers=headers(owner)).get_json()["post"]
    outside_file = tmp_path / "outside.png"
    outside_file.write_bytes(PNG)
    execute_query("UPDATE posts SET image_path=%s WHERE id=%s", ("/static/uploads/posts/../../outside.png", post["id"]))

    assert client.delete(f"/api/posts/{post['id']}/moderate", headers=headers(admin)).status_code == 200
    assert outside_file.is_file()
