import bcrypt
import re
import random
import requests
import os
import base64
from flask import Blueprint, request, jsonify, render_template, current_app, url_for, g, make_response
from app.utils import is_valid_email, send_verification_email, send_password_reset_email
import psycopg2
import psycopg2.extras
from app.database import execute_query
from datetime import datetime, timedelta

auth_bp = Blueprint('auth', __name__)

def generate_verification_code():
    return str(random.randint(10000, 99999))

def generate_nonce():
    return base64.b64encode(os.urandom(16)).decode('utf-8')

@auth_bp.before_request
def set_nonce():
    g.nonce = generate_nonce()

# @auth_bp.route('/')
# def registration_page():
#     """Отображение страницы регистрации"""
#     response = make_response(render_template('auth/registration.html', 
#                                            nonce=g.nonce, 
#                                            recaptcha_site_key=current_app.config['RECAPTCHA_SITE_KEY'],
#                                            recaptcha_disabled=current_app.config.get('RECAPTCHA_DISABLED', False)))
    
#     # Set Content Security Policy
#     csp = (
#         f"default-src 'self'; "
#         f"script-src 'self' 'nonce-{g.nonce}' https://www.google.com https://www.gstatic.com https://www.recaptcha.net; "
#         f"style-src 'self' https://cdnjs.cloudflare.com https://fonts.googleapis.com 'unsafe-inline'; "
#         f"style-src-elem 'self' https://cdnjs.cloudflare.com https://fonts.googleapis.com 'unsafe-inline'; "
#         f"font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com; "
#         f"img-src 'self' data: https://www.google.com https://www.gstatic.com; "
#         f"connect-src 'self' https://www.google.com https://www.gstatic.com https://www.recaptcha.net; "
#         f"frame-src https://www.google.com https://www.recaptcha.net; "
#         f"frame-ancestors 'self' https://www.google.com; "
#         f"worker-src blob:; "
#         f"object-src 'none'; base-uri 'self';"
#     )
#     response.headers['Content-Security-Policy'] = csp
#     response.headers['Cache-Control'] = 'no-store'
#     return response 

# @auth_bp.route('/privacy')
# def privacy_policy():
#     return render_template('auth/privacy_policy.html')

# @auth_bp.route('/forgot-password')
# def forgot_password_page():
#     response = make_response(render_template('auth/forgot_password.html', 
#                                            nonce=g.nonce, 
#                                            recaptcha_site_key=current_app.config['RECAPTCHA_SITE_KEY'],
#                                            recaptcha_disabled=current_app.config.get('RECAPTCHA_DISABLED', False)))
    
#     # Set Content Security Policy
#     csp = (
#         f"default-src 'self'; "
#         f"script-src 'self' 'nonce-{g.nonce}' https://www.google.com https://www.gstatic.com https://www.recaptcha.net; "
#         f"object-src 'none'; "
#         f"style-src 'self' https://cdnjs.cloudflare.com https://fonts.googleapis.com 'unsafe-inline'; "
#         f"style-src-elem 'self' https://cdnjs.cloudflare.com https://fonts.googleapis.com 'unsafe-inline'; "
#         f"font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com; "
#         f"img-src 'self' data: https://www.google.com https://www.gstatic.com; "
#         f"connect-src 'self' https://www.google.com https://www.gstatic.com https://www.recaptcha.net; "
#         f"frame-src https://www.google.com https://www.recaptcha.net; "
#         f"base-uri 'self'; "
#         f"frame-ancestors 'self' https://www.google.com; "
#         f"worker-src blob:; "
#         f"child-src blob:;"
#     )
#     response.headers['Content-Security-Policy'] = csp
#     return response

@auth_bp.route('/register', methods=['POST'])
def register():
    """Обработка регистрации нового пользователя"""
    current_app.logger.warning("=== НАЧАЛО РЕГИСТРАЦИИ ===")
    
    try:
        data = request.get_json()
        current_app.logger.warning(f"Received data: {data}")
        current_app.logger.warning(f"Request headers: {dict(request.headers)}")
        current_app.logger.warning(f"Request method: {request.method}")
        current_app.logger.warning(f"Request content type: {request.content_type}")
    except Exception as e:
        current_app.logger.error(f"Error parsing JSON: {e}")
        return jsonify({'success': False, 'error': 'Invalid JSON format'}), 400
    
    if not data:
        current_app.logger.error("No JSON data received")
        return jsonify({'success': False, 'error': 'Invalid request format'}), 400
        
    email = data.get('email')
    password = data.get('password')
    # Поддерживаем оба формата: camelCase и snake_case
    confirm_password = data.get('confirmPassword') or data.get('confirm_password')
    recaptcha_response = data.get('g-recaptcha-response')
    
    current_app.logger.info(f"Registration attempt for email: {email}")

    # Валидация данных
    if not email or not password:
        current_app.logger.error("Missing email or password")
        return jsonify({'success': False, 'error': 'Заполните все поля'}), 400
        
    if not is_valid_email(email):
        current_app.logger.error(f"Invalid email format: {email}")
        return jsonify({'success': False, 'error': 'Некорректный email'}), 400
        
    if password != confirm_password:
        current_app.logger.error("Passwords don't match")
        return jsonify({'success': False, 'error': 'Пароли не совпадают'}), 400

    # reCAPTCHA verification (skip if disabled)
    if not current_app.config.get('RECAPTCHA_DISABLED', False):
        if not recaptcha_response:
            current_app.logger.error("Missing reCAPTCHA response")
            return jsonify({'success': False, 'error': 'Пожалуйста, подтвердите, что вы не робот.'}), 400

        # Verify reCAPTCHA with Google servers
        recaptcha_verification_url = "https://www.google.com/recaptcha/api/siteverify"
        verification_payload = {
            'secret': current_app.config['RECAPTCHA_SECRET_KEY'],
            'response': recaptcha_response,
            'remoteip': request.remote_addr
        }

        try:
            current_app.logger.info(f"Verifying reCAPTCHA... Token length: {len(recaptcha_response) if recaptcha_response else 0}")
            current_app.logger.info(f"Using secret key: {current_app.config['RECAPTCHA_SECRET_KEY'][:20]}...")
            verification_response = requests.post(recaptcha_verification_url, data=verification_payload)
            verification_result = verification_response.json()
            
            current_app.logger.info(f"reCAPTCHA API response: {verification_result}")
            
            if not verification_result.get('success'):
                error_codes = verification_result.get('error-codes', [])
                current_app.logger.error(f"reCAPTCHA verification failed: {error_codes}")
                
                # Более детальные сообщения об ошибках
                if 'invalid-input-secret' in error_codes:
                    return jsonify({'success': False, 'error': 'Ошибка конфигурации reCAPTCHA. Обратитесь к администратору.'}), 500
                elif 'invalid-input-response' in error_codes:
                    return jsonify({'success': False, 'error': 'Недействительный токен reCAPTCHA. Попробуйте еще раз.'}), 400
                elif 'timeout-or-duplicate' in error_codes:
                    return jsonify({'success': False, 'error': 'Токен reCAPTCHA истек или уже использован. Попробуйте еще раз.'}), 400
                else:
                    return jsonify({'success': False, 'error': 'Подтверждение reCAPTCHA не пройдено. Пожалуйста, попробуйте еще раз.'}), 400
                
            current_app.logger.info("✅ reCAPTCHA verification successful")
        except requests.exceptions.RequestException as e:
            current_app.logger.error(f"Error communicating with reCAPTCHA API: {e}")
            return jsonify({'success': False, 'error': 'Не удалось проверить reCAPTCHA. Пожалуйста, попробуйте позже.'}), 500
    else:
        current_app.logger.info("⚠️ reCAPTCHA verification skipped (disabled in config)")

    # Проверка существования пользователя в БД PostgreSQL
    try:
        current_app.logger.info("Checking if user already exists...")
        result = execute_query(
            "SELECT id FROM email_auth WHERE email = %s", 
            (email,), 
            fetch=True
        )
        current_app.logger.info(f"User exists check result: {result}")
        
        if result:
            current_app.logger.warning(f"User already exists: {email}")
            return jsonify({'success': False, 'error': 'Пользователь с таким email уже существует'}), 400
    except Exception as e:
        current_app.logger.error(f"Ошибка БД при проверке пользователя: {str(e)}")
        return jsonify({'success': False, 'error': 'Ошибка базы данных'}), 500
    
    # Хэшируем пароль
    current_app.logger.info("Hashing password...")
    hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
    current_app.logger.info("Password hashed successfully")
    
    # Создаем пользователя сразу в основной таблице (неподтвержденный)
    try:
        current_app.logger.info("Creating user in database...")
        user_result = execute_query(
            "INSERT INTO email_auth (email, password, verified) VALUES (%s, %s, FALSE) RETURNING id",
            (email, hashed_password.decode('utf-8')),
            fetch=True
        )
        current_app.logger.info(f"✅ Created user in email_auth: {user_result}")
        
        if not user_result:
            current_app.logger.error("User creation returned None!")
            return jsonify({'success': False, 'error': 'Ошибка при создании пользователя'}), 500
            
    except Exception as e:
        current_app.logger.error(f"❌ Ошибка создания пользователя: {str(e)}")
        return jsonify({'success': False, 'error': 'Ошибка при создании пользователя'}), 500
    
    # Генерация кода подтверждения
    current_app.logger.info("Generating verification code...")
    code = generate_verification_code()
    expires_at = datetime.now() + timedelta(minutes=30)
    current_app.logger.info(f"Generated code: {code}")
    
    # Сохраняем код в базу данных
    try:
        current_app.logger.info("Saving verification code...")
        # Сначала удаляем старые коды для этого email
        execute_query(
            "DELETE FROM verification_codes WHERE email = %s",
            (email,)
        )
        
        # Сохраняем новый код
        execute_query(
            "INSERT INTO verification_codes (email, code, expires_at) VALUES (%s, %s, %s)",
            (email, code, expires_at)
        )
        current_app.logger.info(f"✅ Saved verification code for {email}: {code}")
    except Exception as e:
        current_app.logger.error(f"❌ Ошибка сохранения кода: {str(e)}")
        return jsonify({'success': False, 'error': 'Ошибка при сохранении кода подтверждения'}), 500

    # Отправка email с кодом подтверждения
    current_app.logger.info("Sending verification email...")
    
    # Проверяем флаг SKIP_EMAIL_VERIFICATION (используется для разработки)
    if current_app.config.get('SKIP_EMAIL_VERIFICATION', False):
        current_app.logger.info("⚠️ Email verification skipped (SKIP_EMAIL_VERIFICATION enabled)")
        # Генерируем токен авторизации и сразу верифицируем пользователя
        import secrets
        auth_token = secrets.token_urlsafe(32)
        
        # Обновляем пользователя с токеном и отмечаем как верифицированного
        execute_query(
            "UPDATE email_auth SET verified = TRUE, auth_token = %s WHERE email = %s",
            (auth_token, email)
        )
        
        return jsonify({
            'success': True,
            'message': 'Регистрация успешна (письмо не отправляется в режиме разработки)',
            'token': auth_token
        }), 200
    
    if send_verification_email(email, code):
        current_app.logger.info("✅ Verification email sent successfully")
        return jsonify({'success': True}), 200
    else:
        current_app.logger.error("❌ Failed to send verification email")
        return jsonify({
            'success': False, 
            'error': 'Ошибка отправки кода подтверждения'
        }), 500

@auth_bp.route('/resend', methods=['POST'])
def resend_verification_code():
    """Повторная отправка кода подтверждения"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'error': 'No JSON data provided'}), 400
        
        email = data.get('email')
        
        if not email:
            return jsonify({'success': False, 'error': 'Email is required'}), 400
        
        current_app.logger.info(f"Resending verification code for: {email}")
        
        # Проверяем, что пользователь существует и не подтвержден
        user_check = execute_query(
            "SELECT id, verified FROM email_auth WHERE email = %s",
            (email,),
            fetch=True
        )
        
        if not user_check:
            return jsonify({'success': False, 'error': 'Пользователь не найден'}), 404
        
        if user_check[0]['verified']:
            return jsonify({'success': False, 'error': 'Email уже подтвержден'}), 400
        
        # Генерация нового кода подтверждения
        code = generate_verification_code()
        expires_at = datetime.now() + timedelta(minutes=30)
        
        # Удаляем старые коды для этого email
        execute_query("DELETE FROM verification_codes WHERE email = %s", (email,))
        
        # Сохраняем новый код
        execute_query(
            "INSERT INTO verification_codes (email, code, expires_at) VALUES (%s, %s, %s)",
            (email, code, expires_at)
        )
        
        # Отправка email с кодом подтверждения
        if send_verification_email(email, code):
            current_app.logger.info(f"✅ Resent verification code to {email}")
            return jsonify({'success': True, 'message': 'Код подтверждения отправлен повторно'}), 200
        else:
            current_app.logger.error(f"❌ Failed to resend verification email to {email}")
            return jsonify({'success': False, 'error': 'Ошибка отправки email'}), 500
            
    except Exception as e:
        current_app.logger.error(f"Resend error: {str(e)}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

# @auth_bp.route('/account_creation')
# def account_creation():
#     """Страница завершения регистрации"""
#     email = request.args.get('email')
#     return render_template('auth/account.html', email=email)

@auth_bp.route('/verify_code', methods=['POST'])
@auth_bp.route('/verify', methods=['POST'])
def verify_code():
    """Проверка кода подтверждения email"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'error': 'No JSON data provided'}), 400
        
        email = data.get('email')
        code = data.get('code')
        
        current_app.logger.info(f"Verifying code for email: {email}, code: {code}")
        
        if not email or not code:
            return jsonify({'success': False, 'error': 'Email and code are required'}), 400

        # Проверяем код подтверждения в базе данных
        query = """
            SELECT * FROM verification_codes 
            WHERE email = %s AND code = %s
        """
        result = execute_query(query, (email, code), fetch=True)
        
        if result:
            # Проверяем срок действия кода в Python
            expires_at = result['expires_at']
            
            # Конвертируем в datetime если это строка
            if isinstance(expires_at, str):
                try:
                    # Пытаемся спарсить ISO формат
                    expires_at = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
                except:
                    try:
                        # Пытаемся спарсить другой формат
                        expires_at = datetime.strptime(expires_at, '%Y-%m-%d %H:%M:%S')
                    except:
                        current_app.logger.error(f"Cannot parse expires_at: {expires_at}")
                        expires_at = datetime.now()  # Устанавливаем прошлое время, если не удалось спарсить
            
            if expires_at > datetime.now():
                current_app.logger.info(f"Code verified for {email}")
                
                # Удаляем использованный код подтверждения
                execute_query("DELETE FROM verification_codes WHERE email = %s AND code = %s", (email, code))
                
                # Помечаем пользователя как подтвержденного
                execute_query("UPDATE email_auth SET verified = TRUE WHERE email = %s", (email,))
                current_app.logger.info(f"User {email} verified successfully")
                
                return jsonify({
                    'success': True, 
                    'message': 'Email verified successfully',
                    'redirect': f'/auth/account_creation?email={email}'
                })
            else:
                current_app.logger.warning(f"Verification code expired for {email}")
                return jsonify({
                    'success': False, 
                    'error': 'Код подтверждения истек. Запросите новый код.'
                }), 400
        else:
            current_app.logger.warning(f"Invalid verification code for {email}")
            return jsonify({
                'success': False, 
                'error': 'Неверный код подтверждения'
            }), 400
            
    except Exception as e:
        current_app.logger.error(f"Verification error: {str(e)}")
        return jsonify({
            'success': False, 
            'error': 'Internal server error'
        }), 500

@auth_bp.route('/complete_registration', methods=['POST'])
def complete_registration():
    """Завершение регистрации"""
    try:
        data = request.get_json()
        email = data.get('email')
        name = data.get('name')
        username = data.get('username').strip().lower() if data.get('username') else None
        
        current_app.logger.info(f"Complete registration for: {email}, name: {name}, username: {username}")
        
        # Проверка данных 
        if not email or not name or not username:
            return jsonify({'success': False, 'error': 'Заполните все поля'}), 400
        
        # Валидация username
        if not re.match(r'^[a-z0-9_.]+$', username):
            return jsonify({'success': False, 'error': 'Username может содержать только буквы, цифры, подчеркивание и точки'}), 400
        
        if len(username) < 3 or len(username) > 10:
            return jsonify({'success': False, 'error': 'Username должен быть от 3 до 10 символов'}), 400
        
        # Пользователь уже должен существовать после верификации email
        current_app.logger.info(f"Completing registration for verified user: {email}")
        
        # Сначала проверим, что пользователь действительно существует
        user_exists = execute_query(
            "SELECT id, email, verified FROM email_auth WHERE email = %s", 
            (email,), 
            fetch=True
        )
        current_app.logger.info(f"User exists check: {user_exists}")
        
        if not user_exists:
            current_app.logger.error(f"User does not exist for email: {email}")
            return jsonify({'success': False, 'error': 'Пользователь не найден. Пожалуйста, пройдите регистрацию заново.'}), 404
        
        # Проверка уникальности username
        username_check = execute_query(
            "SELECT id FROM email_auth WHERE username = %s AND email != %s",
            (username, email),
            fetch=True
        )
        current_app.logger.info(f"Username check result: {username_check}")
        
        if username_check:
            current_app.logger.warning(f"Username already taken: {username}")
            return jsonify({'success': False, 'error': 'Этот username уже занят'}), 400
        
        # Генерация токена аутентификации
        auth_token = bcrypt.gensalt().decode('utf-8')[:32]
        
        # Обновление данных пользователя
        update_query = """
            UPDATE email_auth 
            SET name = %s, username = %s, auth_token = %s
            WHERE email = %s
            RETURNING id
        """
        current_app.logger.info(f"Executing update query for email: {email}")
        result = execute_query(update_query, (name, username, auth_token, email), fetch=True)
        current_app.logger.info(f"Update result: {result}")
        
        if not result:
            current_app.logger.error(f"Failed to update user for email: {email}")
            return jsonify({'success': False, 'error': 'Ошибка обновления пользователя'}), 500
        
        user_id = result['id']
        current_app.logger.info(f"Registration completed for user ID: {user_id}")
            
        return jsonify({
            'success': True, 
            'message': 'Регистрация успешно завершена!',
            'user': {
                'id': user_id,
                'email': email,
                'name': name,
                'username': username,
                'token': auth_token
            },
            'redirect': '/home'
        }), 200 
  
    except Exception as e:
        current_app.logger.error(f"Ошибка при завершении регистрации: {str(e)}")
        return jsonify({'success': False, 'error': 'Внутренняя ошибка сервера'}), 500

@auth_bp.route('/forgot-password', methods=['POST'])
@auth_bp.route('/api/forgot-password', methods=['POST'])  # Дополнительный маршрут
def forgot_password():
    try:
        data = request.get_json()
        email = data.get('email')
        recaptcha_response = data.get('g-recaptcha-response')

        # reCAPTCHA verification (skip if disabled)
        if not current_app.config.get('RECAPTCHA_DISABLED', False):
            if not recaptcha_response:
                current_app.logger.error("Missing reCAPTCHA response")
                return jsonify({'error': 'Пожалуйста, подтвердите, что вы не робот.'}), 400

            # Verify reCAPTCHA with Google servers
            recaptcha_verification_url = "https://www.google.com/recaptcha/api/siteverify"
            verification_payload = {
                'secret': current_app.config['RECAPTCHA_SECRET_KEY'],
                'response': recaptcha_response,
                'remoteip': request.remote_addr
            }

            try:
                current_app.logger.info("Verifying reCAPTCHA...")
                verification_response = requests.post(recaptcha_verification_url, data=verification_payload)
                verification_result = verification_response.json()
                
                if not verification_result.get('success'):
                    current_app.logger.error(f"reCAPTCHA verification failed: {verification_result.get('error-codes')}")
                    return jsonify({'error': 'Подтверждение reCAPTCHA не пройдено. Пожалуйста, попробуйте еще раз.'}), 400
                    
                current_app.logger.info("✅ reCAPTCHA verification successful")
            except requests.exceptions.RequestException as e:
                current_app.logger.error(f"Error communicating with reCAPTCHA API: {e}")
                return jsonify({'error': 'Не удалось проверить reCAPTCHA. Пожалуйста, попробуйте позже.'}), 500
        else:
            current_app.logger.info("⚠️ reCAPTCHA verification skipped (disabled in config)")
        
        # Проверяем, существует ли пользователь с таким email
        result = execute_query(
            "SELECT id FROM email_auth WHERE email = %s", 
            (email,), 
            fetch=True
        )
            
        if not result:
            return jsonify({'error': 'Пользователь с таким email не найден'}), 404
        
        # Генерируем токен для сброса пароля
        reset_token = bcrypt.gensalt().decode('utf-8')[:32]
        
        # Сохраняем токен в базе данных
        execute_query(
            "UPDATE email_auth SET reset_token = %s WHERE email = %s",
            (reset_token, email)
        )
        
        # Отправляем email с инструкциями по восстановлению пароля
        if send_password_reset_email(email, reset_token):
            return jsonify({'success': True, 'message': 'Инструкции по восстановлению отправлены на email'}), 200
        else:
            return jsonify({'success': False, 'error': 'Ошибка отправки email'}), 500
        
    except Exception as e:
        print(f"Ошибка при восстановлении пароля: {e}")
        return jsonify({'error': 'Внутренняя ошибка сервера'}), 500

# @auth_bp.route('/reset-password')
# def reset_password_page():
#     """Страница сброса пароля"""
#     token = request.args.get('token')
#     if not token:
#         return render_template('auth/reset_password.html', token='', error='Недействительная ссылка')
#     return render_template('auth/reset_password.html', token=token)

@auth_bp.route('/reset-password', methods=['POST'])
def reset_password_handler():
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
        hashed_password = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt())
        
        # Обновляем пароль и очищаем токен
        execute_query(
            "UPDATE email_auth SET password = %s, reset_token = NULL WHERE id = %s",
            (hashed_password.decode('utf-8'), result['id'])
        )
        
        return jsonify({'success': True, 'message': 'Пароль успешно изменен'}), 200
        
    except Exception as e:
        print(f"Ошибка при сбросе пароля: {e}")
        return jsonify({'success': False, 'error': 'Внутренняя ошибка сервера'}), 500

# @auth_bp.route('/login') 
# def login_page():
#     response = make_response(render_template('auth/login.html', 
#                                            nonce=g.nonce, 
#                                            recaptcha_site_key=current_app.config['RECAPTCHA_SITE_KEY'],
#                                            recaptcha_disabled=current_app.config.get('RECAPTCHA_DISABLED', False)))
    
    # Set Content Security Policy
    csp = (
        f"default-src 'self'; "
        f"script-src 'self' 'nonce-{g.nonce}' https://www.google.com https://www.gstatic.com https://www.recaptcha.net; "
        f"object-src 'none'; "
        f"style-src 'self' https://cdnjs.cloudflare.com https://fonts.googleapis.com 'unsafe-inline'; "
        f"style-src-elem 'self' https://cdnjs.cloudflare.com https://fonts.googleapis.com 'unsafe-inline'; "
        f"font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com; "
        f"img-src 'self' data: https://www.google.com https://www.gstatic.com; "
        f"connect-src 'self' https://www.google.com https://www.gstatic.com https://www.recaptcha.net; "
        f"frame-src https://www.google.com https://www.recaptcha.net; "
        f"base-uri 'self'; "
        f"frame-ancestors 'self' https://www.google.com; "
        f"worker-src blob:; "
        f"child-src blob:;"
    )
    response.headers['Content-Security-Policy'] = csp
    return response

@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()

    email = data.get('email')
    password = data.get('password')
    recaptcha_response = data.get('g-recaptcha-response')

    if not email or not password:
        return jsonify({'error': 'Заполните все поля'}), 400
    
    if not is_valid_email(email):
        return jsonify({'error': 'Некорректный email'}), 400

    # reCAPTCHA verification (skip if disabled)
    if not current_app.config.get('RECAPTCHA_DISABLED', False):
        if not recaptcha_response:
            current_app.logger.error("Missing reCAPTCHA response")
            return jsonify({'error': 'Пожалуйста, подтвердите, что вы не робот.'}), 400

        # Verify reCAPTCHA with Google servers
        recaptcha_verification_url = "https://www.google.com/recaptcha/api/siteverify"
        verification_payload = {
            'secret': current_app.config['RECAPTCHA_SECRET_KEY'],
            'response': recaptcha_response,
            'remoteip': request.remote_addr
        }

        try:
            current_app.logger.info("Verifying reCAPTCHA...")
            verification_response = requests.post(recaptcha_verification_url, data=verification_payload)
            verification_result = verification_response.json()
            
            if not verification_result.get('success'):
                current_app.logger.error(f"reCAPTCHA verification failed: {verification_result.get('error-codes')}")
                return jsonify({'error': 'Подтверждение reCAPTCHA не пройдено. Пожалуйста, попробуйте еще раз.'}), 400
                
            current_app.logger.info("✅ reCAPTCHA verification successful")
        except requests.exceptions.RequestException as e:
            current_app.logger.error(f"Error communicating with reCAPTCHA API: {e}")
            return jsonify({'error': 'Не удалось проверить reCAPTCHA. Пожалуйста, попробуйте позже.'}), 500
    else:
        current_app.logger.info("⚠️ reCAPTCHA verification skipped (disabled in config)")
        
    try:
        # Получаем пользователя из базы данных
        result = execute_query(
            "SELECT * FROM email_auth WHERE email = %s", 
            (email,), 
            fetch=True
        )
        
        if not result:
            return jsonify({'error': 'Пользователь не найден'}), 404

        # Проверяем, что email подтвержден
        if not result.get('verified', False):
            return jsonify({'error': 'Пожалуйста, подтвердите ваш email перед входом'}), 403

        # Проверяем пароль через bcrypt
        if not bcrypt.checkpw(password.encode('utf-8'), result['password'].encode('utf-8')):
            return jsonify({'error': 'Неверный пароль'}), 401

        return jsonify({
            'success': True,
            'message': 'Успешный вход', 
            'redirect': url_for('main.home'),
            'token': result.get('auth_token', ''),
            'user': {
                'id': result.get('id'),
                'name': result.get('name'),
                'username': result.get('username'),
                'email': result.get('email'),
                'avatar': result.get('avatar'),
                'banner': result.get('banner')
            }
        }), 200
    except Exception as e:
        current_app.logger.error(f"Ошибка входа: {str(e)}")
        return jsonify({'error': 'Внутренняя ошибка сервера'}), 500

# Эндпоинт для проверки токена
@auth_bp.route('/api/get_user_data', methods=['GET'])
def get_user_data():
    auth_token = request.headers.get('Authorization')
    if not auth_token:
        return jsonify({'error': 'Требуется авторизация'}), 401
    
    try:
        result = execute_query(
            "SELECT id, name, username, avatar, banner FROM email_auth WHERE auth_token = %s", 
            (auth_token,), 
            fetch=True
        )
            
        if result:
            return jsonify({
                'success': True,
                'id': result['id'],
                'name': result['name'],
                'username': result['username'],
                'avatar': result['avatar'] or '/static/images/default-avatar.png',
                'banner': result['banner'] or '/static/images/default-banner.jpg'
            }), 200
        return jsonify({'success': False, 'error': 'Пользователь не найден'}), 404
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

def _get_user_by_token(auth_token: str):
    """Возвращает строку пользователя по токену или None."""
    if not auth_token:
        return None
    try:
        result = execute_query(
            "SELECT id, name, username, avatar FROM email_auth WHERE auth_token = %s",
            (auth_token,),
            fetch=True
        )
        return result
    except Exception:
        return None

@auth_bp.route('/api/posts/<int:post_id>/comments', methods=['POST'])
def create_comment(post_id: int):
    """Создать комментарий к посту. Требуется заголовок Authorization с токеном."""
    try:
        auth_token = request.headers.get('Authorization')
        user = _get_user_by_token(auth_token)
        if not user:
            return jsonify({'success': False, 'error': 'Требуется авторизация'}), 401

        data = request.get_json(silent=True) or {}
        content = (data.get('content') or '').strip()

        if not content:
            return jsonify({'success': False, 'error': 'Текст комментария обязателен'}), 400
        if len(content) > 1000:
            return jsonify({'success': False, 'error': 'Комментарий слишком длинный (макс. 1000)'}), 400

        # Проверим, существует ли пост
        post_check = execute_query("SELECT id FROM posts WHERE id = %s", (post_id,), fetch=True)
        if not post_check:
            return jsonify({'success': False, 'error': 'Пост не найден'}), 404

        # Создаем комментарий
        comment_result = execute_query(
            "INSERT INTO comments (user_id, post_id, content) VALUES (%s, %s, %s) RETURNING id",
            (user['id'], post_id, content),
            fetch=True
        )
        comment_id = comment_result['id']

        return jsonify({
            'success': True,
            'comment': {
                'id': comment_id,
                'post_id': post_id,
                'user': {
                    'id': user['id'],
                    'name': user['name'],
                    'username': user['username'],
                    'avatar': user.get('avatar') or '/static/images/default-avatar.png'
                },
                'content': content
            }
        }), 201

    except Exception as e:
        current_app.logger.error(f"Ошибка создания комментария: {str(e)}")
        return jsonify({'success': False, 'error': f'Внутренняя ошибка: {str(e)}'}), 500

@auth_bp.route('/api/posts/<int:post_id>/comments', methods=['GET'])
def list_comments(post_id: int):
    """Список комментариев к посту с данными автора."""
    try:
        # Убедимся, что пост существует
        post_check = execute_query("SELECT id FROM posts WHERE id = %s", (post_id,), fetch=True)
        if not post_check:
            return jsonify({'success': False, 'error': 'Пост не найден'}), 404

        # Получаем комментарии с данными пользователей
        comments_data = execute_query(
            """
            SELECT c.id, c.content, c.created_at,
                   u.id AS user_id, u.name, u.username, u.avatar
            FROM comments c
            JOIN email_auth u ON u.id = c.user_id
            WHERE c.post_id = %s
            ORDER BY c.created_at DESC, c.id DESC
            """,
            (post_id,),
            fetchall=True
        )

        comments = []
        for r in comments_data:
            comments.append({
                'id': r['id'],
                'content': r['content'],
                'created_at': r['created_at'],
                'user': {
                    'id': r['user_id'],
                    'name': r['name'],
                    'username': r['username'],
                    'avatar': r['avatar'] or '/static/images/default-avatar.png'
                }
            })

        return jsonify({'success': True, 'comments': comments}), 200

    except Exception as e:
        current_app.logger.error(f"Ошибка получения комментариев: {str(e)}")
        return jsonify({'success': False, 'error': f'Внутренняя ошибка: {str(e)}'}), 500
