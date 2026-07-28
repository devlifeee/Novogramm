// Функция для создания звезд
function createStars() {
    const starsContainer = document.querySelector('.stars');
    if (!starsContainer) return;

    for (let i = 0; i < 10; i++) { // Меньше звезд для разреженности
        const star = document.createElement('div');
        star.classList.add('star');
        
        // Размер звезды (очень маленькие точки)
        const size = Math.random() * 10 + 1; // 1-3px
        star.style.width = `${size}px`;
        star.style.height = `${size}px`;
        
        // Случайная позиция в левой верхней области
        const startX = Math.random() * (window.innerWidth * 0.9); 
        const startY = Math.random() * (window.innerHeight * 0.9); 
        star.style.left = `${startX}px`;
        star.style.top = `${startY}px`;
        
        // Быстрая анимация
        const duration = Math.random() * 1 + 1.5; // 1.5-2.5 секунды
        star.style.animationDuration = `${duration}s`;
        
        // Случайная задержка для разреженности
        const delay = Math.random() * 3;
        star.style.animationDelay = `${delay}s`;
        
        // Рассчитываем смещение до правого нижнего угла
        const targetX = window.innerWidth - startX;
        const targetY = window.innerHeight - startY;
        star.style.setProperty('--target-x', `${targetX}px`);
        star.style.setProperty('--target-y', `${targetY}px`);
        
        starsContainer.appendChild(star);
        
        // Удаляем звезду 
        setTimeout(() => {
            if (star.parentNode) {
                star.remove();
            }
        }, (duration + delay) * 1000);
    }
}

// Функция инициализации
function initStars() {
    createStars();
}

// Экспортируем для использования в других местах
window.initStars = initStars;

// Обновляем CSS анимацию если еще не добавлена
if (!document.querySelector('style[data-stars-css]')) {
    const style = document.createElement('style');
    style.setAttribute('data-stars-css', 'true');
    style.textContent = `
    @keyframes fall {
        0% {
            opacity: 0;
            transform: translate(0, 0) scale(0.3);
        }
        10% {
            opacity: 1;
            transform: translate(0, 0) scale(1);
        }
        90% {
            opacity: 0.8;
        }
        100% {
            opacity: 0;
            transform: translate(var(--target-x, 100vw), var(--target-y, 100vh)) scale(0.1);
        }
    }

    .star {
        position: absolute;
        background-color: white;
        border-radius: 50%;
        opacity: 0;
        animation: fall linear;
        box-shadow: 0 0 2px rgba(255, 255, 255, 0.8);
        pointer-events: none;
        will-change: transform, opacity;
    }
    `;
    document.head.appendChild(style);
}

// Запускаем создание звезд при загрузке
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        createStars();
    });
} else {
    createStars();
}

// Запускаем создание звезд регулярно
setInterval(createStars, 600); // Создаем звезды реже для разреженности

// Оптимизация для ресайза
if (typeof window.resizeTimeout === 'undefined') {
    window.resizeTimeout = null;
}
window.addEventListener('resize', () => {
    clearTimeout(window.resizeTimeout);
    window.resizeTimeout = setTimeout(() => {
        const starsContainer = document.querySelector('.stars');
        if (starsContainer) {
            starsContainer.innerHTML = '';
            createStars();
        }
    }, 250);
});
