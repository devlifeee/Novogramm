import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_FOLDER = os.path.join(BASE_DIR, 'static', 'uploads')

class Config:
    """
    Класс конфигурации для Flask-приложения.
    Все настройки читаются из переменных окружения.
    """
    SECRET_KEY = os.environ.get('SECRET_KEY', 'default-dev-secret-key-please-change!')

    # Настройки загрузки файлов
    UPLOAD_FOLDER = UPLOAD_FOLDER
    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}

    # Настройки PostgreSQL
    PG_HOST = os.environ.get('PG_HOST')
    PG_PORT = os.environ.get('PG_PORT', '5432')
    PG_USER = os.environ.get('PG_USER')
    PG_PASSWORD = os.environ.get('PG_PASSWORD')
    PG_DATABASE = os.environ.get('PG_DATABASE')

    # Формируем URI для SQLAlchemy
    if not all([PG_USER, PG_PASSWORD, PG_HOST, PG_DATABASE]):
        print("WARNING: Один или несколько параметров подключения к базе данных не заданы!")
        print("Используется запасной SQLAlchemy_DATABASE_URI для разработки.")
        SQLALCHEMY_DATABASE_URI = "postgresql://dev_user:dev_pass@localhost:5432/dev_db"
    else:
        SQLALCHEMY_DATABASE_URI = (
            f"postgresql://{PG_USER}:{PG_PASSWORD}@{PG_HOST}:{PG_PORT}/{PG_DATABASE}"
        )

    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Режим отладки Flask
    DEBUG = os.environ.get('DEBUG', 'False').lower() == 'true'

    # Настройки reCAPTCHA
    RECAPTCHA_SITE_KEY = os.getenv('RECAPTCHA_SITE_KEY', '')
    RECAPTCHA_SECRET_KEY = os.getenv('RECAPTCHA_SECRET_KEY', '')
    RECAPTCHA_DISABLED = os.getenv('RECAPTCHA_DISABLED', 'false').lower() == 'true'

    # Настройки электронной почты (SMTP)
    SMTP_SERVER = os.getenv('SMTP_SERVER', 'smtp.gmail.com')
    SMTP_PORT = int(os.getenv('SMTP_PORT', 587))
    EMAIL_USER = os.getenv('EMAIL_USER')
    EMAIL_PASSWORD = os.getenv('EMAIL_PASSWORD')
    SKIP_EMAIL_VERIFICATION = os.getenv('SKIP_EMAIL_VERIFICATION', 'true').lower() == 'true'
