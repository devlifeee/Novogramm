# Appwrite Cloud deployment

Novogramm consists of a static React frontend, a Flask API, and PostgreSQL.
Appwrite Sites can host the frontend. The API must be deployed separately as an
Appwrite Function or another container host, and it must use a network-accessible
PostgreSQL database. A local Docker database is not reachable from Appwrite Cloud.

## Frontend site

Create an Appwrite Site connected to this repository with these settings:

- Root directory: `frontend`
- Runtime: Node.js 22
- Install command: `npm ci`
- Build command: `npm run build`
- Output directory: `dist`
- SPA fallback: `index.html`

Add this build variable to the Site:

```text
API_BASE_URL=https://your-api-domain.example
RECAPTCHA_SITE_KEY=your-v2-checkbox-site-key
```

`RECAPTCHA_SITE_KEY` is the public key for a reCAPTCHA **v2 Checkbox** key pair.
Do not add backend secrets to Site build variables. Values embedded in a frontend
bundle are public. Appwrite reserves `APPWRITE_*` names; these names are intentionally
non-reserved.

## Backend runtime variables

Configure these only on the API/Function side:

```text
APP_ENV=production
DEBUG=false
USE_SQLITE=false
DATABASE_URL=postgresql://...
PG_SSLMODE=require
SECRET_KEY=...
TOKEN_HASH_KEY=...
FRONTEND_URL=https://your-site-domain
CORS_ORIGINS=https://your-site-domain
RECAPTCHA_DISABLED=false
RECAPTCHA_SECRET_KEY=...
GMAIL_CLIENT_ID=...
GMAIL_CLIENT_SECRET=...
GMAIL_REFRESH_TOKEN=...
EMAIL_FROM=novogramm.corporation@gmail.com
UPLOAD_DIR=/data/uploads
```

Generate `SECRET_KEY` and `TOKEN_HASH_KEY` independently with at least 32 random
bytes. Never commit these values.

For Gmail API authorization, run this locally (never on Railway) after downloading
the **Desktop** OAuth client JSON:

```bash
python scripts/gmail_oauth_refresh_token.py /path/to/client_secret_....json
```

The helper opens a browser, requests only `https://www.googleapis.com/auth/gmail.send`,
and prints a refresh token for manual insertion as `GMAIL_REFRESH_TOKEN`. Set the
Google OAuth consent screen publishing status to **In production** before obtaining
the Railway token. Testing status refresh tokens expire after seven days for this
sensitive scope. Do not upload the client JSON or any token to Appwrite or Railway
source control.

## Required order

1. Provision external PostgreSQL and allow encrypted connections.
2. Deploy the API and verify `/health/ready`.
3. Create the Appwrite Site with `API_BASE_URL` pointing to the API.
4. Set the final Site domain in backend `FRONTEND_URL` and `CORS_ORIGINS`.
5. Rebuild the Site and test registration, login, uploads, posts, and chats.

## Railway persistent uploads

Attach a Railway Volume to the Flask API service (not the Appwrite Site) with
mount path `/data/uploads`, then set `UPLOAD_DIR=/data/uploads` in that API
service. Railway mounts volumes as root; if the service is not already running
as root, also set `RAILWAY_RUN_UID=0` so Flask can create `avatars/` and
`posts/` at startup. The API continues to return `/static/uploads/...` URLs;
the frontend resolves those URLs against `API_BASE_URL`, so media is fetched
from Railway rather than the Appwrite Site.

No database migration or URL rewrite is required. For existing uploads from a
pre-volume deployment, copy `backend/app/static/uploads/{avatars,posts}` into
the corresponding directories on the new volume before retiring the old
deployment; otherwise only those ephemeral files are lost.

The repository `.env` is ignored by Git. `.env.example` is a public template only.
