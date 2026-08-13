# Security model and audit notes

## Implemented controls

- Opaque authentication sessions; only HMAC-SHA256 token hashes are stored. Logout and password reset revoke sessions.
- bcrypt password hashes (cost 12), password policy, generic login/reset responses, expiring one-use reset tokens.
- Email and phone OTP values are HMAC-hashed, expiring, attempt-limited and rate-limited. OTP values and provider secrets are never logged.
- Server-side ownership checks for posts and comments; membership checks for every private conversation operation.
- Explicit profile field allowlist prevents mass assignment. All SQL uses bound parameters.
- Pagination and maximum sizes for collection data, text bodies, request body and uploads.
- Upload signature/extension validation, random server-generated names and restricted image formats (SVG/HTML rejected).
- Exact configurable CORS allowlist, request IDs, normalized errors and baseline security headers.
- Database constraints prevent duplicate likes/follows and self-follow; foreign keys enforce ownership relations.

## Audit findings fixed

- **Critical:** plaintext bearer/reset tokens in `email_auth`; replaced by hashed, expiring session/reset tables.
- **High:** authorization was duplicated and inconsistent; centralized authentication and added ownership/membership enforcement with negative tests.
- **High:** verification codes were plaintext and logged; replaced with HMAC hashes and removed sensitive logging.
- **High:** hardcoded database credentials in tracked SQL; removed and moved to environment configuration.
- **High:** unrestricted CORS; replaced with an explicit origin allowlist.
- **Medium:** unbounded feeds/comments and weak validation; added limits, pagination and database checks.
- **Medium:** uploads trusted extensions/base64 database blobs; added signature checks, size ceiling and filesystem references.
- **Medium:** database schema was created ad hoc at startup; replaced by versioned PostgreSQL/SQLite migrations.
- **Medium:** private chat UI/API was absent; added persistent conversations/messages and membership checks.
- **Low:** missing request correlation/security headers and DB-aware readiness; added both.

## Operational requirements

Rate limiting is process-local and suitable for one instance. Multi-instance production deployment must replace it with a shared Redis/gateway limiter while retaining the endpoint/account/IP keys. Run TLS at the reverse proxy and use PostgreSQL TLS for remote databases. The application DB principal should own only the application database/schema and must not be a cluster superuser in production.

Report vulnerabilities privately to the repository owner. Do not include credentials, tokens, OTPs, personal data or exploit payloads in reports or logs.
