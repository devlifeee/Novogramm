ALTER TABLE email_auth ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE email_auth ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ;
ALTER TABLE email_auth ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE email_auth ADD COLUMN IF NOT EXISTS bio TEXT NOT NULL DEFAULT '';
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_auth_phone ON email_auth(phone) WHERE phone IS NOT NULL;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='verification_codes' AND column_name='email') THEN
        ALTER TABLE verification_codes RENAME TO verification_codes_legacy;
        CREATE TABLE verification_codes (
            id BIGSERIAL PRIMARY KEY, subject TEXT NOT NULL,
            purpose TEXT NOT NULL CHECK (purpose IN ('email','phone')),
            code_hash TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL,
            attempts INTEGER NOT NULL DEFAULT 0,
            last_sent_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            consumed_at TIMESTAMPTZ, UNIQUE(subject,purpose)
        );
        DROP TABLE verification_codes_legacy;
    END IF;
END $$;
