from io import BytesIO


PNG = b"\x89PNG\r\n\x1a\nNovogramm-test-image"


def headers(user):
    return {"Authorization": f"Bearer {user['token']}"}


def test_uploads_use_configured_root_and_keep_existing_urls(client, app, users, tmp_path, monkeypatch):
    from app import initialize_upload_directories

    monkeypatch.setitem(app.config, "UPLOAD_DIR", str(tmp_path / "uploads"))
    initialize_upload_directories(app)
    assert (tmp_path / "uploads" / "avatars").is_dir()
    assert (tmp_path / "uploads" / "posts").is_dir()

    user, _ = users
    avatar = client.post(
        "/api/profile/avatar",
        data={"avatar": (BytesIO(PNG), "../../avatar.png")},
        headers=headers(user),
    )
    assert avatar.status_code == 200
    avatar_url = avatar.get_json()["avatar_url"]
    assert avatar_url.startswith("/static/uploads/avatars/")
    assert client.get(avatar_url).data == PNG

    post = client.post(
        "/api/posts",
        data={"content": "image post", "image": (BytesIO(PNG), "post.png")},
        headers=headers(user),
    )
    assert post.status_code == 201
    image_path = post.get_json()["post"]["image_path"]
    assert image_path.startswith("/static/uploads/posts/")
    assert client.get(image_path).data == PNG
    assert client.get("/static/uploads/posts/..%2Fconfig.py").status_code == 404
