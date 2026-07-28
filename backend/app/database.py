
from flask import current_app
import os
import re
import sqlite3
import psycopg2
from psycopg2 import pool, sql
from psycopg2.extras import RealDictCursor
import threading
import time

from .config import Config

# Флаг для определения, используется ли SQLite
USE_SQLITE = os.getenv('USE_SQLITE', 'true').lower() == 'true' or not all([
    os.getenv('PG_HOST'),
    os.getenv('PG_USER'),
    os.getenv('PG_PASSWORD'),
    os.getenv('PG_DATABASE')
])

class PostgreSQL:
    _connection_pool = None
    _lock = threading.Lock()
    app = None
    _sqlite_path = None

    @classmethod
    def init_app(cls, app):
        """
        Инициализирует пул соединений PostgreSQL для Flask-приложения.
        Использует SQLite если PostgreSQL недоступна.
        """
        cls.app = app
        
        if USE_SQLITE:
            print("DEBUG: Используется SQLite для разработки")
            # Инициализируем SQLite
            db_path = os.path.join(os.path.dirname(__file__), '..', 'dev.db')
            cls._sqlite_path = db_path
            
            # Инициализируем БД
            try:
                from .init_sqlite_db import init_sqlite_db
                init_sqlite_db()
                print("✅ SQLite база данных инициализирована")
            except Exception as e:
                print(f"Ошибка инициализации SQLite: {e}")
                raise
        else:
            print(f"DEBUG: Инициализация PostgreSQL...")
            print(f"DEBUG DB_CONFIG: PG_HOST={os.getenv('PG_HOST')}")
            print(f"DEBUG DB_CONFIG: PG_PORT={os.getenv('PG_PORT')}")
            print(f"DEBUG DB_CONFIG: PG_USER={os.getenv('PG_USER')}")
            print(f"DEBUG DB_CONFIG: PG_DATABASE={os.getenv('PG_DATABASE')}")

            try:
                cls.get_connection_pool()
                print("DEBUG: Пул соединений успешно создан.")
            except Exception as e:
                print(f"ОШИБКА: Произошла ошибка при инициализации PostgreSQL (в init_app): {e}")
                raise

    @classmethod
    def get_connection_pool(cls):
        """
        Возвращает или создает пул соединений.
        Для SQLite просто возвращает путь к БД.
        """
        if USE_SQLITE:
            return cls._sqlite_path
        
        with cls._lock:
            if cls._connection_pool is None:
                print(f"DEBUG: Создание нового пула соединений PostgreSQL...")
                host = os.getenv('PG_HOST')
                port = os.getenv('PG_PORT')
                user = os.getenv('PG_USER')
                password = os.getenv('PG_PASSWORD')
                database = os.getenv('PG_DATABASE')

                print(f"DEBUG: Параметры пула: Хост='{host}', Порт='{port}', Пользователь='{user}', БД='{database}'")

                # Логика повторных попыток
                retries = 15
                delay = 5
                for i in range(retries):
                    try:
                        cls._connection_pool = psycopg2.pool.SimpleConnectionPool(
                            minconn=1,
                            maxconn=20,
                            host=host,
                            port=port,
                            user=user,
                            password=password,
                            database=database
                        )
                        print(f"DEBUG: Соединение с БД установлено после попытки {i + 1}")
                        return cls._connection_pool
                    except psycopg2.OperationalError as e:
                        print(f"WARNING: Попытка {i + 1}/{retries} не удалась при подключении к БД: {e}")
                        if i < retries - 1:
                            print(f"WARNING: Ждем {delay} секунд перед следующей попыткой...")
                            time.sleep(delay)
                        else:
                            print(f"ОШИБКА: Все {retries} попыток подключения к БД провалились.")
                            raise

            return cls._connection_pool

    @classmethod
    def get_connection(cls):
        """Получает соединение из пула"""
        if USE_SQLITE:
            conn = sqlite3.connect(cls._sqlite_path)
            conn.row_factory = sqlite3.Row  # Позволяет обращаться к полям как словарь
            return conn
        
        pool = cls.get_connection_pool()
        if pool:
            return pool.getconn()
        raise Exception("Пул соединений не инициализирован")

    @classmethod
    def return_connection(cls, connection):
        """Возвращает соединение в пул"""
        if USE_SQLITE:
            if connection:
                connection.close()
        elif cls._connection_pool and connection:
            cls._connection_pool.putconn(connection)

    @classmethod
    def close_all_connections(cls):
        """Закрывает все соединения в пуле"""
        if not USE_SQLITE and cls._connection_pool:
            cls._connection_pool.closeall()
            cls._connection_pool = None

def _convert_query_for_sqlite(query):
    """Конвертирует PostgreSQL запрос в SQLite формат"""
    # Конвертируем %s параметры в ?
    import re
    query = re.sub(r'%s', '?', query)
    # Удаляем SERIAL и конвертируем в INTEGER
    query = query.replace('SERIAL PRIMARY KEY', 'INTEGER PRIMARY KEY AUTOINCREMENT')
    # Конвертируем RETURNING для SQLite
    if 'RETURNING' in query:
        # Извлекаем что нужно вернуть
        match = re.search(r'RETURNING\s+(.+?)(?:;)?$', query, re.IGNORECASE)
        if match:
            returning_cols = match.group(1).strip()
            query = re.sub(r'\s+RETURNING\s+.+?(?:;)?$', '', query, flags=re.IGNORECASE)
            # Сохраняем информацию о RETURNING для позже
            query = (query, returning_cols)
    return query

def execute_query(query, params=None, fetch=False, fetchall=False):
    """
    Универсальная функция для выполнения запросов.
    Работает с PostgreSQL и SQLite.
    query: SQL-запрос
    params: кортеж параметров для запроса
    fetch: True если нужно вернуть одну запись
    fetchall: True если нужно вернуть все записи
    """
    conn = None
    cursor = None
    try:
        conn = PostgreSQL.get_connection()
        
        if USE_SQLITE:
            # Для SQLite
            cursor = conn.cursor()
            
            # Конвертируем запрос
            returning_cols = None
            if isinstance(query, tuple):
                query, returning_cols = query
            else:
                if 'RETURNING' in query:
                    match = re.search(r'RETURNING\s+(.+?)(?:;)?$', query, re.IGNORECASE)
                    if match:
                        returning_cols = match.group(1).strip()
                        query = re.sub(r'\s+RETURNING\s+.+?(?:;)?$', '', query, flags=re.IGNORECASE)
            
            query = query.replace('%s', '?').replace('SERIAL PRIMARY KEY', 'INTEGER PRIMARY KEY AUTOINCREMENT')
            
            cursor.execute(query, params or ())
            
            if fetch:
                result = cursor.fetchone()
                if result:
                    # Конвертируем в словарь как в PostgreSQL
                    cols = [description[0] for description in cursor.description]
                    result = dict(zip(cols, result))
                    # Если есть RETURNING, добавляем последний ID
                    if returning_cols and 'id' in returning_cols.lower():
                        result['id'] = cursor.lastrowid
            elif fetchall:
                rows = cursor.fetchall()
                if rows and cursor.description:
                    cols = [description[0] for description in cursor.description]
                    result = [dict(zip(cols, row)) for row in rows]
                else:
                    result = rows
            else:
                result = None
            
            conn.commit()
        else:
            # Для PostgreSQL
            cursor = conn.cursor(cursor_factory=RealDictCursor)  
            cursor.execute(query, params)
            
            if fetch:
                result = cursor.fetchone()
            elif fetchall:
                result = cursor.fetchall()
            else:
                result = None
            
            # Коммитим все изменяющие запросы (INSERT, UPDATE, DELETE)
            if query.strip().upper().startswith(('INSERT', 'UPDATE', 'DELETE')):
                conn.commit()
        
        return result
        
    except Exception as e:
        if conn and not USE_SQLITE:
            conn.rollback()
        print(f"Ошибка при выполнении запроса: {e}")
        print(f"Query: {query}")
        print(f"Params: {params}")
        raise e
    finally:
        if cursor:
            cursor.close()
        if conn:
            PostgreSQL.return_connection(conn)

def init_postgres_db():
    """Инициализирует таблицы в базе данных, если они не существуют."""
    conn = None
    cursor = None
    try:
        # Сначала пытаемся подключиться к существующей БД
        conn = psycopg2.connect(
            host=Config.PG_HOST,
            port=Config.PG_PORT,
            user=Config.PG_USER,
            password=Config.PG_PASSWORD,
            database=Config.PG_DATABASE
        )
        cursor = conn.cursor()
        
    except psycopg2.OperationalError:
        # Если БД не существует, создаем ее
        try:
            print(f"База данных {Config.PG_DATABASE} не существует, создаем...")
            conn = psycopg2.connect(
                host=Config.PG_HOST,
                port=Config.PG_PORT,
                user=Config.PG_USER,
                password=Config.PG_PASSWORD
            )
            conn.autocommit = True
            cursor = conn.cursor()
            
            cursor.execute(sql.SQL("CREATE DATABASE {}").format(
                sql.Identifier(Config.PG_DATABASE))
            )
            print(f"База данных {Config.PG_DATABASE} создана успешно")
            
            cursor.close()
            conn.close()
            
            # Подключаемся к новой БД
            conn = psycopg2.connect(
                host=Config.PG_HOST,
                port=Config.PG_PORT,
                user=Config.PG_USER,
                password=Config.PG_PASSWORD,
                database=Config.PG_DATABASE
            )
            cursor = conn.cursor()
            
        except Exception as e:
            print(f"Ошибка при создании базы данных: {e}")
            return

    try:
        # Создаем таблицы
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS email_auth (
                id SERIAL PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                name TEXT,
                username TEXT UNIQUE,
                auth_token TEXT,
                reset_token TEXT,
                verified BOOLEAN DEFAULT FALSE,
                avatar TEXT,
                banner TEXT,
                bio TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')           

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS posts (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                content TEXT NOT NULL,
                image_path TEXT,
                image_data_base64 TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES email_auth (id) ON DELETE CASCADE
            )
        ''')
        cursor.execute('ALTER TABLE posts ADD COLUMN IF NOT EXISTS image_data_base64 TEXT')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS follows (
                id SERIAL PRIMARY KEY,
                follower_id INTEGER NOT NULL,
                following_id INTEGER NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (follower_id) REFERENCES email_auth (id) ON DELETE CASCADE,
                FOREIGN KEY (following_id) REFERENCES email_auth (id) ON DELETE CASCADE,
                UNIQUE(follower_id, following_id)
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS post_likes (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                post_id INTEGER NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES email_auth (id) ON DELETE CASCADE,
                FOREIGN KEY (post_id) REFERENCES posts (id) ON DELETE CASCADE,
                UNIQUE(user_id, post_id)
            )
        ''')

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS comments (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                post_id INTEGER NOT NULL,
                content TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES email_auth (id) ON DELETE CASCADE,
                FOREIGN KEY (post_id) REFERENCES posts (id) ON DELETE CASCADE
            )
        ''')

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS verification_codes (
                id SERIAL PRIMARY KEY,
                email TEXT NOT NULL,
                code TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP NOT NULL
            );
        ''')

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS temp_users (
                id SERIAL PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        ''')

        # Создаем индексы
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_post_likes ON post_likes(post_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_comments_user ON comments(user_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_email ON email_auth(email)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_username ON email_auth(username)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_auth_token ON email_auth(auth_token)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_reset_token ON email_auth(reset_token)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_posts_user ON posts(user_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at)')
        
        conn.commit()
        print("Таблицы и индексы успешно созданы в PostgreSQL")
        
    except Exception as e:
        print(f"Ошибка при инициализации PostgreSQL: {str(e)}")
        if conn:
            conn.rollback()
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

if __name__ == "__main__":
    init_postgres_db()
