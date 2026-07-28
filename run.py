import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from flask import send_from_directory, redirect, jsonify
from app import create_app
from app.database import PostgreSQL

app = create_app()

with app.app_context():
    PostgreSQL.init_app(app)
    
@app.route('/')
def index():
    """Перенаправление на фронтенд"""
    return redirect('http://localhost:8888', code=302)

@app.route('/health')
def health():
    return jsonify({'status': 'ok'})

if __name__ == '__main__':
    import os
    port = int(os.environ.get('PORT', 3000))
    print("Запуск сервера Flask...")
    app.run(host='0.0.0.0', port=port, debug=False)