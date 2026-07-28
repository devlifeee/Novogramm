import os
import re
from datetime import datetime, timedelta
from flask import Flask, Blueprint, render_template, request, jsonify, current_app # type: ignore
from werkzeug.utils import secure_filename
from app.config import UPLOAD_FOLDER
from flask import Blueprint, render_template, redirect, url_for, session
from app.database import execute_query


main = Blueprint('main', __name__)

def clean_auth_token(auth_token):
    """Убирает префикс Bearer из токена авторизации"""
    if auth_token and auth_token.startswith('Bearer '):
        return auth_token[7:]  # Убираем "Bearer "
    return auth_token

# Разрешенные расширения файлов
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
def allowed_file(filename): 
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS
# Папка для загрузок

if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

@main.route('/')
def index():
    return redirect('/auth')

# @main.route('/chats')
# def chats():
#     return render_template('main/chats.html')

# @main.route('/programing_mode')
# def programming_mode():
#     return render_template('main/programing_mode.html')

# @main.route('/home')
# def home():
#     return render_template('main/home.html')


# @main.route('/settings')  
# def settings():
#     return render_template('main/settings.html')

@main.route('/register', methods=['POST'])
def register_main():
    """Регистрация нового пользователя"""
    try:
        data = request.get_json()
        email = data.get('email')
        password = data.get('password')
        confirm_password = data.get('confirm_password')
        name = data.get('name') or ''
        username = (data.get('username') or '').strip().lower() or None

        # Валидация данных
        if not email or not password or not confirm_password:
            return jsonify({'success': False, 'error': 'Заполните все обязательные поля'}), 400
        
        if password != confirm_password:
            return jsonify({'success': False, 'error': 'Пароли не совпадают'}), 400
        
        if len(password) < 6:
            return jsonify({'success': False, 'error': 'Пароль должен содержать минимум 6 символов'}), 400
        
        # Проверяем валидность email
        from app.utils import is_valid_email
        if not is_valid_email(email):
            return jsonify({'success': False, 'error': 'Некорректный email'}), 400
        
        # Проверяем, не занят ли email
        existing_user = execute_query(
            "SELECT id FROM email_auth WHERE email = %s", 
            (email,), 
            fetch=True
        )
        if existing_user:
            return jsonify({'success': False, 'error': 'Пользователь с таким email уже существует'}), 400
        
        # Если username предоставлен, проверяем его уникальность
        if username:
            existing_username = execute_query(
                "SELECT id FROM email_auth WHERE username = %s", 
                (username,), 
                fetch=True
            )
            if existing_username:
                return jsonify({'success': False, 'error': 'Этот username уже занят'}), 400
        
        # Хешируем пароль
        import bcrypt
        import random
        hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
        
        # Генерируем auth_token
        verification_code = str(random.randint(10000, 99999))
        expires_at = datetime.now() + timedelta(minutes=30)
        
        # Создаем пользователя в базе данных
        user_id = execute_query(
            """INSERT INTO email_auth (email, password, name, username, verified, created_at) 
               VALUES (%s, %s, %s, %s, FALSE, NOW()) RETURNING id""",
            (email, hashed_password.decode('utf-8'), name, username),
            fetch=True
        )
        
        if user_id:
            execute_query(
                "DELETE FROM verification_codes WHERE email = %s",
                (email,)
            )
            execute_query(
                "INSERT INTO verification_codes (email, code, expires_at) VALUES (%s, %s, %s)",
                (email, verification_code, expires_at)
            )

            from app.utils import send_verification_email
            email_sent = send_verification_email(email, verification_code)
            if not email_sent:
                current_app.logger.warning(
                    f"Verification email was not sent for {email}. Dev code: {verification_code}"
                )

            return jsonify({
                'success': True,
                'message': 'Регистрация прошла успешно',
                'requires_verification': True,
                'email_sent': email_sent,
                'dev_code': verification_code if (not email_sent or current_app.config.get('DEBUG', False)) else None,
                'user': {
                    'id': user_id['id'],
                    'name': name,
                    'username': username or '',
                    'email': email,
                    'avatar': '/static/images/default-avatar.png',
                    'banner': '/static/images/black hole.png'
                }
            }), 201
        else:
            return jsonify({'success': False, 'error': 'Ошибка при создании пользователя'}), 500
            
    except Exception as e:
        current_app.logger.error(f"Ошибка регистрации: {str(e)}")
        return jsonify({'success': False, 'error': 'Внутренняя ошибка сервера'}), 500

@main.route('/api/get_user_data')
def get_user_data():
    auth_token = clean_auth_token(request.headers.get('Authorization'))
    if not auth_token:
        return jsonify({'success': False, 'error': 'Требуется авторизация'}), 401
    
    try:
        # Получаем данные пользователя
        user = execute_query(
            "SELECT id, name, username, email, avatar, banner, bio FROM email_auth WHERE auth_token = %s",
            (auth_token,),
            fetch=True
        )
        
        if not user:
            return jsonify({'success': False, 'error': 'Пользователь не найден'}), 404
        
        return jsonify({
            'success': True,
            'user': {
                'id': user['id'],
                'name': user['name'] or 'Новый пользователь',
                'username': user['username'] or 'новый_пользователь',
                'email': user['email'],
                'avatar': user['avatar'] or '/static/images/default-avatar.png',
                'banner': user['banner'] or '/static/images/black hole.png',
                'bio': user.get('bio') or 'Расскажите о себе...'
            }
        })
        
    except Exception as e:
        current_app.logger.error(f"Ошибка получения данных пользователя: {str(e)}")
        return jsonify({'success': False, 'error': 'Внутренняя ошибка сервера'}), 500
# API для популярных каналов (заглушка)
@main.route('/api/popular_channels')
def get_popular_channels():
    # Возвращаем пустой список пока что
    return jsonify([])

# API для предложенных пользователей (заглушка)
@main.route('/api/suggested_users')
def get_suggested_users():
    # Возвращаем пустой список пока что
    return jsonify([])

# Endpoint для создания аккаунта (заглушка)
@main.route('/api/search_users')
def search_users():
    auth_token = clean_auth_token(request.headers.get('Authorization'))
    if not auth_token:
        return jsonify({'success': False, 'error': 'РўСЂРµР±СѓРµС‚СЃСЏ Р°РІС‚РѕСЂРёР·Р°С†РёСЏ'}), 401

    query = (request.args.get('q') or '').strip()
    if len(query) < 2:
        return jsonify({'success': True, 'users': []})

    try:
        current_user = execute_query(
            "SELECT id FROM email_auth WHERE auth_token = %s",
            (auth_token,),
            fetch=True
        )
        if not current_user:
            return jsonify({'success': False, 'error': 'РќРµРІРµСЂРЅС‹Р№ С‚РѕРєРµРЅ Р°РІС‚РѕСЂРёР·Р°С†РёРё'}), 401

        current_user_id = current_user['id']
        search_pattern = f"%{query}%"
        rows = execute_query('''
            SELECT
                e.id, e.name, e.username, e.avatar, e.bio,
                (SELECT COUNT(*) FROM posts WHERE user_id = e.id) AS posts_count,
                (SELECT COUNT(*) FROM follows WHERE following_id = e.id) AS followers_count,
                (SELECT 1 FROM follows WHERE follower_id = %s AND following_id = e.id) AS is_following
            FROM email_auth e
            WHERE e.id <> %s
              AND (
                COALESCE(e.name, '') ILIKE %s
                OR COALESCE(e.username, '') ILIKE %s
                OR COALESCE(e.email, '') ILIKE %s
              )
            ORDER BY
                CASE WHEN COALESCE(e.username, '') ILIKE %s THEN 0 ELSE 1 END,
                e.name ASC
            LIMIT 12
        ''', (current_user_id, current_user_id, search_pattern, search_pattern, search_pattern, f"{query}%",), fetchall=True) or []

        users = []
        for row in rows:
            users.append({
                'id': row['id'],
                'name': row['name'] or 'РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ',
                'username': row['username'] or 'username',
                'avatar': row['avatar'] or '/static/images/default-avatar.png',
                'bio': row['bio'] or '',
                'posts_count': row['posts_count'] or 0,
                'followers_count': row['followers_count'] or 0,
                'is_following': bool(row['is_following'])
            })

        return jsonify({'success': True, 'users': users})

    except Exception as e:
        current_app.logger.error(f"РћС€РёР±РєР° РїРѕРёСЃРєР° РїРѕР»СЊР·РѕРІР°С‚РµР»РµР№: {str(e)}")
        return jsonify({'success': False, 'error': 'Р’РЅСѓС‚СЂРµРЅРЅСЏСЏ РѕС€РёР±РєР° СЃРµСЂРІРµСЂР°'}), 500

@main.route('/account_creation')
def account_creation():
    return jsonify({'message': 'Account creation endpoint'}), 200

# # Favicon route
# @main.route('/favicon.ico')
# def favicon():
#     from flask import send_from_directory
#     return send_from_directory('static/images', 'favicon.ico')

# @main.route('/support')
# def support():
#     return render_template('main/support.html')


# API для получения профиля текущего пользователя
@main.route('/api/profile', methods=['GET'])
def get_current_user_profile():
    auth_token = clean_auth_token(request.headers.get('Authorization'))
    if not auth_token:
        return jsonify({'success': False, 'error': 'Требуется авторизация'}), 401
    
    try:
        # Получаем данные пользователя
        user = execute_query(
            "SELECT id, name, username, email, avatar, banner, bio FROM email_auth WHERE auth_token = %s",
            (auth_token,),
            fetch=True
        )
        
        if not user:
            return jsonify({'success': False, 'error': 'Пользователь не найден'}), 404
        
        # Получаем статистику пользователя
        posts_result = execute_query(
            "SELECT COUNT(*) as count FROM posts WHERE user_id = %s",
            (user['id'],),
            fetch=True
        )
        posts_count = posts_result['count'] if posts_result else 0
        
        followers_result = execute_query(
            "SELECT COUNT(*) as count FROM follows WHERE following_id = %s",
            (user['id'],),
            fetch=True
        )
        followers_count = followers_result['count'] if followers_result else 0
        
        following_result = execute_query(
            "SELECT COUNT(*) as count FROM follows WHERE follower_id = %s",
            (user['id'],),
            fetch=True
        )
        following_count = following_result['count'] if following_result else 0
        
        # Получаем посты пользователя с информацией о лайках
        posts_data = execute_query(
            """
            SELECT p.id, p.content, p.image_path, p.created_at,
                   (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id) as likes_count,
                   (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comments_count,
                   (SELECT 1 FROM post_likes WHERE post_id = p.id AND user_id = %s) as is_liked
            FROM posts p
            WHERE p.user_id = %s
            ORDER BY p.created_at DESC
            LIMIT 20
            """,
            (user['id'], user['id']),
            fetchall=True
        )
        posts = posts_data if posts_data else []
        
        return jsonify({
            'success': True,
            'user': {
                'id': user['id'],
                'name': user['name'] or 'Новый пользователь',
                'username': user['username'] or 'новый_пользователь',
                'email': user['email'],
                'avatar': user['avatar'] or '/static/images/default-avatar.png',
                'banner': user['banner'] or '/static/images/black hole.png',
                'bio': user.get('bio') or 'Расскажите о себе...',
                'stats': {
                    'posts': posts_count or 0,
                    'followers': followers_count or 0,
                    'following': following_count or 0,
                    'tasks_completed': 0  # Счетчик заданий
                }
            },
            'posts': [
                {
                    'id': post['id'],
                    'content': post['content'],
                    'image_path': post['image_path'],
                    'created_at': post['created_at'].isoformat() if hasattr(post['created_at'], 'isoformat') else str(post['created_at']),
                    'likes_count': post['likes_count'] or 0,
                    'comments_count': post['comments_count'] or 0,
                    'is_liked': bool(post.get('is_liked', False))
                }
                for post in posts
            ]
        })
        
    except Exception as e:
        current_app.logger.error(f"Ошибка получения профиля: {str(e)}")
        return jsonify({'success': False, 'error': 'Внутренняя ошибка сервера'}), 500

# API для обновления профиля
@main.route('/api/profile', methods=['PUT'])
def update_profile_v2():
    auth_token = clean_auth_token(request.headers.get('Authorization'))
    if not auth_token:
        return jsonify({'success': False, 'error': 'Требуется авторизация'}), 401

    try:
        data = request.get_json(silent=True) or {}
        name = (data.get('name') or '').strip()
        username = (data.get('username') or '').strip().lower()
        bio = (data.get('bio') or '').strip()

        if len(name) < 2 or len(name) > 60:
            return jsonify({'success': False, 'error': 'Имя должно быть от 2 до 60 символов'}), 400

        if len(username) < 3 or len(username) > 10:
            return jsonify({'success': False, 'error': 'Username должен быть от 3 до 10 символов'}), 400

        if not re.match(r'^[a-z0-9_.]+$', username):
            return jsonify({'success': False, 'error': 'Username может содержать только латиницу, цифры, _ и точку'}), 400

        if len(bio) > 240:
            return jsonify({'success': False, 'error': 'Описание должно быть не длиннее 240 символов'}), 400

        user = execute_query(
            "SELECT id FROM email_auth WHERE auth_token = %s",
            (auth_token,),
            fetch=True
        )
        if not user:
            return jsonify({'success': False, 'error': 'Пользователь не найден'}), 404

        existing_user = execute_query(
            "SELECT id FROM email_auth WHERE username = %s AND id != %s",
            (username, user['id']),
            fetch=True
        )
        if existing_user:
            return jsonify({'success': False, 'error': 'Этот username уже занят'}), 400

        execute_query(
            "UPDATE email_auth SET name = %s, username = %s, bio = %s WHERE id = %s",
            (name, username, bio, user['id'])
        )

        updated_user = execute_query(
            "SELECT id, email, name, username, avatar, bio FROM email_auth WHERE id = %s",
            (user['id'],),
            fetch=True
        )

        return jsonify({
            'success': True,
            'message': 'Профиль обновлен',
            'user': {
                'id': updated_user['id'],
                'email': updated_user['email'],
                'name': updated_user['name'],
                'username': updated_user['username'],
                'avatar': updated_user['avatar'] or '/static/images/default-avatar.png',
                'bio': updated_user.get('bio') or ''
            }
        })
    except Exception as e:
        current_app.logger.error(f"Ошибка обновления профиля: {str(e)}")
        return jsonify({'success': False, 'error': 'Внутренняя ошибка сервера'}), 500

@main.route('/api/profile_old', methods=['PUT'])
def update_profile():
    auth_token = clean_auth_token(request.headers.get('Authorization'))
    if not auth_token:
        return jsonify({'success': False, 'error': 'Требуется авторизация'}), 401
    
    try:
        data = request.get_json()
        current_app.logger.info(f"Updating profile with data: {data}")
        
        name = data.get('name')
        username = data.get('username')
        bio = data.get('bio')
        
        # Получаем ID пользователя
        user = execute_query(
            "SELECT id FROM email_auth WHERE auth_token = %s",
            (auth_token,),
            fetch=True
        )
        
        if not user:
            return jsonify({'success': False, 'error': 'Пользователь не найден'}), 404
        
        # Проверяем уникальность username (если изменился)
        if username:
            existing_user = execute_query(
                "SELECT id FROM email_auth WHERE username = %s AND id != %s",
                (username, user['id']),
                fetch=True
            )
            if existing_user:
                return jsonify({'success': False, 'error': 'Этот username уже занят'}), 400
        
        # Обновляем данные
        update_fields = []
        params = []
        
        if name:
            update_fields.append("name = %s")
            params.append(name)
        
        if username:
            update_fields.append("username = %s")
            params.append(username)
        
        if bio is not None:  # bio может быть пустой строкой
            update_fields.append("bio = %s")
            params.append(bio)
        
        if update_fields:
            params.append(user['id'])
            query = f"UPDATE email_auth SET {', '.join(update_fields)} WHERE id = %s"
            execute_query(query, params)
            
            # Получаем обновленные данные пользователя
            updated_user = execute_query(
                "SELECT name, username, avatar, bio FROM email_auth WHERE id = %s",
                (user['id'],),
                fetch=True
            )
            
            return jsonify({
                'success': True, 
                'message': 'Профиль обновлен',
                'user': {
                    'name': updated_user['name'],
                    'username': updated_user['username'],
                    'avatar': updated_user['avatar'],
                    'bio': updated_user.get('bio', '')
                }
            })
        else:
            return jsonify({'success': False, 'error': 'Нет данных для обновления'}), 400
        
    except Exception as e:
        current_app.logger.error(f"Ошибка обновления профиля: {str(e)}")
        return jsonify({'success': False, 'error': 'Внутренняя ошибка сервера'}), 500
    
# API для загрузки аватара
@main.route('/api/profile/avatar', methods=['POST'])
def upload_avatar():
    auth_token = clean_auth_token(request.headers.get('Authorization'))
    if not auth_token:
        return jsonify({'success': False, 'error': 'Требуется авторизация'}), 401
    
    try:
        if 'avatar' not in request.files:
            return jsonify({'success': False, 'error': 'Файл не выбран'}), 400
        
        file = request.files['avatar']
        if file.filename == '':
            return jsonify({'success': False, 'error': 'Файл не выбран'}), 400
        
        if file and allowed_file(file.filename):
            # Получаем ID пользователя
            user = execute_query(
                "SELECT id FROM email_auth WHERE auth_token = %s",
                (auth_token,),
                fetch=True
            )
            
            if not user:
                return jsonify({'success': False, 'error': 'Пользователь не найден'}), 404
            
            # Читаем файл и конвертируем в base64
            import base64
            file_data = file.read()
            avatar_base64 = base64.b64encode(file_data).decode('utf-8')
            
            # Формируем data URL
            mime_type = file.content_type
            avatar_data_url = f"data:{mime_type};base64,{avatar_base64}"
            
            # Обновляем в БД
            execute_query(
                "UPDATE email_auth SET avatar = %s WHERE id = %s",
                (avatar_data_url, user['id'])
            )
            
            # Также обновляем данные пользователя
            updated_user = execute_query(
                "SELECT name, username, avatar FROM email_auth WHERE id = %s",
                (user['id'],),
                fetch=True
            )
            
            return jsonify({
                'success': True, 
                'avatar_url': avatar_data_url,
                'user': {
                    'name': updated_user['name'],
                    'username': updated_user['username'],
                    'avatar': updated_user['avatar']
                },
                'message': 'Аватар обновлен'
            })
        else:
            return jsonify({'success': False, 'error': 'Недопустимый формат файла'}), 400
            
    except Exception as e:
        current_app.logger.error(f"Ошибка загрузки аватара: {str(e)}")
        return jsonify({'success': False, 'error': 'Внутренняя ошибка сервера'}), 500
    

@main.route('/login')
def login_redirect():
    """Перенаправление на страницу входа"""
    from flask import redirect
    return redirect('/auth/login')

@main.route('/login', methods=['POST'])
def login_main():
    """Проксирование входа через main blueprint"""
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')

    if not email or not password:
        return jsonify({'error': 'Заполните все поля'}), 400
    
    from app.utils import is_valid_email
    if not is_valid_email(email):
        return jsonify({'error': 'Некорректный email'}), 400
        
    try:
        # Получаем пользователя из базы данных
        result = execute_query(
            "SELECT * FROM email_auth WHERE email = %s", 
            (email,), 
            fetch=True
        )
        
        if not result:
            return jsonify({'error': 'Пользователь не найден'}), 404

        # Проверяем пароль через bcrypt
        import bcrypt
        if not bcrypt.checkpw(password.encode('utf-8'), result['password'].encode('utf-8')):
            return jsonify({'error': 'Неверный пароль'}), 401

        return jsonify({
            'success': True,
            'message': 'Успешный вход', 
            'redirect': '/home',
            'token': result.get('auth_token', ''),
            'user': {
                'id': result['id'],
                'name': result.get('name', ''),
                'username': result.get('username', ''),
                'email': result['email'],
                'avatar': result.get('avatar', ''),
                'banner': result.get('banner', '')
            }
        }), 200
    except Exception as e:
        current_app.logger.error(f"Ошибка входа: {str(e)}")
        return jsonify({'error': 'Внутренняя ошибка сервера'}), 500

@main.route('/forgot-password', methods=['POST'])
def forgot_password_main():
    """Проксирование запроса на auth blueprint"""
    data = request.get_json()
    email = data.get('email')
    
    if not email:
        return jsonify({'success': False, 'error': 'Email обязателен'}), 400
    
    # Проверяем, существует ли пользователь с таким email
    try:
        result = execute_query(
            "SELECT id FROM email_auth WHERE email = %s", 
            (email,), 
            fetch=True
        )
            
        if not result:
            return jsonify({'success': False, 'error': 'Пользователь с таким email не найден'}), 404
        
        # Генерируем токен для сброса пароля
        import bcrypt
        reset_token = bcrypt.gensalt().decode('utf-8')[:32]
        
        # Сохраняем токен в базе данных
        execute_query(
            "UPDATE email_auth SET reset_token = %s WHERE email = %s",
            (reset_token, email)
        )
        
        # Отправляем email с инструкциями по восстановлению пароля
        from app.utils import send_password_reset_email
        if send_password_reset_email(email, reset_token):
            return jsonify({'success': True, 'message': 'Инструкции по восстановлению отправлены на email'}), 200
        else:
            return jsonify({'success': False, 'error': 'Ошибка отправки email'}), 500
        
    except Exception as e:
        current_app.logger.error(f"Ошибка при восстановлении пароля: {e}")
        return jsonify({'success': False, 'error': 'Внутренняя ошибка сервера'}), 500 

# Создание поста
@main.route('/create_post', methods=['POST'])
def create_post():
    auth_token = clean_auth_token(request.headers.get('Authorization'))
    if not auth_token:
        return jsonify({'success': False, 'error': 'Требуется авторизация'}), 401
    
    try:
        #Проверка пользователя
        user = execute_query(
            "SELECT id FROM email_auth WHERE auth_token = %s",
            (auth_token,),
            fetch=True
        )
        
        if not user:
            return jsonify({'success': False, 'error': 'Неверный токен авторизации'}), 401
        
        #данные поста
        content = request.form.get('content')
        image = request.files.get('image')
        
        if not content:
            return jsonify({'success': False, 'error': 'Текст поста не может быть пустым'}), 400
        
        #Обработка изображения - сохрание в base64
        image_data_base64 = None
        if image and allowed_file(image.filename):
            import base64
            #кодировка в base64
            image_data = image.read()
            image_data_base64 = base64.b64encode(image_data).decode('utf-8')
        
        #пост в БД
        if image_data_base64:
            execute_query(
                "INSERT INTO posts (user_id, content, image_data_base64) VALUES (%s, %s, %s)",
                (user['id'], content, image_data_base64)
            )
        else:
            execute_query(
                "INSERT INTO posts (user_id, content) VALUES (%s, %s)",
                (user['id'], content)
            )
        
        return jsonify({'success': True, 'message': 'Пост успешно создан!'})
        
    except Exception as e:
        current_app.logger.error(f"Ошибка создания поста: {str(e)}")
        return jsonify({'success': False, 'error': 'Внутренняя ошибка сервера'}), 500
    
# Получение постов с информацией о лайках и комментариях
# Получение постов с информацией о лайках и комментариях
@main.route('/get_posts')
def get_posts():
    auth_token = clean_auth_token(request.headers.get('Authorization'))
    if not auth_token:
        return jsonify({'success': False, 'error': 'Требуется авторизация'}), 401
    
    try:
        # Проверяем пользователя
        current_user = execute_query(
            "SELECT id FROM email_auth WHERE auth_token = %s",
            (auth_token,),
            fetch=True
        )
        if not current_user:
            return jsonify({'success': False, 'error': 'Неверный токен авторизации'}), 401
        
        # Получаем посты с информацией о лайках и комментариях - ДОБАВЛЕН ВЫБОР АВАТАРА
        posts_data = execute_query('''
            SELECT p.id, p.user_id, p.content, p.image_path, p.image_data_base64, p.created_at, 
                   e.name, e.username, e.avatar,  -- ДОБАВЛЕНО e.avatar
                   (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id) AS likes_count,
                   (SELECT COUNT(*) FROM comments WHERE post_id = p.id) AS comments_count,
                   (SELECT 1 FROM post_likes WHERE post_id = p.id AND user_id = %s) AS is_liked
            FROM posts p
            JOIN email_auth e ON p.user_id = e.id
            ORDER BY p.created_at DESC
            LIMIT 50
        ''', (current_user['id'],), fetchall=True)
        
        posts = []
        for row in posts_data:
            # Отладочная информация
            current_app.logger.info(f"Пост {row['id']}: name={row['name']}, username={row['username']}, avatar={row['avatar']}")
            
            post_data = {
                'id': row['id'],
                'user_id': row['user_id'],
                'content': row['content'],
                'image_path': row['image_path'],
                'created_at': row['created_at'],
                'user_name': row['name'],
                'user_username': row['username'],
                'user_avatar': row['avatar'],  # ДОБАВЛЕНО
                'likes_count': row['likes_count'] or 0,
                'comments_count': row['comments_count'] or 0,
                'is_liked': bool(row['is_liked'])
            }
            
            # Логируем информацию об изображениях для отладки
            current_app.logger.info(f"Пост {row['id']}: image_path={row['image_path']}, has_base64={bool(row['image_data_base64'])}")
            
            # Если есть изображение в base64, добавляем его
            if row['image_data_base64']:
                post_data['image_data'] = row['image_data_base64']
            
            posts.append(post_data)
        
        return jsonify(posts)
        
    except Exception as e:
        current_app.logger.error(f"Ошибка получения постов: {str(e)}")
        return jsonify({'success': False, 'error': 'Внутренняя ошибка сервера'}), 500
    
# Профиль пользователя
@main.route('/api/get_user/<int:user_id>', methods=['GET'])
def get_user_profile(user_id):
    auth_token = clean_auth_token(request.headers.get("Authorization"))
    if not auth_token:
        return jsonify({"success": False, "error": "Требуется Авторизация"}), 401
    
    try:
        # Проверяем текущего пользователя
        current_user = execute_query(
            "SELECT id FROM email_auth WHERE auth_token = %s",
            (auth_token,),
            fetch=True
        )
        if not current_user:
            return jsonify({"success": False, "error": "Неверный токен авторизации"}), 401
        
        current_user_id = current_user['id']
        
        # Получаем данные пользователя
        user = execute_query('''
            SELECT
                id, name, username, avatar, bio,
                (SELECT COUNT(*) FROM posts WHERE user_id = %s) AS posts_count
            FROM email_auth
            WHERE id = %s
        ''', (user_id, user_id), fetch=True)

        if not user:
            return jsonify({'success': False, 'error': 'Пользователь не найден'}), 404
        
        # Получаем количество подписчиков
        followers_result = execute_query(
            "SELECT COUNT(*) as count FROM follows WHERE following_id = %s",
            (user_id,),
            fetch=True
        )
        followers_count = followers_result['count'] if followers_result else 0
        
        # Получаем количество подписок
        following_result = execute_query(
            "SELECT COUNT(*) as count FROM follows WHERE follower_id = %s",
            (user_id,),
            fetch=True
        )
        following_count = following_result['count'] if following_result else 0
        
        # Проверяем, подписан ли текущий пользователь
        is_following_result = execute_query(
            "SELECT 1 FROM follows WHERE follower_id = %s AND following_id = %s",
            (current_user_id, user_id),
            fetch=True
        )
        is_following = is_following_result is not None
        
        return jsonify({
            'success': True,
            'user': {
                'id': user['id'],
                'name': user['name'],
                'username': user['username'],
                'avatar': user['avatar'] or '/static/images/default-avatar.png',
                'bio': user['bio'] or '',
                'posts_count': user['posts_count'],  
                'followers_count': followers_count,
                'following_count': following_count,
                'is_following': is_following
            }
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Ошибка получения профиля: {str(e)}")
        return jsonify({'success': False, 'error': 'Внутренняя ошибка сервера'}), 500
    
# Получение постов конкретного пользователя
@main.route('/api/get_user_posts/<int:user_id>')
def get_user_posts(user_id):
    auth_token = clean_auth_token(request.headers.get('Authorization'))
    if not auth_token:
        return jsonify({'success': False, 'error': 'Требуется авторизация'}), 401
    
    try:
        # Проверяем пользователя
        current_user = execute_query(
            "SELECT id FROM email_auth WHERE auth_token = %s",
            (auth_token,),
            fetch=True
        )
        if not current_user:
            return jsonify({'success': False, 'error': 'Неверный токен авторизации'}), 401
        
        # Получаем посты пользователя
        posts_data = execute_query('''
            SELECT p.id, p.user_id, p.content, p.image_path, p.image_data_base64, p.created_at, 
                   e.name, e.username, e.avatar,
                   (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id) AS likes_count,
                   (SELECT COUNT(*) FROM comments WHERE post_id = p.id) AS comments_count,
                   (SELECT 1 FROM post_likes WHERE post_id = p.id AND user_id = %s) AS is_liked
            FROM posts p
            JOIN email_auth e ON p.user_id = e.id
            WHERE p.user_id = %s
            ORDER BY p.created_at DESC
            LIMIT 50
        ''', (current_user['id'], user_id,), fetchall=True) or []
        
        posts = []
        for row in posts_data:
            posts.append({
                'id': row['id'],
                'user_id': row['user_id'],
                'content': row['content'],
                'image_path': row['image_path'],
                'image_data_base64': row['image_data_base64'],
                'created_at': row['created_at'],
                'user_name': row['name'],
                'user_username': row['username'],
                'user_avatar': row['avatar'] or '/static/images/default-avatar.png',
                'likes_count': row['likes_count'] or 0,
                'comments_count': row['comments_count'] or 0,
                'is_liked': bool(row['is_liked'])
            })
        
        return jsonify(posts)
        
    except Exception as e:
        current_app.logger.error(f"Ошибка получения постов пользователя: {str(e)}")
        return jsonify({'success': False, 'error': 'Внутренняя ошибка сервера'}), 500

# Endpoint для подписки/отписки
@main.route('/api/follow/<int:user_id>', methods=['POST'])
def follow_user(user_id):
    auth_token = clean_auth_token(request.headers.get('Authorization'))
    if not auth_token:
        return jsonify({'success': False, 'error': 'Требуется авторизация'}), 401
    
    try:
        # Проверяем текущего пользователя
        current_user = execute_query(
            "SELECT id FROM email_auth WHERE auth_token = %s",
            (auth_token,),
            fetch=True
        )
        if not current_user:
            return jsonify({'success': False, 'error': 'Неверный токен авторизации'}), 401
        
        current_user_id = current_user['id']
        
        # Проверяем, не пытаемся ли подписаться на себя
        if current_user_id == user_id:
            return jsonify({'success': False, 'error': 'Нельзя подписаться на себя'}), 400
        
        # Проверяем, существует ли пользователь
        target_user = execute_query(
            "SELECT id FROM email_auth WHERE id = %s",
            (user_id,),
            fetch=True
        )
        if not target_user:
            return jsonify({'success': False, 'error': 'Пользователь не найден'}), 404
        
        # Проверяем, подписан ли уже пользователь
        already_following = execute_query(
            "SELECT 1 FROM follows WHERE follower_id = %s AND following_id = %s",
            (current_user_id, user_id),
            fetch=True
        )
        
        if already_following:
            # Отписываемся
            execute_query(
                "DELETE FROM follows WHERE follower_id = %s AND following_id = %s",
                (current_user_id, user_id)
            )
            action = 'unfollow'
        else:
            # Подписка
            execute_query(
                "INSERT INTO follows (follower_id, following_id) VALUES (%s, %s)",
                (current_user_id, user_id)
            )
            action = 'follow'
        
        followers_result = execute_query(
            "SELECT COUNT(*) as count FROM follows WHERE following_id = %s",
            (user_id,),
            fetch=True
        )
        followers_count = followers_result['count'] if followers_result else 0

        return jsonify({'success': True, 'action': action, 'followers_count': followers_count})
        
    except Exception as e:
        current_app.logger.error(f"Ошибка подписки: {str(e)}")
        return jsonify({'success': False, 'error': 'Внутренняя ошибка сервера'}), 500
    

#ЛАЙКИ
@main.route('/api/like_post/<int:post_id>', methods=['POST'])
def like_post(post_id):
    auth_token = clean_auth_token(request.headers.get('Authorization'))
    current_app.logger.info(f"Like request for post {post_id}, token: {auth_token[:20] if auth_token else 'None'}...")
    
    if not auth_token:
        current_app.logger.error("No auth token provided")
        return jsonify({'success': False, 'error': 'Требуется авторизация'}), 401
    
    try:
        # Проверяем пользователя
        user = execute_query(
            "SELECT id FROM email_auth WHERE auth_token = %s",
            (auth_token,),
            fetch=True
        )
        current_app.logger.info(f"User lookup result: {user}")
        
        if not user:
            current_app.logger.error(f"User not found for token: {auth_token}")
            return jsonify({'success': False, 'error': 'Неверный токен авторизации'}), 401
        
        user_id = user['id']
        current_app.logger.info(f"User ID: {user_id}")
        
        # Проверяем, существует ли пост
        post = execute_query(
            "SELECT id FROM posts WHERE id = %s",
            (post_id,),
            fetch=True
        )
        if not post:
            return jsonify({'success': False, 'error': 'Пост не найден'}), 404
        
        # Проверяем, лайкал ли уже пользователь этот пост
        existing_like = execute_query(
            "SELECT id FROM post_likes WHERE user_id = %s AND post_id = %s",
            (user_id, post_id),
            fetch=True
        )
        
        if existing_like:
            # Удаляем лайк
            execute_query(
                "DELETE FROM post_likes WHERE user_id = %s AND post_id = %s",
                (user_id, post_id)
            )
            action = 'unlike'
        else:
            # Добавляем лайк
            execute_query(
                "INSERT INTO post_likes (user_id, post_id) VALUES (%s, %s)",
                (user_id, post_id)
            )
            action = 'like'
        
        # Получаем обновленное количество лайков
        likes_result = execute_query(
            "SELECT COUNT(*) as count FROM post_likes WHERE post_id = %s",
            (post_id,),
            fetch=True
        )
        likes_count = likes_result['count'] if likes_result else 0
        
        return jsonify({
            'success': True, 
            'action': action,
            'likes_count': likes_count
        })
        
    except Exception as e:
        current_app.logger.error(f"Ошибка лайка: {str(e)}")
        return jsonify({'success': False, 'error': 'Внутренняя ошибка сервера'}), 500

#КОММЕНТАРИИ        
@main.route('/api/comment_post/<int:post_id>', methods=['POST'])
def comment_post(post_id):
    auth_token = clean_auth_token(request.headers.get('Authorization'))
    if not auth_token:
        return jsonify({'success': False, 'error': 'Требуется авторизация'}), 401

    try:
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'error': 'Отсутствуют данные'}), 400

        content = data.get('content', '').strip()

        if not content:
            return jsonify({'success': False, 'error': 'Комментарий не может быть пустым'}), 400

        # Проверяем пользователя
        user = execute_query(
            "SELECT id, name, username FROM email_auth WHERE auth_token = %s",
            (auth_token,),
            fetch=True
        )

        if not user:
            return jsonify({'success': False, 'error': 'Неверный токен авторизации'}), 401

        user_id = user['id']

        # Проверяем, существует ли пост
        post = execute_query(
            "SELECT id FROM posts WHERE id = %s",
            (post_id,),
            fetch=True
        )
        if not post:
            return jsonify({'success': False, 'error': 'Пост не найден'}), 404

        # Добавляем комментарий
        comment_result = execute_query(
            "INSERT INTO comments (user_id, post_id, content) VALUES (%s, %s, %s) RETURNING id, created_at",
            (user_id, post_id, content),
            fetch=True
        )
        
        comment_id = comment_result['id']
        created_at = comment_result['created_at']

        return jsonify({
            'success': True,
            'id': comment_id,
            'user_id': user_id,
            'post_id': post_id,
            'content': content,
            'user_name': user['name'],
            'user_username': user['username'],
            'created_at': created_at.isoformat() if hasattr(created_at, 'isoformat') else str(created_at)
        })
    except Exception as e:
        current_app.logger.error(f"Ошибка комментария: {str(e)}")
        return jsonify({'success': False, 'error': 'Внутренняя ошибка сервера'}), 500

#ПОЛУЧЕНИЕ КОММЕНТАРИЕВ
@main.route('/api/get_comments/<int:post_id>')
def get_comments(post_id):
    auth_token = clean_auth_token(request.headers.get('Authorization'))
    if not auth_token:
        return jsonify({'success': False, 'error': 'Требуется авторизация'}), 401
    
    try:
        # Проверяем пользователя
        user = execute_query(
            "SELECT id FROM email_auth WHERE auth_token = %s",
            (auth_token,),
            fetch=True
        )
        
        if not user:
            return jsonify({'success': False, 'error': 'Неверный токен авторизации'}), 401
        
        # Получаем комментарии
        comments_data = execute_query('''
            SELECT c.id, c.user_id, c.content, c.created_at, 
                   e.name, e.username
            FROM comments c
            JOIN email_auth e ON c.user_id = e.id
            WHERE c.post_id = %s
            ORDER BY c.created_at ASC
        ''', (post_id,), fetchall=True)
        
        comments = []
        for row in comments_data:
            comments.append({
                'id': row['id'],
                'user_id': row['user_id'],
                'content': row['content'],
                'created_at': row['created_at'],
                'user_name': row['name'],
                'user_username': row['username']
            })
        
        return jsonify(comments)
        
    except Exception as e:
        current_app.logger.error(f"Ошибка получения комментариев: {str(e)}")
        return jsonify({'success': False, 'error': 'Внутренняя ошибка сервера'}), 500

# @main.route('/reset-password')
# def reset_password_page_main():
#     """Страница сброса пароля"""
#     token = request.args.get('token')
#     if not token:
#         return render_template('auth/reset_password.html', token='', error='Недействительная ссылка')
#     return render_template('auth/reset_password.html', token=token)

@main.route('/reset-password', methods=['POST'])
def reset_password_handler_main():
    """Обработка сброса пароля"""
    try:
        data = request.get_json()
        token = data.get('token')
        new_password = data.get('new_password')
        confirm_password = data.get('confirm_password')
        
        # Валидация данных
        if not token or not new_password or not confirm_password:
            return jsonify({'success': False, 'error': 'Не все поля заполнены'}), 400
        
        if new_password != confirm_password:
            return jsonify({'success': False, 'error': 'Пароли не совпадают'}), 400
        
        if len(new_password) < 6:
            return jsonify({'success': False, 'error': 'Пароль должен содержать минимум 6 символов'}), 400
        
        # Проверяем токен в базе данных
        result = execute_query(
            "SELECT id, email FROM email_auth WHERE reset_token = %s", 
            (token,), 
            fetch=True
        )
            
        if not result:
            return jsonify({'success': False, 'error': 'Недействительный или устаревший токен сброса пароля'}), 400
        
        # Хешируем новый пароль
        import bcrypt
        hashed_password = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt())
        
        # Обновляем пароль и очищаем токен
        execute_query(
            "UPDATE email_auth SET password = %s, reset_token = NULL WHERE id = %s",
            (hashed_password.decode('utf-8'), result['id'])
        )
        
        return jsonify({'success': True, 'message': 'Пароль успешно изменен'}), 200
        
    except Exception as e:
        current_app.logger.error(f"Ошибка при сбросе пароля: {e}")
        return jsonify({'success': False, 'error': 'Внутренняя ошибка сервера'}), 500
