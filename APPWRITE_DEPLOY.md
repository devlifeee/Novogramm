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
EMAIL_USER=...
EMAIL_PASSWORD=...
```

Generate `SECRET_KEY` and `TOKEN_HASH_KEY` independently with at least 32 random
bytes. Never commit these values.

## Required order

1. Provision external PostgreSQL and allow encrypted connections.
2. Deploy the API and verify `/health/ready`.
3. Create the Appwrite Site with `API_BASE_URL` pointing to the API.
4. Set the final Site domain in backend `FRONTEND_URL` and `CORS_ORIGINS`.
5. Rebuild the Site and test registration, login, uploads, posts, and chats.

The repository `.env` is ignored by Git. `.env.example` is a public template only.
