document.addEventListener('DOMContentLoaded', function() {
    // Инициализация только для страницы сброса пароля
    const resetForm = document.getElementById('reset-password-form');
    
    if (resetForm) {
        initResetPasswordPage();
    }
});

// Функция для инициализации страницы сброса пароля
function initResetPasswordPage() {
    const resetForm = document.getElementById('reset-password-form');
    const newPasswordInput = document.getElementById('new-password');
    const confirmPasswordInput = document.getElementById('confirm-password');
    const errorMessage = document.getElementById('error-message');
    const successMessage = document.getElementById('success-message');
    
    // Получаем токен из URL параметров
    const urlParams = new URLSearchParams(window.location.search);
    let resetToken = urlParams.get('token');
    
    // Проверяем, есть ли токен
    if (!resetToken) {
        errorMessage.textContent = 'Недействительная ссылка для сброса пароля';
        errorMessage.style.display = 'block';
        resetForm.style.display = 'none';
        return;
    }
    
    // Валидация паролей при вводе
    function validatePasswords() {
        const newPassword = newPasswordInput.value;
        const confirmPassword = confirmPasswordInput.value;
        
        if (newPassword.length < 8) {
            errorMessage.textContent = 'Пароль должен содержать минимум 8 символов';
            errorMessage.style.display = 'block';
            return false;
        }
        
        if (newPassword !== confirmPassword) {
            errorMessage.textContent = 'Пароли не совпадают';
            errorMessage.style.display = 'block';
            return false;
        }
        
        errorMessage.textContent = '';
        errorMessage.style.display = 'none';
        return true;
    }
    
    newPasswordInput.addEventListener('input', validatePasswords);
    confirmPasswordInput.addEventListener('input', validatePasswords);
    
    // Обработка отправки формы
    resetForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const newPassword = newPasswordInput.value.trim();
        const confirmPassword = confirmPasswordInput.value.trim();
        
        // Очищаем сообщения
        errorMessage.textContent = '';
        errorMessage.style.display = 'none';
        successMessage.textContent = '';
        successMessage.style.display = 'none';
        
        // Валидация
        if (!newPassword || !confirmPassword) {
            errorMessage.textContent = 'Пожалуйста, заполните все поля';
            errorMessage.style.display = 'block';
            return;
        }
        
        if (!validatePasswords()) {
            return;
        }
        
        try {
            // Показываем состояние загрузки
            const button = document.getElementById('reset-button');
            const originalText = button.textContent;
            button.disabled = true;
            button.textContent = 'Изменение пароля...';
            
            const response = await fetch('/reset-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    token: resetToken,
                    new_password: newPassword,
                    confirm_password: confirmPassword
                })
            });
            
            const result = await response.json();
            
            if (response.ok && result.success) {
                successMessage.textContent = 'Пароль успешно изменен! Перенаправление...';
                successMessage.style.display = 'block';
                
                // Перенаправляем на страницу входа через 2 секунды
                setTimeout(() => {
                    window.location.href = '/login';
                }, 2000);
            } else {
                errorMessage.textContent = result.error || 'Ошибка при изменении пароля';
                errorMessage.style.display = 'block';
            }
            
        } catch (error) {
            console.error('Ошибка:', error);
            errorMessage.textContent = 'Ошибка соединения с сервером';
            errorMessage.style.display = 'block';
        } finally {
            // Восстанавливаем кнопку
            const button = document.getElementById('reset-button');
            if (button) {
                button.disabled = false;
                button.textContent = 'Изменить пароль';
            }
        }
    });
}