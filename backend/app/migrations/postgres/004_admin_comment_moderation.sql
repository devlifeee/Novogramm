ALTER TABLE comments ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS moderated_by BIGINT;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS moderation_reason TEXT;

CREATE TABLE IF NOT EXISTS comment_moderation_audit (
    id BIGSERIAL PRIMARY KEY,
    moderator_user_id BIGINT NOT NULL REFERENCES email_auth(id),
    comment_id BIGINT NOT NULL REFERENCES comments(id),
    comment_author_id BIGINT NOT NULL REFERENCES email_auth(id),
    post_id BIGINT NOT NULL REFERENCES posts(id),
    reason TEXT CHECK (reason IS NULL OR reason IN ('prohibited_content', 'spam', 'harassment', 'other')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_comments_visible_post ON comments(post_id, created_at, id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_comment_moderation_audit_comment ON comment_moderation_audit(comment_id, created_at DESC);
