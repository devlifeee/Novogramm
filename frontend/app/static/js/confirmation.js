// Функция для создания анимации частиц
function createParticles() {
    const container = document.getElementById('particles');
    const particleCount = 15;
    
    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.classList.add('particle');
        
        const size = Math.random() * 50 + 20;
        const posX = Math.random() * 100;
        const posY = Math.random() * 100 + 100;
        const delay = Math.random() * 15;
        const duration = Math.random() * 10 + 15;
        
        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;
        particle.style.left = `${posX}%`;
        particle.style.top = `${posY}%`;
        particle.style.animationDelay = `${delay}s`;
        particle.style.animationDuration = `${duration}s`;
        
        container.appendChild(particle);
    }
}

// Функция для отображения уведомлений
function showNotification(message, type) {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = 'notification ' + type;
    notification.classList.add('show');
    
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

// Функция для подсчета времени до повторной отправки
function startCountdown(seconds) {
    const countdownElement = document.querySelector('.countdown');
    const resendLink = document.getElementById('resend-link');
    let count = seconds;
    
    resendLink.style.pointerEvents = 'none';
    resendLink.style.opacity = '0.7';
    
    const interval = setInterval(() => {
        countdownElement.textContent = count;
        count--;
        
        if (count < 0) {
            clearInterval(interval);
            countdownElement.textContent = '';
            resendLink.innerHTML = 'Отправить снова';
            resendLink.style.pointerEvents = 'auto';
            resendLink.style.opacity = '1';
        }
    }, 1000);
}

// Асинхронная функция для отправки кода на сервер
async function submitCode() {
    const inputs = document.querySelectorAll('.code-input');
    let code = '';
    inputs.forEach(input => code += input.value);
    
    const email = localStorage.getItem('registerEmail');
    if (!email) {
        showNotification('Сессия истекла. Пожалуйста, начните регистрацию заново.', 'error');
        return;
    }
    
    const submitBtn = document.getElementById('submit');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Отправка...';
    
    try {
        const response = await fetch('/auth/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, code })
        });
        
        const data = await response.json();
        
        if (data.success && data.redirect) {
            window.location.href = data.redirect;
        } else {
            showNotification(data.error || 'Неизвестная ошибка сервера', 'error');
            inputs.forEach(input => input.value = '');
            inputs[0].focus();
        }
    } catch (error) {
        console.error('Ошибка:', error);
        showNotification('Произошла ошибка при отправке кода: ' + error.message, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Подтвердить';
    }
}

// Показываем email пользователя
const email = localStorage.getItem('registerEmail') || 'user@example.com';
document.getElementById('email-display').textContent = email;

// Инициализация после загрузки страницы
document.addEventListener('DOMContentLoaded', function() {
    createParticles();
    const email = localStorage.getItem('registerEmail') || 'user@example.com';
    document.getElementById('email-display').textContent = email;
    
    const inputs = document.querySelectorAll('.code-input');
    inputs.forEach((input, index) => {
        input.addEventListener('input', () => {
            if (input.value) {
                if (index < inputs.length - 1) {
                    inputs[index + 1].focus();
                }
            }
        });
        
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !input.value && index > 0) {
                inputs[index - 1].focus();
            }
        });
    });
    
    inputs[0].focus();
    
    document.getElementById('submit').addEventListener('click', submitCode);
    
    document.getElementById('resend-link').addEventListener('click', async function(e) {
        e.preventDefault();
        const email = localStorage.getItem('registerEmail');
        if (!email) {
            showNotification('Ошибка: email не найден', 'error');
            return;
        }
        try {
            const resp = await fetch('/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json'},
                body: JSON.stringify({ email: email, password: 'placeholder', confirmPassword: 'placeholder' })
            });
            const data = await resp.json();
            if (data.success) {
                showNotification('Новый код отправлен!', 'success');
                startCountdown(60);
            } else {
                showNotification(data.error || 'Ошибка при отправке кода', 'error');
            }
        } catch (err) {
            showNotification('Ошибка сети: ' + err.message, 'error');
        }
    });
    
    startCountdown(60);
});