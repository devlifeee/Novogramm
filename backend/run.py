from flask import send_from_directory
from app import create_app  # <-- ИЗМЕНИТЬ СЮДА
from app.database import PostgreSQL  # <-- ИЗМЕНИТЬ СЮДА

app = create_app()

with app.app_context():
    PostgreSQL.init_app(app)

# ====== CATCH-ALL МАРШРУТ ======
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def catch_all(path):
    """Отдает index.html для всех клиентских маршрутов."""
    # Исключаем API и статику
    if path and path.startswith(('api/', 'auth/', 'static/', 'health')):
        return 'Not Found', 404
    
    # Пробуем найти index.html в разных местах
    try:
        return send_from_directory('templates', 'index.html')
    except:
        try:
            return send_from_directory('.', 'index.html')
        except:
            return 'index.html not found', 500
# ====== КОНЕЦ МАРШРУТА ======

if __name__ == '__main__':
    import os
    port = int(os.environ.get('PORT', 3000))
    print("Запуск сервера Flask...")
    app.run(host='0.0.0.0', port=port, debug=False)