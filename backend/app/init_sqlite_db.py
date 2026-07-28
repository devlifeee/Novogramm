import sqlite3
import os
from pathlib import Path

def init_sqlite_db():
    """Инициализирует SQLite базу данных для разработки"""
    db_path = os.path.join(os.path.dirname(__file__), '..', 'dev.db')
    
    # Создаем папку если её нет
    Path(db_path).parent.mkdir(parents=True, exist_ok=True)
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Создаем таблицы
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS email_auth (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                name TEXT,
                username TEXT UNIQUE,
                auth_token TEXT,
                reset_token TEXT,
                verified BOOLEAN DEFAULT 0,
                avatar TEXT,
                banner TEXT,
                bio TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')           

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS posts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                content TEXT NOT NULL,
                image_path TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES email_auth (id) ON DELETE CASCADE
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS follows (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
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
                id INTEGER PRIMARY KEY AUTOINCREMENT,
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
                id INTEGER PRIMARY KEY AUTOINCREMENT,
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
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT NOT NULL,
                code TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP NOT NULL
            )
        ''')

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS temp_users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
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
        print(f"✅ SQLite база данных успешно инициализирована: {db_path}")
        
    except Exception as e:
        print(f"❌ Ошибка при инициализации SQLite БД: {str(e)}")
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    init_sqlite_db()
