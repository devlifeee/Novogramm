from flask import Flask, jsonify
from .config import Config
from .database import PostgreSQL, init_postgres_db
from werkzeug.middleware.proxy_fix import ProxyFix
import os
from flask_cors import CORS
def create_app():
    # Определяем базовую директорию проекта
    # PROJECT_ROOT_DIR = os.path.dirname(os.path.abspath(os.path.dirname(__file__)))

    # app = Flask(
    #     __name__,
    #     static_folder=os.path.join(PROJECT_ROOT_DIR, 'static'),
    #     static_url_path='/static'
    # )
    app = Flask(__name__)
    app.config.from_object(Config)
    CORS(app)
    # Настройка для работы за обратным прокси
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_host=1, x_proto=1, x_prefix=1)
    
    # Health check endpoint - ДОБАВЛЯЕМ ПЕРВЫМ
    @app.route('/health')
    def health_check():
        try:
            # Простая проверка что приложение работает
            return jsonify({'status': 'healthy'}), 200
        except Exception as e:
            return jsonify({'status': 'unhealthy', 'error': str(e)}), 500

    # Инициализация базы данных
    with app.app_context():
        try:
            PostgreSQL.init_app(app)
            init_postgres_db()
            print("База данных успешно инициализирована")
        except Exception as e:
            print(f"Ошибка инициализации базы данных: {e}")
            # В продакшене можно добавить логирование и более сложную обработку ошибок

    # Blueprints
    from .main.home import main as main_blueprint
    from .auth.routes import auth_bp as auth_blueprint

    # Регистрация блюпринтов
    app.register_blueprint(main_blueprint, url_prefix='/')
    app.register_blueprint(auth_blueprint, url_prefix='/')

    return app
