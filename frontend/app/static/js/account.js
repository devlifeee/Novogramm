// account.js

document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('account-creation-form');

    // Проверка, существует ли форма перед добавлением обработчика
    if (form) {
        form.addEventListener('submit', async function(e) {
            e.preventDefault(); // Предотвращаем стандартное поведение отправки формы

            const emailInput = document.getElementById('email');
            const nameInput = document.getElementById('name');
            const usernameInput = document.getElementById('username');

            // Проверяем, существуют ли элементы, прежде чем получить их значения
            if (!emailInput || !nameInput || !usernameInput) {
                console.error("Не найдены обязательные поля формы (email, name, username).");
                alert('Ошибка в настройке формы. Пожалуйста, обратитесь к разработчику.');
                return;
            }

            const email = emailInput.value;
            const name = nameInput.value.trim();
            const username = usernameInput.value.trim().toLowerCase();

            // Простая валидация
            if (!name || !username) {
                alert('Пожалуйста, заполните все поля');
                return;
            }

            if (!/^[a-z0-9_.]+$/.test(username)) {
                alert('Username может содержать только буквы, цифры, подчеркивание и точки');
                return;
            }

            if (username.length < 3 || username.length > 10) {
                alert('Username должен быть от 3 до 10 символов');
                return;
            }

            try {
                // Показываем состояние загрузки
                const btn = document.querySelector('.btn');
                if (btn) {
                    btn.disabled = true;
                    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Создание аккаунта...';
                }

                const response = await fetch('/auth/complete_registration', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        email: email,
                        name: name,
                        username: username
                    })
                });

                const result = await response.json();

                if (result.success) {
                    // СОХРАНЯЕМ ВСЕ ДАННЫЕ ПОЛЬЗОВАТЕЛЯ В localStorage ПЕРЕД ПЕРЕНАПРАВЛЕНИЕМ
                    if (result.user) {
                        localStorage.setItem('authToken', result.user.token);
                        localStorage.setItem('userId', result.user.id);
                        localStorage.setItem('userName', result.user.name); // Полное имя
                        localStorage.setItem('userUsername', result.user.username); // Имя пользователя
                        localStorage.setItem('userEmail', result.user.email);
                        // Сохраняем другие данные, если они есть в result.user
                        if(result.user.avatar) localStorage.setItem('userAvatar', result.user.avatar);
                        if(result.user.banner) localStorage.setItem('userBanner', result.user.banner);

                        console.log('Данные пользователя сохранены:', result.user);
                    }

                    // Перенаправляем на домашнюю страницу или страницу, указанную в ответе
                    window.location.href = result.redirect || '/home';

                } else {
                    // Если API вернул ошибку (result.success === false)
                    throw new Error(result.error || 'Ошибка при создании аккаунта');
                }

            } catch (error) {
                console.error('Ошибка при отправке формы:', error);
                alert('Произошла ошибка: ' + error.message);

                // Сбрасываем состояние кнопки, если произошла ошибка
                const btn = document.querySelector('.btn');
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = 'Начать общение'; // Или текст, который был изначально
                }
            }
        });
    } else {
        console.error("Форма с ID 'account-creation-form' не найдена.");
    }

    // Автозаполнение email из URL параметров
    const urlParams = new URLSearchParams(window.location.search);
    const emailFromUrl = urlParams.get('email'); // Используем другое имя переменной

    if (emailFromUrl) {
        const emailInput = document.getElementById('email');
        if (emailInput) {
            emailInput.value = emailFromUrl;
        } else {
            console.error("Не найден элемент для автозаполнения email.");
        }
    }
});

// Важно: Второй блок кода, который был в корне account.js, был удален,
// так как его логика теперь полностью реализована внутри обработчика submit.
