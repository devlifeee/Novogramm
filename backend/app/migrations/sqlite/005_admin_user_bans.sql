ALTER TABLE email_auth ADD COLUMN banned_at TIMESTAMP;
ALTER TABLE email_auth ADD COLUMN banned_by INTEGER REFERENCES email_auth(id);
ALTER TABLE email_auth ADD COLUMN ban_reason TEXT;
ALTER TABLE email_auth ADD COLUMN clown_hat_at TIMESTAMP;
ALTER TABLE email_auth ADD COLUMN clown_hat_by INTEGER REFERENCES email_auth(id);

CREATE TABLE IF NOT EXISTS user_ban_audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    moderator_user_id INTEGER NOT NULL REFERENCES email_auth(id),
    user_id INTEGER NOT NULL REFERENCES email_auth(id),
    action TEXT NOT NULL CHECK (action IN ('ban', 'unban')),
    reason TEXT CHECK (reason IS NULL OR reason IN ('prohibited_content', 'spam', 'harassment', 'other')),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_email_auth_banned_at ON email_auth(banned_at) WHERE banned_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_ban_audit_user ON user_ban_audit(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS user_clown_hat_audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    moderator_user_id INTEGER NOT NULL REFERENCES email_auth(id),
    user_id INTEGER NOT NULL REFERENCES email_auth(id),
    action TEXT NOT NULL CHECK (action IN ('assign', 'remove')),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_clown_hat_audit_user ON user_clown_hat_audit(user_id, created_at DESC);
