ALTER TABLE email_auth ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS moderated_by BIGINT;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS moderation_reason TEXT;

CREATE TABLE IF NOT EXISTS post_moderation_audit (
    id BIGSERIAL PRIMARY KEY,
    moderator_user_id BIGINT NOT NULL REFERENCES email_auth(id),
    post_id BIGINT NOT NULL REFERENCES posts(id),
    post_author_id BIGINT NOT NULL REFERENCES email_auth(id),
    reason TEXT CHECK (reason IS NULL OR reason IN ('prohibited_content', 'spam', 'harassment', 'other')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_posts_visible_feed ON posts(created_at DESC, id DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_post_moderation_audit_post ON post_moderation_audit(post_id, created_at DESC);
