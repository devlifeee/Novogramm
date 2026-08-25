from app.database import execute_query


def headers(user):
    return {"Authorization": f"Bearer {user['token']}"}


def promote_to_admin(user):
    execute_query("UPDATE email_auth SET is_admin=%s WHERE id=%s", (True, user["id"]))


def test_user_ban_requires_admin_rights(client, users):
    target, regular_user = users

    assert client.post(f"/api/users/{target['id']}/ban").status_code == 401
    assert client.post(f"/api/users/{target['id']}/ban", headers=headers(regular_user)).status_code == 403


def test_admin_ban_revokes_sessions_blocks_access_and_can_be_reversed(client, users):
    target, admin = users
    promote_to_admin(admin)

    response = client.post(
        f"/api/users/{target['id']}/ban",
        json={"reason": "spam"},
        headers=headers(admin),
    )
    assert response.status_code == 200
    assert response.get_json() == {"success": True, "user_id": target["id"], "is_banned": True}

    assert client.get("/api/profile", headers=headers(target)).status_code == 401
    login = client.post("/login", json={"email": target["email"], "password": "StrongPass123"})
    assert login.status_code == 403
    assert login.get_json()["code"] == "account_banned"
    assert execute_query(
        "SELECT revoked_at FROM sessions WHERE user_id=%s ORDER BY id DESC LIMIT 1",
        (target["id"],),
        fetch=True,
    )["revoked_at"] is not None

    profile = client.get(f"/api/get_user/{target['id']}", headers=headers(admin))
    assert profile.status_code == 200
    assert profile.get_json()["user"]["is_banned"] is True

    audit = execute_query(
        "SELECT moderator_user_id,user_id,action,reason,created_at FROM user_ban_audit WHERE user_id=%s ORDER BY id DESC LIMIT 1",
        (target["id"],),
        fetch=True,
    )
    assert audit["moderator_user_id"] == admin["id"]
    assert audit["action"] == "ban"
    assert audit["reason"] == "spam"
    assert audit["created_at"] is not None

    response = client.delete(f"/api/users/{target['id']}/ban", headers=headers(admin))
    assert response.status_code == 200
    assert response.get_json() == {"success": True, "user_id": target["id"], "is_banned": False}
    assert client.get("/api/profile", headers=headers(target)).status_code == 401
    assert client.post("/login", json={"email": target["email"], "password": "StrongPass123"}).status_code == 200


def test_admin_cannot_ban_self_or_another_admin(client, users):
    target, admin = users
    promote_to_admin(admin)

    assert client.post(f"/api/users/{admin['id']}/ban", headers=headers(admin)).status_code == 400
    promote_to_admin(target)
    assert client.post(f"/api/users/{target['id']}/ban", headers=headers(admin)).status_code == 403
