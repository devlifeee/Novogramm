import psycopg2
from psycopg2 import sql
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
from config import Config

def init_postgres_db():
    admin_conn = None
    admin_cursor = None
    conn = None
    cursor = None
    
    try:
        # Подключаемся к серверу PostgreSQL без выбора конкретной базы данных
        admin_conn = psycopg2.connect(
            host=Config.PG_HOST,
            port=Config.PG_PORT,
            user=Config.PG_USER,
            password=Config.PG_PASSWORD
        )
        admin_conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)  
        admin_cursor = admin_conn.cursor()
        
        # Проверяем, существует ли база данных
        admin_cursor.execute("SELECT 1 FROM pg_database WHERE datname = %s", (Config.PG_DATABASE,))
        exists = admin_cursor.fetchone()
        
        if not exists:
            # Создаем базу данных, если она не существует
            admin_cursor.execute(sql.SQL("CREATE DATABASE {}").format(
                sql.Identifier(Config.PG_DATABASE))
            )
            print(f"База данных {Config.PG_DATABASE} создана успешно")
        else:
            print(f"База данных {Config.PG_DATABASE} уже существует")
        
        admin_cursor.close()
        admin_conn.close()
        
        # Подключаемся к конкретной базе данных
        conn = psycopg2.connect(
            host=Config.PG_HOST,
            port=Config.PG_PORT,
            user=Config.PG_USER,
            password=Config.PG_PASSWORD,
            database=Config.PG_DATABASE
        )
        cursor = conn.cursor()
        
        # Создание таблицы пользователей
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS email_auth (
            id SERIAL PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            name TEXT,
            username TEXT UNIQUE,
            auth_token TEXT,
            reset_token TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            verified BOOLEAN DEFAULT FALSE  
        )
    ''')
        
        # Создание таблицы временных пользователей
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS temp_users (
                id SERIAL PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Создание таблицы кодов подтверждения
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS verification_codes (
                id SERIAL PRIMARY KEY,
                email TEXT NOT NULL,
                code TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP NOT NULL
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
        
        # Создание таблицы подписок
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
        
        # Создание индексов
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
        # Закрытие соединений
        if admin_cursor and not admin_cursor.closed:
            admin_cursor.close()
        if admin_conn and not admin_conn.closed:
            admin_conn.close()
        if cursor and not cursor.closed:
            cursor.close()
        if conn and not conn.closed:
            conn.close()
