// Global variables for modal reCAPTCHA
let modalRecaptchaWidgetId;

// Функция для показа модального окна
function showPasswordModal() {
    document.getElementById('passwordModal').style.display = 'flex';
    document.getElementById('recovery-email').value = document.getElementById('email').value;
    
    // Initialize reCAPTCHA for modal if not already done (only if not disabled)
    if (!window.RECAPTCHA_DISABLED && typeof window.RECAPTCHA_SITE_KEY !== 'undefined' && window.RECAPTCHA_SITE_KEY && typeof modalRecaptchaWidgetId === 'undefined') {
        waitForRecaptchaReady()
            .then(() => {
                if (typeof grecaptcha !== 'undefined' && typeof grecaptcha.render === 'function') {
                    modalRecaptchaWidgetId = grecaptcha.render('modal-recaptcha-placeholder', {
                        'sitekey': window.RECAPTCHA_SITE_KEY,
                        'theme': 'light'
                    });
                }
            })
            .catch(error => {
                console.error('Modal reCAPTCHA initialization failed:', error);
            });
    }
}

// Функция для скрытия модального окна
function hidePasswordModal() {
    document.getElementById('passwordModal').style.display = 'none';
    document.getElementById('recovery-error').textContent = '';
    document.getElementById('recovery-success').textContent = '';
}

// Функция для отправки запроса на восстановление пароля
async function sendPasswordRecovery() {
    const email = document.getElementById('recovery-email').value.trim();
    const errorElement = document.getElementById('recovery-error');
    const successElement = document.getElementById('recovery-success');
    const buttonElement = document.getElementById('send-recovery');
    
    // Валидация email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
        errorElement.textContent = 'Введите корректный email адрес';
        return;
    }
    
    errorElement.textContent = '';
    successElement.textContent = '';
    
    // Get reCAPTCHA response from modal (only if not disabled)
    let recaptchaResponse = '';
    if (!window.RECAPTCHA_DISABLED) {
        if (typeof grecaptcha !== 'undefined' && typeof modalRecaptchaWidgetId !== 'undefined') {
            recaptchaResponse = grecaptcha.getResponse(modalRecaptchaWidgetId);
            if (!recaptchaResponse) {
                errorElement.textContent = 'Пожалуйста, подтвердите, что вы не робот';
                return;
            }
        }
    }
    
    const originalText = buttonElement.textContent;
    buttonElement.textContent = 'Отправка...';
    buttonElement.disabled = true;
    
    try {
        const response = await fetch('/auth/forgot-password', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                email,
                'g-recaptcha-response': recaptchaResponse 
            })
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
            successElement.textContent = result.message || 'Инструкции по восстановлению пароля отправлены на вашу почту';
            // Reset modal reCAPTCHA
            if (typeof grecaptcha !== 'undefined' && typeof modalRecaptchaWidgetId !== 'undefined') {
                grecaptcha.reset(modalRecaptchaWidgetId);
            }
            setTimeout(hidePasswordModal, 3000);
        } else {
            errorElement.textContent = result.error || 'Произошла ошибка при отправке';
            // Reset modal reCAPTCHA on error
            if (typeof grecaptcha !== 'undefined' && typeof modalRecaptchaWidgetId !== 'undefined') {
                grecaptcha.reset(modalRecaptchaWidgetId);
            }
        }
    } catch (error) {
        console.error('Ошибка восстановления пароля:', error);
        errorElement.textContent = 'Ошибка соединения с сервером';
    } finally {
        buttonElement.textContent = originalText;
        buttonElement.disabled = false;
    }
}

// Инициализация после загрузки DOM
document.addEventListener('DOMContentLoaded', function() {
    createStars();
    
    // Initialize reCAPTCHA (only if not disabled)
    if (!window.RECAPTCHA_DISABLED && typeof window.RECAPTCHA_SITE_KEY !== 'undefined' && window.RECAPTCHA_SITE_KEY) {
        waitForRecaptchaReady()
            .then(() => {
                initializeRecaptchaWidget();
            })
            .catch(error => {
                console.error('reCAPTCHA initialization failed:', error);
            });
    }
    
    const loginForm = document.getElementById('login-form');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const errorMessage = document.getElementById('error-message');
    const forgotPasswordLink = document.getElementById('forgot-password');
    const closeModalBtn = document.getElementById('closeModal');
    const sendRecoveryBtn = document.getElementById('send-recovery');
    
    // Обработчик для ссылки "Забыли пароль?"
    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', function(e) {
            e.preventDefault();
            showPasswordModal();
        });
    }
    
    // Закрытие модального окна
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', hidePasswordModal);
    }
    
    // Обработчик для кнопки отправки инструкций
    if (sendRecoveryBtn) {
        sendRecoveryBtn.addEventListener('click', sendPasswordRecovery);
    }
    
    // Обработчик для формы входа
    if (loginForm) {
        loginForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            errorMessage.textContent = '';

            const email = emailInput.value.trim();
            const password = passwordInput.value;

            if (!email || !password) {
                errorMessage.textContent = 'Пожалуйста, заполните все поля';
                return;
            }

            // Get reCAPTCHA response (only if not disabled)
            let recaptchaResponse = '';
            if (!window.RECAPTCHA_DISABLED) {
                if (typeof grecaptcha !== 'undefined' && typeof recaptchaWidgetId !== 'undefined') {
                    recaptchaResponse = grecaptcha.getResponse(recaptchaWidgetId);
                    // Don't block submission - let server handle missing reCAPTCHA
                }
            }

            try {
                const response = await fetch('/auth/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ 
                        email, 
                        password,
                        'g-recaptcha-response': recaptchaResponse 
                    })
                });

                // Проверяем тип содержимого ответа
                const contentType = response.headers.get('content-type');
                
                if (contentType && contentType.includes('application/json')) {
                    // Обрабатываем JSON-ответ
                    const data = await response.json();

                    if (response.ok && data.success) {
                        // Сохраняем данные пользователя
                        localStorage.setItem('authToken', data.token);
                        localStorage.setItem('userId', data.user.id);
                        localStorage.setItem('userName', data.user.name);
                        localStorage.setItem('userUsername', data.user.username);
                        localStorage.setItem('userEmail', data.user.email);
                        
                        if (data.user.avatar) {
                            localStorage.setItem('userAvatar', data.user.avatar);
                        }
                        if (data.user.banner) {
                            localStorage.setItem('userBanner', data.user.banner);
                        }
                        
                        window.location.href = '/home';
                    } else {
                        errorMessage.textContent = data.error || 'Ошибка входа';
                        // Reset reCAPTCHA if error
                        if (typeof grecaptcha !== 'undefined' && typeof recaptchaWidgetId !== 'undefined') {
                            grecaptcha.reset(recaptchaWidgetId);
                        }
                    }
                } else {
                    // Сервер вернул HTML вместо JSON - это нормально для Flask
                    // Просто перенаправляем браузер, так как сервер уже обработал аутентификацию
                    // и установил сессию или куки
                    window.location.href = '/home';
                }
            } catch (err) {
                console.error('Ошибка при входе:', err);
                errorMessage.textContent = 'Ошибка сети или сервера';
                // Reset reCAPTCHA on error
                if (typeof grecaptcha !== 'undefined' && typeof recaptchaWidgetId !== 'undefined') {
                    grecaptcha.reset(recaptchaWidgetId);
                }
            }
        });
    }
    
    // Валидация email при вводе
    if (emailInput) {
        emailInput.addEventListener('input', function() {
            const email = this.value.trim();
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            
            if (email && !emailRegex.test(email)) {
                errorMessage.textContent = 'Введите корректный email адрес';
            } else {
                errorMessage.textContent = '';
            }
        });
    }
});