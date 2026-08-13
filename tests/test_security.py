def headers(user):
    return {"Authorization": f"Bearer {user['token']}"}


def test_protected_endpoint_denies_anonymous(client):
    assert client.get("/api/profile").status_code == 401


def test_user_cannot_edit_or_delete_another_users_post(client, users):
    owner, attacker = users
    created = client.post("/api/posts", json={"content": "owner post"}, headers=headers(owner)).get_json()["post"]
    assert client.put(f"/api/posts/{created['id']}", json={"content": "stolen"}, headers=headers(attacker)).status_code == 404
    assert client.delete(f"/api/posts/{created['id']}", headers=headers(attacker)).status_code == 404
    assert client.get(f"/api/posts/{created['id']}", headers=headers(owner)).get_json()["post"]["content"] == "owner post"


def test_user_cannot_delete_another_users_comment(client, users):
    owner, attacker = users
    post = client.post("/api/posts", json={"content": "post"}, headers=headers(owner)).get_json()["post"]
    comment = client.post(f"/api/posts/{post['id']}/comments", json={"content": "comment"}, headers=headers(owner)).get_json()
    assert client.delete(f"/api/comments/{comment['id']}", headers=headers(attacker)).status_code == 404


def test_self_follow_rejected_and_follow_is_toggle(client, users):
    first, second = users
    assert client.post(f"/api/follow/{first['id']}", headers=headers(first)).status_code == 400
    assert client.post(f"/api/follow/{second['id']}", headers=headers(first)).get_json()["action"] == "follow"
    assert client.post(f"/api/follow/{second['id']}", headers=headers(first)).get_json()["action"] == "unfollow"


def test_private_conversation_is_not_readable_by_outsider(client, users):
    first, second = users
    conversation = client.post("/api/conversations", json={"recipient_id": second["id"]}, headers=headers(first)).get_json()["conversation_id"]
    from conftest import create_user
    outsider = create_user(client, "outsider")
    assert client.get(f"/api/conversations/{conversation}/messages", headers=headers(outsider)).status_code == 404


def test_mass_assignment_is_rejected(client, users):
    first, _ = users
    response = client.put("/api/profile", json={"name": "Admin", "role": "admin"}, headers=headers(first))
    assert response.status_code == 400


def test_oversized_post_is_rejected(client, users):
    first, _ = users
    assert client.post("/api/posts", json={"content": "x" * 5001}, headers=headers(first)).status_code == 400


def test_logout_revokes_session(client, users):
    first, _ = users
    assert client.post("/logout", headers=headers(first)).status_code == 200
    assert client.get("/api/profile", headers=headers(first)).status_code == 401
