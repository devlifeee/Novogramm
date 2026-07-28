import re
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from flask import current_app

def is_valid_email(email):
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None

def send_verification_email(email, code):
    try:
        msg = MIMEMultipart('alternative')
        msg['Subject'] = 'Код подтверждения регистрации'
        msg['From'] = current_app.config['EMAIL_USER']
        msg['To'] = email
        
        # HTML версия письма (упрощенная)
        html = f"""
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
</head>
<body style="font-family: Arial, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; padding: 30px; box-shadow: 0 3px 10px rgba(0,0,0,0.1);">
    <!-- Логотип -->
    <img src="https://i.postimg.cc/N5Z3Xvhg/LOGO2.png" alt="Novogramm Logo" style="display: block; margin: 0 auto 20px; width: 200px;">
    
    <!-- Заголовок -->
    <h1 style="color: #333; text-align: center; margin-bottom: 30px;">Подтверждение создания аккаунта</h1>
    
    <!-- Основной текст -->
    <p style="font-size: 16px; color: #555; line-height: 1.5; text-align: center;">
      Ваш код подтверждения для Novogramm:
    </p>
    
    <!-- Блок с кодом -->
    <div style="text-align: center; margin: 25px 0;">
      <div style="
        display: inline-block;
        padding: 15px 30px;
        background-color: #f8f9fa;
        border: 2px dashed  #333;
        border-radius: 8px;
        font-size: 28px;
        font-weight: bold;
        letter-spacing: 3px;
        color:  #333;
      ">
        {code}
      </div>
    </div>
    
    <!-- Предупреждение -->
    <p style="font-size: 14px; color:  #333; text-align: center; font-weight: bold;">
      Никому не сообщайте и не показывайте этот код!
    </p>
  </div>
    
  <!-- Футер -->
  <p style="text-align: center; color: #aaa; font-size: 12px; margin-top: 20px;">
    Это письмо отправлено автоматически. Пожалуйста, не отвечайте на него.
  </p>
</body>
</html>
"""
        
        msg.attach(MIMEText(html, 'html'))
        
        with smtplib.SMTP(
            current_app.config['SMTP_SERVER'],
            current_app.config['SMTP_PORT']
        ) as server:
            server.starttls()
            server.login(
                current_app.config['EMAIL_USER'],
                current_app.config['EMAIL_PASSWORD']
            )
            server.send_message(msg)
        return True
    except Exception as e:
        print(f"Ошибка отправки email: {str(e)}")
        return False