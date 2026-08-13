import contextlib
import sqlite3
import threading
from datetime import datetime
from pathlib import Path

from psycopg2 import pool
from psycopg2.extras import RealDictCursor

from .config import Config


USE_SQLITE = Config.USE_SQLITE
sqlite3.register_adapter(datetime, lambda value: value.isoformat())


class PostgreSQL:
    _pool = None
    _lock = threading.Lock()
    app = None

    @classmethod
    def init_app(cls, app):
        cls.app = app
        if USE_SQLITE:
            Path(Config.SQLITE_PATH).parent.mkdir(parents=True, exist_ok=True)
        else:
            cls.get_connection_pool()

    @classmethod
    def _pg_kwargs(cls):
        if Config.DATABASE_URL:
            return {"dsn": Config.DATABASE_URL}
        return {
            "host": Config.PG_HOST,
            "port": Config.PG_PORT,
            "user": Config.PG_USER,
            "password": Config.PG_PASSWORD,
            "database": Config.PG_DATABASE,
            "sslmode": Config.PG_SSLMODE,
        }

    @classmethod
    def get_connection_pool(cls):
        with cls._lock:
            if cls._pool is None:
                kwargs = cls._pg_kwargs()
                dsn = kwargs.pop("dsn", None)
                cls._pool = pool.ThreadedConnectionPool(1, 20, dsn, **kwargs)
            return cls._pool

    @classmethod
    def get_connection(cls):
        if USE_SQLITE:
            connection = sqlite3.connect(Config.SQLITE_PATH, timeout=10)
            connection.row_factory = sqlite3.Row
            connection.execute("PRAGMA foreign_keys = ON")
            return connection
        return cls.get_connection_pool().getconn()

    @classmethod
    def return_connection(cls, connection):
        if USE_SQLITE:
            connection.close()
        elif cls._pool:
            cls._pool.putconn(connection)

    @classmethod
    def close_all_connections(cls):
        if cls._pool:
            cls._pool.closeall()
            cls._pool = None


def _query(sql: str) -> str:
    return sql.replace("%s", "?") if USE_SQLITE else sql


@contextlib.contextmanager
def transaction():
    connection = PostgreSQL.get_connection()
    cursor = connection.cursor() if USE_SQLITE else connection.cursor(cursor_factory=RealDictCursor)
    try:
        yield cursor
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        cursor.close()
        PostgreSQL.return_connection(connection)


def execute_query(query, params=None, fetch=False, fetchall=False):
    with transaction() as cursor:
        cursor.execute(_query(query), params or ())
        if fetch:
            row = cursor.fetchone()
            return dict(row) if row else None
        if fetchall:
            return [dict(row) for row in cursor.fetchall()]
        return None


def database_ready() -> bool:
    try:
        return execute_query("SELECT 1 AS ok", fetch=True)["ok"] == 1
    except Exception:
        return False


def run_migrations():
    migrations_dir = Path(__file__).resolve().parent / "migrations" / ("sqlite" if USE_SQLITE else "postgres")
    with transaction() as cursor:
        if not USE_SQLITE:
            # Gunicorn workers can boot concurrently. Keep schema upgrades single-writer.
            cursor.execute("SELECT pg_advisory_xact_lock(74201337)")
        if USE_SQLITE:
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='email_auth'")
            if cursor.fetchone():
                cursor.execute("PRAGMA table_info(email_auth)")
                user_columns = {row[1] for row in cursor.fetchall()}
                for name, definition in {
                    "phone": "TEXT UNIQUE", "phone_verified_at": "TIMESTAMP",
                    "updated_at": "TIMESTAMP", "bio": "TEXT NOT NULL DEFAULT ''",
                }.items():
                    if name not in user_columns:
                        # SQLite cannot add a UNIQUE column; uniqueness is added as an index below.
                        safe_definition = "TEXT" if name == "phone" else definition
                        cursor.execute(f"ALTER TABLE email_auth ADD COLUMN {name} {safe_definition}")
                cursor.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_email_auth_phone ON email_auth(phone) WHERE phone IS NOT NULL")
            for table in ("posts", "comments"):
                cursor.execute(f"SELECT name FROM sqlite_master WHERE type='table' AND name='{table}'")
                if cursor.fetchone():
                    cursor.execute(f"PRAGMA table_info({table})")
                    if "updated_at" not in {row[1] for row in cursor.fetchall()}:
                        cursor.execute(f"ALTER TABLE {table} ADD COLUMN updated_at TIMESTAMP")
                        cursor.execute(f"UPDATE {table} SET updated_at=created_at WHERE updated_at IS NULL")
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='verification_codes'")
            if cursor.fetchone():
                cursor.execute("PRAGMA table_info(verification_codes)")
                if "subject" not in {row[1] for row in cursor.fetchall()}:
                    cursor.execute("ALTER TABLE verification_codes RENAME TO verification_codes_legacy")
        cursor.execute(
            "CREATE TABLE IF NOT EXISTS schema_migrations (version VARCHAR(255) PRIMARY KEY, applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)"
        )
        cursor.execute("SELECT version FROM schema_migrations")
        applied = {row[0] if USE_SQLITE else row["version"] for row in cursor.fetchall()}
        for migration in sorted(migrations_dir.glob("*.sql")):
            if migration.name in applied:
                continue
            sql = migration.read_text(encoding="utf-8")
            if USE_SQLITE:
                cursor.executescript(sql)
            else:
                cursor.execute(sql)
            cursor.execute(_query("INSERT INTO schema_migrations (version) VALUES (%s)"), (migration.name,))
        if USE_SQLITE:
            cursor.execute("DROP TABLE IF EXISTS verification_codes_legacy")


init_postgres_db = run_migrations
