ALTER TABLE email_auth ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT 0;
ALTER TABLE posts ADD COLUMN deleted_at TIMESTAMP;
ALTER TABLE posts ADD COLUMN moderated_by INTEGER;
ALTER TABLE posts ADD COLUMN moderation_reason TEXT;

CREATE TABLE IF NOT EXISTS post_moderation_audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    moderator_user_id INTEGER NOT NULL REFERENCES email_auth(id),
    post_id INTEGER NOT NULL REFERENCES posts(id),
    post_author_id INTEGER NOT NULL REFERENCES email_auth(id),
    reason TEXT CHECK (reason IS NULL OR reason IN ('prohibited_content', 'spam', 'harassment', 'other')),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_posts_visible_feed ON posts(created_at DESC, id DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_post_moderation_audit_post ON post_moderation_audit(post_id, created_at DESC);
