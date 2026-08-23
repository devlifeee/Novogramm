# Novogramm

Социальная сеть на React, Flask и PostgreSQL. PostgreSQL является production source of truth; SQLite поддерживается только для локальной разработки и тестов.

## Локальный запуск через Docker

```bash
cp .env.example .env
# замените SECRET_KEY и PG_PASSWORD; для локального режима можно оставить
# RECAPTCHA_DISABLED=true и SKIP_EMAIL_VERIFICATION=true
docker compose up --build
```

Frontend: `http://localhost:8888`. API: `http://localhost:3000`.

При первом старте backend автоматически применяет идемпотентные SQL-миграции из `backend/app/migrations/postgres`. Состояние PostgreSQL хранится в volume `postgres_data` и переживает рестарт контейнеров.

## Запуск без Docker

Требуются Python 3.12+, Node 22+ и PostgreSQL 16+.

```bash
python -m venv .venv
.venv/bin/pip install -r requirements-dev.txt
npm --prefix frontend ci
cp .env.example .env
# PG_HOST=localhost, USE_SQLITE=false
.venv/bin/python run.py
npm --prefix frontend start
```

Для временной SQLite-разработки задайте `USE_SQLITE=true`; production-конфигурация с SQLite отклоняется при старте.

## Проверка

```bash
PYTHONPATH=backend .venv/bin/python -m pytest -q
.venv/bin/ruff check backend tests run.py
.venv/bin/python -m compileall -q backend run.py
npm --prefix frontend run build
npm --prefix frontend audit --omit=dev
```

## Health checks

- `GET /health/live` — процесс Flask жив.
- `GET /health/ready` — критическая БД принимает запросы.
- `GET /health` — совместимый liveness endpoint.

## Production configuration

Обязательны `APP_ENV=production`, сильный `SECRET_KEY`, `USE_SQLITE=false`, PostgreSQL credentials или `DATABASE_URL`, `PG_SSLMODE=require`, точный `CORS_ORIGINS`, включённая reCAPTCHA и Gmail API (`GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`, `EMAIL_FROM`). `EMAIL_FROM=novogramm.corporation@gmail.com`; refresh token создаётся только со scope `https://www.googleapis.com/auth/gmail.send`. Секреты передаются secret manager платформы, не `.env` в image/repository.

Для Railway uploads создайте Volume на API service с mount path `/data/uploads` и задайте `UPLOAD_DIR=/data/uploads`. Railway volume принадлежит root; при non-root runtime задайте также `RAILWAY_RUN_UID=0`. Flask создаёт `avatars/` и `posts/` при старте и раздаёт их по прежним URL `/static/uploads/...`; Appwrite frontend направляет эти URL на `API_BASE_URL`. `UPLOAD_FOLDER` остаётся fallback для старых local deploys.

SMS OTP поддерживает provider adapter `SMS_PROVIDER=webhook`. Настройте `SMS_WEBHOOK_URL`, `SMS_WEBHOOK_TOKEN` и `SMS_FROM`. Сервер отправляет провайдеру `{to, from, message}`; ключ никогда не попадает во frontend. `console` разрешён только вне production и намеренно не выводит OTP в лог. Appwrite не добавлен: существующая email/password auth архитектура не выигрывает от переноса, а PostgreSQL остаётся основной БД. Appwrite можно подключить за webhook-adapter без изменения application schema.

Запуск backend в production:

```bash
gunicorn run:app --bind 0.0.0.0:3000 --workers 2 --threads 4 --timeout 30
```

Reverse proxy обязан завершать HTTPS, ограничивать request body не выше `MAX_REQUEST_BYTES`, проксировать `/api`, auth endpoints и `/static/uploads`, а frontend раздавать как статический production build. Не публикуйте PostgreSQL port наружу. При переходе с filesystem без volume URL в PostgreSQL менять не нужно: скопируйте `backend/app/static/uploads/{avatars,posts}` в Volume до отключения старого deployment.

## Backup и восстановление

Ежедневно выполняйте encrypted `pg_dump --format=custom`, храните копии вне основного сервера с retention и access control. Пример команд (credentials берутся из окружения/`.pgpass`):

```bash
pg_dump --format=custom --no-owner --file=novogramm.dump "$DATABASE_URL"
pg_restore --clean --if-exists --no-owner --dbname="$RESTORE_DATABASE_URL" novogramm.dump
```

Раз в месяц выполняйте restore drill в изолированную БД и smoke tests. Каталог media uploads также архивируется, шифруется и восстанавливается согласованно с дампом БД. Для object storage включите versioning/lifecycle policy.

## Примечание по существующему Docker volume

Если volume был создан старой конфигурацией с другими PostgreSQL credentials, не удаляйте его вслепую. Сначала сделайте `pg_dump`, создайте новый volume с текущими credentials и восстановите дамп.
# railway deploy trigger
