console.log('=== HOME.JS ЗАГРУЖЕН ===');
console.log('localStorage при загрузке home.js:', {
    authToken: localStorage.getItem('authToken'),
    userId: localStorage.getItem('userId'),
    userName: localStorage.getItem('userName'),
    userUsername: localStorage.getItem('userUsername'),
    userAvatar: localStorage.getItem('userAvatar'),
    userBanner: localStorage.getItem('userBanner')
});

// === ГЛОБАЛЬНАЯ ФУНКЦИЯ ДЛЯ ОБНОВЛЕНИЯ ДАННЫХ ПОЛЬЗОВАТЕЛЯ ===
window.updateUserData = function() {
    loadUserDataFromAPI();
};

// === ФУНКЦИЯ ЗАГРУЗКИ АКТУАЛЬНЫХ ДАННЫХ ПОЛЬЗОВАТЕЛЯ ИЗ API ===
async function loadUserDataFromAPI() {
    const authToken = localStorage.getItem('authToken');
    if (!authToken) return;

    try {
        const response = await fetch('/api/get_user_data', {
            headers: {
                'Authorization': authToken
            }
        });

        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                const user = data.user;
                
                // Сохраняем в localStorage для синхронизации
                localStorage.setItem('userName', user.name);
                localStorage.setItem('userUsername', user.username);
                localStorage.setItem('userAvatar', user.avatar);
                
                
                // Обновляем отображение
                updateUserDisplay(user);
                
                // Обновляем localStorage
                localStorage.setItem('userName', user.name);
                localStorage.setItem('userUsername', user.username);
                localStorage.setItem('userAvatar', user.avatar);
                
                localStorage.setItem('userBio', user.bio);
                
                console.log('Данные пользователя обновлены из API:', user);
            }
        }
    } catch (error) {
        console.error('Ошибка загрузки данных пользователя:', error);
        // Если API недоступен, используем сохраненные данные
        loadSavedUserData();
    }
}

// === ФУНКЦИЯ ПОЛУЧЕНИЯ АВАТАРА ПОЛЬЗОВАТЕЛЯ ===
function getUserAvatar(userId) {
    // Для текущего пользователя используем данные из localStorage
    const currentUserId = localStorage.getItem('userId');
    if (userId == currentUserId) {
        const avatar = localStorage.getItem('userAvatar');
        return avatar || '/static/images/default-avatar.png';
    }
    
    // Для других пользователей пока используем дефолтный аватар
    // В будущем можно добавить кэширование аватаров других пользователей
    return '/static/images/default-avatar.png';
}

// === ФУНКЦИЯ ОБНОВЛЕНИЯ ОТОБРАЖЕНИЯ ПОЛЬЗОВАТЕЛЯ ===
function updateUserDisplay(user) {
    const userNameElement = document.getElementById('user-name');
    const userUsernameElement = document.getElementById('user-username');
    const userAvatarImgElement = document.getElementById('user-avatar-img');
    

    if (userNameElement) {
        userNameElement.textContent = user.name || 'Новый пользователь';
    }

    if (userUsernameElement) {
        userUsernameElement.textContent = '@' + (user.username || 'новый_пользователь');
    }

    if (userAvatarImgElement) {
        userAvatarImgElement.src = user.avatar || '/static/images/default-avatar.png';
    }

   
}




// === ФУНКЦИЯ ЗАГРУЗКИ И ОТОБРАЖЕНИЯ СОХРАНЕННЫХ ДАННЫХ ПОЛЬЗОВАТЕЛЯ ===
function loadSavedUserData() {
   const savedName = localStorage.getItem('userName');
   const savedUsername = localStorage.getItem('userUsername');
   const savedAvatar = localStorage.getItem('userAvatar');
   

   // Находим элементы на странице по их ID
   const userNameElement = document.getElementById('user-name');
   const userUsernameElement = document.getElementById('user-username');
   const userAvatarImgElement = document.getElementById('user-avatar-img');
   

   // Обновляем полное имя, если элемент найден и данные существуют
   if (userNameElement && savedName) {
       userNameElement.textContent = savedName;
       console.log(`Отображено имя: ${savedName}`);
   } else if (userNameElement) {
       userNameElement.textContent = 'Имя не установлено'; // Или другое значение по умолчанию
   }

   // Обновляем юзернейм, если элемент найден и данные существуют
   if (userUsernameElement && savedUsername) {
       userUsernameElement.textContent = `@${savedUsername}`;
       console.log(`Отображен юзернейм: @${savedUsername}`);
   } else if (userUsernameElement) {
       userUsernameElement.textContent = '@неизвестно'; // Или другое значение по умолчанию
   }

   // Обновляем аватар, если элемент найден и данные существуют
   if (userAvatarImgElement && savedAvatar) {
       userAvatarImgElement.src = savedAvatar;
       console.log(`Установлен аватар: ${savedAvatar}`);
   } else if (userAvatarImgElement) {
       // Установка значения по умолчанию, если аватар не найден
       userAvatarImgElement.src = '/static/images/default-avatar.png';
       console.log('Не найден сохраненный аватар, установлено значение по умолчанию.');
   }

   
}



// === ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ ПРИ ЗАГРУЗКЕ DOM ===
document.addEventListener('DOMContentLoaded', async function() {
    console.log('=== DOMContentLoaded на home.js ===');

    // 1. Сначала загружаем данные, которые уже есть в localStorage.
    // Это позволяет UI обновиться мгновенно, пока мы ждем данные с сервера.
    loadSavedUserData();

    // 2. Проверяем наличие токена авторизации.
    const token = localStorage.getItem('authToken');

    if (!token) {
        console.log("Токен авторизации не найден. Перенаправление на страницу входа/регистрации.");
        // Перенаправляем пользователя на страницу создания аккаунта, если токен отсутствует.
        window.location.href = '/account_creation';
        return; // Прекращаем дальнейшее выполнение скрипта, так как пользователь не авторизован.
    }

    // 3. Если токен существует, запрашиваем актуальные данные пользователя с сервера.
    try {
        console.log("Токен найден. Запрос к '/api/get_user_data'...");
        const userResponse = await fetch('/api/get_user_data', {
            method: 'GET', // Явно указываем метод GET
            headers: {
                'Authorization': token,
                'Content-Type': 'application/json' // Обычно для GET запросов не нужно, но не повредит
            }
        });

        // Обработка ответа сервера
        const userData = await userResponse.json();
        console.log("Ответ от '/api/get_user_data':", userData);

        if (userData.success && userData.user) {
            // Если данные получены успешно и содержат информацию о пользователе:
            console.log("Данные пользователя успешно получены с сервера.");

            // Обновляем localStorage актуальными данными пользователя.
            // Это важно для поддержания синхронизации между localStorage и сервером.
            localStorage.setItem('userId', userData.user.id);
            localStorage.setItem('userName', userData.user.name);
            localStorage.setItem('userUsername', userData.user.username);
            if (userData.user.avatar) localStorage.setItem('userAvatar', userData.user.avatar);
            if (userData.user.banner) localStorage.setItem('userBanner', userData.user.banner);
            if (userData.user.bio) localStorage.setItem('userBio', userData.user.bio);
            // Если есть другие поля, которые нужно сохранить, добавьте их сюда:
            // localStorage.setItem('userEmail', userData.user.email);

            // Повторно вызываем loadSavedUserData, чтобы обновить UI свежими данными с сервера.
            // Это гарантирует, что если данные на сервере изменились, пользователь увидит актуальную информацию.
            loadSavedUserData();

        } else {
            // Если сервер вернул ошибку или не предоставил данные пользователя
            console.error('Ошибка получения данных с сервера:', userData.error || 'Неизвестная ошибка');
            // Удаляем все связанные с пользователем данные из localStorage, так как они, вероятно, недействительны.
            localStorage.removeItem('authToken');
            localStorage.removeItem('userId');
            localStorage.removeItem('userName');
            localStorage.removeItem('userUsername');
            localStorage.removeItem('userAvatar');
            localStorage.removeItem('userBanner');

            // Перенаправляем пользователя на страницу входа/регистрации.
            window.location.href = '/account_creation';
        }

    } catch (error) {
        // Обработка сетевых ошибок (например, сервер недоступен) или ошибок парсинга JSON.
        console.error('Сетевая ошибка или ошибка при обработке ответа от сервера:', error);
        // Удаляем все связанные с пользователем данные из localStorage при сетевых ошибках.
        localStorage.removeItem('authToken');
        localStorage.removeItem('userId');
        localStorage.removeItem('userName');
        localStorage.removeItem('userUsername');
        localStorage.removeItem('userAvatar');
        localStorage.removeItem('userBanner');

        // Перенаправляем пользователя на страницу входа/регистрации.
        window.location.href = '/account_creation';
    }

    // === ДАЛЬНЕЙШАЯ ЛОГИКА ЗАГРУЗКИ КОНТЕНТА СТРАНИЦЫ ===
    // Здесь вы можете добавить вызовы функций для загрузки постов пользователя,
    // уведомлений, ленты и т.д.
    // Например:
    // loadUserPosts();
    // loadNotifications();
    // setupEventListenersForContent(); // Настройка обработчиков событий для динамически загружаемого контента

});

// === ДРУГОЙ КОД (если есть) ===
// Например, определение других функций, которые используются на странице.
/*
function loadUserPosts() {
    console.log("Загрузка постов пользователя...");
    // ... логика загрузки постов
}
*/

// === ФУНКЦИИ ДЛЯ РАБОТЫ С ПОСТАМИ ===

// Функция загрузки постов
async function loadPosts() {
    console.log("Загрузка постов...");
    const authToken = localStorage.getItem('authToken');
    const postsContainer = document.getElementById('posts-container');
    const loading = document.getElementById('loading-posts');
    const noPosts = document.getElementById('no-posts');
    
    // Показываем индикатор загрузки
    loading.style.display = 'flex';
    postsContainer.innerHTML = '';
    noPosts.style.display = 'none';
    
    try {
        const response = await fetch('/get_posts', {
            headers: {
                'Authorization': authToken
            }
        });
        
        if (response.ok) {
            const posts = await response.json();
            console.log("Получены посты:", posts);
            
            // Отладочная информация для юзернеймов
            posts.forEach(post => {
                console.log(`Пост ${post.id}: user_name=${post.user_name}, user_username=${post.user_username}`);
            });
            
            if (posts.length === 0) {
                noPosts.style.display = 'block';
            } else {
                // Отображаем посты
                posts.forEach(post => {
                    const postElement = createPostElement(post);
                    postsContainer.appendChild(postElement);
                });
            }
        } else {
            console.error('Ошибка при загрузке постов:', response.status);
        }
    } catch (error) {
        console.error('Ошибка при загрузке постов:', error);
    } finally {
        loading.style.display = 'none';
    }

    const openComments = loadOpenCommentsState();
    for (const postId in openComments) {
        if (openComments[postId]) {
            await loadComments(postId);
        }
    }

}



// Функция форматирования времени поста
function formatPostTime(timestamp) {
    if (!timestamp) return 'только что';
    
    const postTime = new Date(timestamp);


     //ЗАМЕНИТЬ НАХУЙ И СДЕЛАТЬ ЭТО НА БЕКЕНДЕ
    postTime.setHours(postTime.getHours() + 3);


    
    const now = new Date();
    const diffInMinutes = Math.floor((now - postTime) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'только что';
    if (diffInMinutes < 60) return `${diffInMinutes} мин назад`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours} ч назад`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays} дн назад`;
    
    return postTime.toLocaleDateString();
}

// Функция создания поста
async function createPost(content, imageFile) {
    const authToken = localStorage.getItem('authToken');
    
    if (!authToken) {
        alert('Требуется авторизация');
        return false;
    }
    
    try {
        const formData = new FormData();
        formData.append('content', content);
        
        if (imageFile) {
            formData.append('image', imageFile);
        }
        
        const response = await fetch('/create_post', {
            method: 'POST',
            headers: {
                'Authorization': authToken
            },
            body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
            console.log('Пост успешно создан');
            return true;
        } else {
            console.error('Ошибка при создании поста:', result.error);
            alert('Ошибка: ' + result.error);
            return false;
        }
    } catch (error) {
        console.error('Ошибка при создании поста:', error);
        alert('Ошибка при создании поста');
        return false;
    }
}

// === ОБРАБОТЧИКИ СОБЫТИЙ ===

// Обработчик отправки формы
async function handlePostSubmit(e) {
    e.preventDefault();
    
    const content = document.getElementById('post-content').value.trim();
    const imageInput = document.getElementById('post-image');
    const imageFile = imageInput.files[0];
    
    if (!content) {
        alert('Текст поста не может быть пустым');
        return;
    }
    
    // Блокируем кнопку отправки
    const postButton = document.getElementById('post-button');
    postButton.disabled = true;
    postButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Публикация...';
    
    // Отправляем пост
    const success = await createPost(content, imageFile);
    
    if (success) {
        // Очищаем форму
        document.getElementById('post-content').value = '';
        document.getElementById('image-preview').innerHTML = '';
        imageInput.value = '';
        
        // Обновляем ленту
        await loadPosts();
        
        // Показываем уведомление
        showNotification('Пост успешно опубликован!', 'success');
    }
    
    // Разблокируем кнопку
    postButton.disabled = false;
    postButton.innerHTML = '<i class="fas fa-paper-plane"></i> Опубликовать';
}

// Обработчик изменения текста поста
function handlePostInput() {
    const content = document.getElementById('post-content').value.trim();
    const postButton = document.getElementById('post-button');
    postButton.disabled = !content;
}

// Обработчик добавления изображения
function handleImageAdd() {
    document.getElementById('post-image').click();
}

// Обработчик выбора изображения
function handleImageSelect(e) {
    const file = e.target.files[0];
    const preview = document.getElementById('image-preview');
    
    if (file && allowedFile(file)) {
        const reader = new FileReader();
        
        reader.onload = function(e) {
            preview.innerHTML = `
                <div class="image-preview-container">
                    <img src="${e.target.result}" class="image-preview">
                    <button type="button" class="remove-image-btn" onclick="removeImage()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;
        };
        
        reader.readAsDataURL(file);
    }
}

// Функция удаления изображения
function removeImage() {
    document.getElementById('image-preview').innerHTML = '';
    document.getElementById('post-image').value = '';
}

// Функция проверки разрешенных типов файлов
function allowedFile(file) {
    const allowedExtensions = ['png', 'jpg', 'jpeg', 'gif'];
    const extension = file.name.split('.').pop().toLowerCase();
    return allowedExtensions.includes(extension);
}

// Функция показа уведомления
function showNotification(message, type = 'info') {
    // Создаем элемент уведомления
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas fa-${type === 'success' ? 'check-circle' : 'info-circle'}"></i>
            <span>${message}</span>
        </div>
    `;
    
    // Добавляем стили
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#4CAF50' : '#2196F3'};
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        animation: slideIn 0.3s ease-out;
    `;
    
    // Добавляем в DOM
    document.body.appendChild(notification);
    
    // Удаляем через 3 секунды
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// Добавляем стили для анимации уведомлений
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
    
    .image-preview-container {
        position: relative;
        margin-top: 15px;
        max-width: 300px;
    }
    
    .image-preview {
        width: 100%;
        border-radius: 12px;
        max-height: 200px;
        object-fit: cover;
    }
    
    .remove-image-btn {
        position: absolute;
        top: 10px;
        right: 10px;
        background: rgba(0, 0, 0, 0.6);
        border: none;
        color: white;
        width: 30px;
        height: 30px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
    }
`;
document.head.appendChild(style);

// === ИНИЦИАЛИЗАЦИЯ ПРИ ЗАГРУЗКЕ DOM ===
document.addEventListener('DOMContentLoaded', async function() {
    console.log('=== DOMContentLoaded на home.js ===');
    
    // ... существующий код инициализации ...
    
    // Добавляем обработчики событий для функционала постов
    document.getElementById('post-form').addEventListener('submit', handlePostSubmit);
    document.getElementById('post-content').addEventListener('input', handlePostInput);
    document.getElementById('add-image-btn').addEventListener('click', handleImageAdd);
    document.getElementById('post-image').addEventListener('change', handleImageSelect);
    document.getElementById('refresh-posts-btn').addEventListener('click', loadPosts);
    
    // Загружаем посты после успешной авторизации
    await loadPosts();
    
    // Загружаем комментарии для постов, которые были открыты ранее
    await loadCommentsForOpenPosts();
    
  
});




// Функция для сохранения состояния открытых комментариев
function saveOpenCommentsState(postId, isOpen) {
    const openComments = JSON.parse(localStorage.getItem('openComments') || '{}');
    if (isOpen) {
        openComments[postId] = true;
    } else {
        delete openComments[postId];
    }
    localStorage.setItem('openComments', JSON.stringify(openComments));
}

// Функция для загрузки состояния открытых комментариев
function loadOpenCommentsState() {
    return JSON.parse(localStorage.getItem('openComments') || '{}');
}

// Функция для сохранения загруженных комментариев
function saveCommentsToStorage(postId, comments) {
    const allComments = JSON.parse(localStorage.getItem('postComments') || '{}');
    allComments[postId] = comments;
    localStorage.setItem('postComments', JSON.stringify(allComments));
}

// Функция для загрузки комментариев из хранилища
function loadCommentsFromStorage(postId) {
    const allComments = JSON.parse(localStorage.getItem('postComments') || '{}');
    return allComments[postId] || null;
}

// Функция для обработки лайков
// Функция для обработки лайков
async function toggleLike(postId) {
    const authToken = localStorage.getItem('authToken');
    
    try {
        const response = await fetch(`/api/like_post/${postId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`, // Добавляем Bearer
                'Content-Type': 'application/json'
            }
        });
        
        const result = await response.json();
        
        if (result.success) {
            // Обновляем счетчик лайков на странице
            const likeCountElement = document.querySelector(`.post-likes-count[data-post-id="${postId}"]`);
            const likeIconElement = document.querySelector(`.like-icon[data-post-id="${postId}"]`);
            
            if (likeCountElement) {
                likeCountElement.textContent = result.likes_count;
            }
            
            if (likeIconElement) {
                if (result.action === 'like') {
                    likeIconElement.classList.add('liked');
                    likeIconElement.classList.remove('far');
                    likeIconElement.classList.add('fas');
                } else {
                    likeIconElement.classList.remove('liked');
                    likeIconElement.classList.remove('fas');
                    likeIconElement.classList.add('far');
                }
            }
            
            return true;
        } else {
            console.error('Ошибка при лайке:', result.error);
            return false;
        }
    } catch (error) {
        console.error('Ошибка при лайке:', error);
        return false;
    }
}


// Функция для добавления комментария
async function addComment(postId, content) {
    const authToken = localStorage.getItem('authToken');
    
    try {
        const response = await fetch(`/api/comment_post/${postId}`, {
            method: 'POST',
            headers: {
                'Authorization': authToken,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ content })
        });
        
        const result = await response.json();
        
        if (result.success) {
            // Сохраняем комментарий в localStorage
            const savedComments = loadCommentsFromStorage(postId) || [];
            savedComments.push(result.comment);
            saveCommentsToStorage(postId, savedComments);
            
            // Отображаем новый комментарий (БЕЗ обновления счетчика)
            displayNewComment(result.comment);
            
            return true;
        } else {
            console.error('Ошибка при добавлении комментария:', result.error);
            return false;
        }
    } catch (error) {
        console.error('Ошибка при добавлении комментария:', error);
        return false;
    }
}


// Функция для отображения нового комментария



// Функция для загрузки комментариев

async function loadComments(postId) {
    const authToken = localStorage.getItem('authToken');
    
    try {
        const response = await fetch(`/api/get_comments/${postId}`, {
            headers: {
                'Authorization': authToken
            }
        });
        
        if (response.ok) {
            const comments = await response.json();
            // Сохраняем комментарии в localStorage
            saveCommentsToStorage(postId, comments);
            displayComments(postId, comments);
            return true;
        } else {
            console.error('Ошибка при загрузке комментариев:', response.status);
            // Попробуем загрузить из localStorage при ошибке
            const savedComments = loadCommentsFromStorage(postId);
            if (savedComments) {
                displayComments(postId, savedComments);
                return true;
            }
            return false;
        }
    } catch (error) {
        console.error('Ошибка при загрузке комментариев:', error);
        // Попробуем загрузить из localStorage при ошибке
        const savedComments = loadCommentsFromStorage(postId);
        if (savedComments) {
            displayComments(postId, savedComments);
            return true;
        }
        return false;
    }
}


// Функция для отображения комментариев

function displayComments(postId, comments) {
    const commentsContainer = document.getElementById(`comments-container-${postId}`);
    
    if (commentsContainer) {
        commentsContainer.innerHTML = '';
        
        if (comments.length === 0) {
            commentsContainer.innerHTML = '<p class="no-comments">Пока нет комментариев</p>';
            return;
        }
            
        comments.forEach(comment => {
            const commentElement = document.createElement('div');
            commentElement.className = 'comment-item';
            commentElement.innerHTML = `
                <div class="comment-header">
                    <div class="comment-user-info">
                        <img src="${getUserAvatar(comment.user_id)}" alt="Аватар" class="comment-avatar">
                        <div class="comment-user-details">
                            <div class="comment-author-name">${comment.user_name || 'Неизвестный пользователь'}</div>
                            <div class="comment-author-username">@${comment.user_username || 'неизвестный'}</div>
                            <span class="comment-time">${formatPostTime(comment.created_at)}</span>
                        </div>
                    </div>
                </div>
                <div class="comment-content">
                    <p>${comment.content}</p>
                </div>
            `;
            
            commentsContainer.appendChild(commentElement);
        });
        
        // Обновляем счетчик комментариев на актуальное количество
        const commentsCountElement = document.querySelector(`.comments-count[data-post-id="${postId}"]`);
        if (commentsCountElement) {
            commentsCountElement.textContent = comments.length;
        }
    }
}

// Функция для автоматической загрузки комментариев при открытии страницы
async function loadCommentsForOpenPosts() {
    const openComments = loadOpenCommentsState();
    const postIds = Object.keys(openComments);
    
    for (const postId of postIds) {
        const commentsContainer = document.getElementById(`comments-container-${postId}`);
        const addCommentSection = commentsContainer?.nextElementSibling;
        
        if (commentsContainer && addCommentSection) {
            commentsContainer.style.display = 'block';
            addCommentSection.style.display = 'block';
            
            // Проверяем, есть ли сохраненные комментарии в localStorage
            const savedComments = loadCommentsFromStorage(postId);
            if (savedComments) {
                // Отображаем сохраненные комментарии
                displayComments(postId, savedComments);
            } else {
                // Загружаем комментарии с сервера, если их нет в localStorage
                await loadComments(postId);
            }
        }
    }
}

// Обработчик для кнопок лайков
document.addEventListener('click', function(e) {
    if (e.target.closest('.like-action')) {
        const postId = e.target.closest('.like-action').dataset.postId;
        toggleLike(postId);
    }
});

// Обработчик для кнопок комментариев
document.addEventListener('click', function(e) {
    if (e.target.closest('.comment-action')) {
        const postId = e.target.closest('.comment-action').dataset.postId;
        toggleComments(postId);
    }
});

// Функция для переключения отображения комментариев
async function toggleComments(postId) {
    const commentsContainer = document.getElementById(`comments-container-${postId}`);
    const commentInput = commentsContainer.querySelector('.comment-input');
    const commentSubmitBtn = commentsContainer.querySelector('.comment-submit-btn');
    
    if (commentsContainer.style.display === 'none') {
        // Показываем комментарии
        commentsContainer.style.display = 'block';
        
        // Загружаем комментарии, если они еще не загружены
        if (commentsContainer.innerHTML === '') {
            await loadComments(postId);
        }
    } else {
        // Скрываем комментарии
        commentsContainer.style.display = 'none';
    }
}

// Обработчик отправки комментария
document.addEventListener('click', function(e) {
    if (e.target.classList.contains('comment-submit-btn') || 
        e.target.closest('.comment-submit-btn')) {
        const btn = e.target.classList.contains('comment-submit-btn') 
            ? e.target 
            : e.target.closest('.comment-submit-btn');
        const postId = btn.dataset.postId;
        submitComment(postId);
    }
});

    
    // Обработчик открытия/закрытия комментариев
    if (e.target.closest('.comment-action')) {
        const postId = e.target.closest('.comment-action').dataset.postId;
        const commentsContainer = document.getElementById(`comments-container-${postId}`);
        const addCommentSection = commentsContainer.nextElementSibling;
        
        if (commentsContainer.style.display === 'none') {
            // Показываем комментарии
            commentsContainer.style.display = 'block';
            addCommentSection.style.display = 'block';
            saveOpenCommentsState(postId, true);
            
            // Загружаем комментарии, если они еще не загружены
            if (commentsContainer.innerHTML === '') {
                loadComments(postId);
            }
        } else {
            // Скрываем комментарии
            commentsContainer.style.display = 'none';
            addCommentSection.style.display = 'none';
            saveOpenCommentsState(postId, false);
        }
    }
    
    document.addEventListener('click', function(e) {
    if (e.target.classList.contains('comment-submit-btn')) {
        const postId = e.target.dataset.postId;
        submitComment(postId);
    }
});


// Обработчик нажатия Enter в поле комментария
document.addEventListener('keypress', function(e) {
    if (e.target.classList.contains('comment-input') && e.key === 'Enter') {
        e.preventDefault();
        const postId = e.target.dataset.postId;
        const content = e.target.value.trim();
        
        if (content) {
            addComment(postId, content);
            e.target.value = '';
        }
    }
});


// Функция для загрузки популярных каналов
        async function loadPopularChannels() {
            try {
                const token = localStorage.getItem('authToken');
                const response = await fetch('/api/popular_channels', {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                
                if (response.ok) {
                    const channels = await response.json();
                    displayChannels(channels);
                } else {
                    console.error('Ошибка при загрузке каналов');
                    // Для демонстрации используем mock данные
                    displayMockChannels();
                }
            } catch (error) {
                console.error('Ошибка при загрузке каналов:', error);
                // Для демонстрации используем mock данные
                displayMockChannels();
            }
        }
        
        // Функция для загрузки предложенных пользователей
        async function loadSuggestedUsers() {
            try {
                const token = localStorage.getItem('authToken');
                const response = await fetch('/api/suggested_users', {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                
                if (response.ok) {
                    const users = await response.json();
                    displaySuggestedUsers(users);
                } else {
                    console.error('Ошибка при загрузке предложенных пользователей');
                    // Для демонстрации используем mock данные
                    displayMockSuggestedUsers();
                }
            } catch (error) {
                console.error('Ошибка при загрузке предложенных пользователей:', error);
                // Для демонстрации используем mock данные
                displayMockSuggestedUsers();
            }
        }
        
        // Функция для отображения каналов
        function displayChannels(channels) {
            const container = document.getElementById('channels-container');
            const noChannels = document.getElementById('no-channels');
            
            if (!channels || channels.length === 0) {
                container.innerHTML = '';
                noChannels.style.display = 'block';
                return;
            }
            
            noChannels.style.display = 'none';
            container.innerHTML = '';
            
            channels.forEach(channel => {
                const channelElement = createChannelElement(channel);
                container.appendChild(channelElement);
            });
        }
        
        // Функция для отображения предложенных пользователей
        function displaySuggestedUsers(users) {
            const container = document.getElementById('suggestions-container');
            const noSuggestions = document.getElementById('no-suggestions');
            
            if (!users || users.length === 0) {
                container.innerHTML = '';
                noSuggestions.style.display = 'block';
                return;
            }
            
            noSuggestions.style.display = 'none';
            container.innerHTML = '';
            
            users.forEach(user => {
                const userElement = createSuggestedUserElement(user);
                container.appendChild(userElement);
            });
        }
        
        // Функция создания элемента канала
        function createChannelElement(channel) {
            const element = document.createElement('div');
            element.className = 'user-card';
            
            element.innerHTML = `
                <img src="${channel.avatar || '/static/images/freedom_img.jpg'}" alt="Аватар" class="user-card-avatar">
                <div class="user-card-info">
                    <div class="user-card-name">${channel.name}</div>
                    <div class="user-card-username">@${channel.username}</div>
                    <div class="user-card-stats">${channel.followers} подписчиков</div>
                </div>
                <button class="follow-btn ${channel.is_following ? 'following' : ''}" data-user-id="${channel.id}">
                    ${channel.is_following ? 'Отписаться' : 'Подписаться'}
                </button>
            `;
            
            return element;
        }
        
        // Функция создания элемента предложенного пользователя
        function createSuggestedUserElement(user) {
            const element = document.createElement('div');
            element.className = 'user-card';
            
            element.innerHTML = `
                <img src="${user.avatar || '/static/images/freedom_img.jpg'}" alt="Аватар" class="user-card-avatar">
                <div class="user-card-info">
                    <div class="user-card-name">${user.name}</div>
                    <div class="user-card-username">@${user.username}</div>
                    <div class="user-card-stats">${user.mutual_friends || 0} общих друзей</div>
                </div>
                <button class="follow-btn ${user.is_following ? 'following' : ''}" data-user-id="${user.id}">
                    ${user.is_following ? 'Отписаться' : 'Подписаться'}
                </button>
            `;
            
            return element;
        }
        
        // Функция для подписки/отписки
        async function toggleFollow(userId, button) {
            try {
                const token = localStorage.getItem('authToken');
                const isFollowing = button.classList.contains('following');
                const endpoint = isFollowing ? '/api/unfollow' : '/api/follow';
                
                const response = await fetch(`${endpoint}/${userId}`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });
                
                if (response.ok) {
                    // Переключаем состояние кнопки
                    if (isFollowing) {
                        button.classList.remove('following');
                        button.textContent = 'Подписаться';
                    } else {
                        button.classList.add('following');
                        button.textContent = 'Отписаться';
                    }
                    
                    // Обновляем счетчики (в реальном приложении можно обновить данные с сервера)
                    showNotification(isFollowing ? 'Вы отписались' : 'Вы подписались', 'success');
                } else {
                    console.error('Ошибка при изменении подписки');
                    showNotification('Произошла ошибка', 'error');
                }
            } catch (error) {
                console.error('Ошибка при изменении подписки:', error);
                showNotification('Произошла ошибка', 'error');
            }
        }
        
        // Mock данные для демонстрации
        function displayMockChannels() {
            const mockChannels = [
                {
                    id: 1,
                    name: 'Писюны',
                    username: 'dildo',
                    avatar: '/static/images/freedom_img.jpg',
                    followers: 1488,
                    is_following: true
                },
                {
                    id: 2,
                    name: 'Программирование',
                    username: 'coding_life',
                    avatar: '/static/images/freedom_img.jpg',
                    followers: 8720,
                    is_following: true
                },
                {
                    id: 3,
                    name: 'хуета',
                    username: 'design_masters',
                    avatar: '/static/images/freedom_img.jpg',
                    followers: 12500,
                    is_following: true
                }
            ];
            
            displayChannels(mockChannels);
        }
        
       function displayMockSuggestedUsers() {
            const mockUsers = [
                {
                    id: 101,
                    name: 'Всеволод Присекин',
                    username: 'razrab',
                    avatar: '/static/images/freedom_img.jpg',
                    mutual_friends: 5,
                    is_following: true
                },
                {
                    id: 102,
                    name: 'Артем ',
                    username: 'pidoras_@',
                    avatar: '/static/images/freedom_img.jpg',
                    mutual_friends: 3,
                    is_following: true
                },
                {
                    id: 103,
                    name: 'Ваня',
                    username: 'pidoras_!',
                    avatar: '/static/images/freedom_img.jpg',
                    mutual_friends: 8,
                    is_following: true
                }
            ];
            
            displaySuggestedUsers(mockUsers);
        }
        
        
        
        // Инициализация при загрузке DOM
        document.addEventListener('DOMContentLoaded', function() {
            // Загрузка каналов и предложенных пользователей
            loadPopularChannels();
            loadSuggestedUsers();
            
            // Обработчики кнопок обновления
            document.getElementById('refresh-channels').addEventListener('click', loadPopularChannels);
            document.getElementById('refresh-suggestions').addEventListener('click', loadSuggestedUsers);
            
            // Обработчик для кнопок подписки (делегирование событий)
            document.addEventListener('click', function(e) {
                if (e.target.classList.contains('follow-btn')) {
                    const userId = e.target.getAttribute('data-user-id');
                    toggleFollow(userId, e.target);
                }
            });
        });


        // поозунок чтобы двигать посты
        document.addEventListener('DOMContentLoaded', function() {
        const resizeHandle = document.getElementById('resize-handle');
        const postsFeed = document.getElementById('posts-feed');
        const contentContainer = document.querySelector('.content-container');
        const rightSidebar = document.querySelector('.right-sidebar');
        
        let isResizing = false;
        
        resizeHandle.addEventListener('mousedown', function(e) {
            isResizing = true;
            document.addEventListener('mousemove', handleResize);
            document.addEventListener('mouseup', stopResize);
            e.preventDefault();
        });
        
        function handleResize(e) {
            if (!isResizing) return;
            
            const containerRect = document.querySelector('.main-content').getBoundingClientRect();
            const percentage = Math.min(Math.max((e.clientX - containerRect.left) / containerRect.width * 100, 50), 85);
            
            contentContainer.style.width = percentage + '%';
            rightSidebar.style.width = (100 - percentage - 1) + '%';
        }
        
        function stopResize() {
            isResizing = false;
            document.removeEventListener('mousemove', handleResize);
            document.removeEventListener('mouseup', stopResize);
            
            // Сохраняем настройки ширины
            localStorage.setItem('contentContainerWidth', contentContainer.style.width);
            localStorage.setItem('rightSidebarWidth', rightSidebar.style.width);
        }
        
        // Загружаем сохраненные настройки ширины
        const savedContentWidth = localStorage.getItem('contentContainerWidth');
        const savedSidebarWidth = localStorage.getItem('rightSidebarWidаth');
        
        if (savedContentWidth && savedSidebarWidth) {
            contentContainer.style.width = savedContentWidth;
            rightSidebar.style.width = savedSidebarWidth;
        }
    });

// Функция для отображения меню поста
function togglePostMenu(button) {
    const dropdown = button.nextElementSibling;
    const isShowing = dropdown.classList.contains('show');
    
    // Закрыть все открытые меню
    document.querySelectorAll('.post-menu-dropdown.show').forEach(menu => {
        if (menu !== dropdown) {
            menu.classList.remove('show');
        }
    });
    
    // Переключить текущее меню
    dropdown.classList.toggle('show', !isShowing);
}

// Функция для копирования ссылки на пост
function copyPostLink(postId) {
    const link = `${window.location.origin}/post/${postId}`;
    
    navigator.clipboard.writeText(link)
        .then(() => {
            showNotification('Ссылка скопирована в буфер обмена', 'success');
        })
        .catch(err => {
            console.error('Ошибка при копировании ссылки: ', err);
            showNotification('Не удалось скопировать ссылку', 'error');
        });
}

// Функция для открытия поддержки
function openSupport(postId) {
    // переход в поддержку
    alert(`Открыть поддержку для поста ${postId}`);
}




function createPostElement(post) {
    const postElement = document.createElement('div');
    postElement.className = 'post-item';
    postElement.dataset.postId = post.id;
    
    const commentsCount = post.comments_count || 0;
    
    //источник изображения
    let imageHtml = '';
    console.log(`Пост ${post.id}:`, {
        image_path: post.image_path,
        has_image_data: !!post.image_data,
        image_data_length: post.image_data ? post.image_data.length : 0
    });
    
    if (post.image_data) {
        // Используем base64 данные из БД
        console.log(`Используем base64 для поста ${post.id}`);
        imageHtml = `<img src="data:image/jpeg;base64,${post.image_data}" alt="Изображение поста" class="post-image">`;
    } else if (post.image_path) {
        // Используем старый путь к файлу
        console.log(`Используем image_path для поста ${post.id}: ${post.image_path}`);
        imageHtml = `<img src="/static/${post.image_path}" alt="Изображение поста" class="post-image">`;
    } else {
        console.log(`Нет изображения для поста ${post.id}`);
    }
    
    postElement.innerHTML = `
        <div class="post-header">
            <img src="${getUserAvatar(post.user_id)}" alt="Аватар" class="post-avatar">
            <div class="post-user-info">
                <div class="post-user-name">${post.user_name || 'Новый пользователь'}</div>
                ${post.user_username ? `<div class="post-user-username">@${post.user_username}</div>` : ''}
                <span class="post-time">${formatPostTime(post.created_at)}</span>
            </div>
            <div class="post-menu">
                <button class="post-menu-btn" onclick="togglePostMenu(this)">
                    <i class="fas fa-ellipsis-h"></i>
                </button>
                <div class="post-menu-dropdown">
                    <div class="post-menu-item" onclick="openSupport(${post.id})">
                        <i class="fas fa-question-circle"></i>
                        <span>Пожаловаться</span>
                    </div>
                    <div class="post-menu-item" onclick="copyPostLink(${post.id})">
                        <i class="fas fa-link"></i>
                        <span>Копировать ссылку на пост</span>
                    </div>
                </div>
            </div>
        </div>
        <div class="post-content">
            <p>${post.content}</p>
            ${imageHtml}
        </div>
        <div class="post-actions">
            <div class="post-action like-action" data-post-id="${post.id}">
                <i class="${post.is_liked ? 'fas' : 'far'} fa-heart like-icon ${post.is_liked ? 'liked' : ''}" data-post-id="${post.id}"></i>
                <span class="post-likes-count" data-post-id="${post.id}">${post.likes_count || 0}</span>
            </div>
            <div class="post-action comment-action" data-post-id="${post.id}">
                <i class="far fa-comment"></i>
                <span class="comments-count" data-post-id="${post.id}">${commentsCount}</span>
            </div>
            
            <div class="post-action">
                <i class="far fa-share-square"></i>
                <span>0</span>
            </div>
            
            <div class="comment-input-container">
                <textarea class="comment-input" placeholder="Добавить комментарий" data-post-id="${post.id}"></textarea>
                <button class="comment-submit-btn" data-post-id="${post.id}">
                    <img src="/static/images/svoboda.png" alt="Отправить комментарий">
                </button>
            </div>
        </div>
        <div class="post-comments" id="comments-container-${post.id}" style="display: none;"></div>
    `;
    
    return postElement;
}

function displayNewComment(comment) {
    const commentsContainer = document.getElementById(`comments-container-${comment.post_id}`);

    if (commentsContainer) {
        const commentElement = document.createElement('div');
        commentElement.className = 'comment-item';
        commentElement.innerHTML = `
            <div class="comment-header">
                <div class="comment-user-info">
                    <img src="${getUserAvatar(comment.user_id)}" alt="Аватар" class="comment-avatar">
                    <div class="comment-user-details">
                        <div class="comment-author-name">${comment.user_name || 'Неизвестный пользователь'}</div>
                        <div class="comment-author-username">@${comment.user_username || 'неизвестный'}</div>
                        <span class="comment-time">${formatPostTime(comment.created_at)}</span>
                    </div>
                </div>
            </div>
            <div class="comment-content">
                <p>${comment.content}</p>
            </div>
        `;
        
        commentsContainer.appendChild(commentElement);
        
        // УБИРАЕМ обновление счетчика здесь, так как это будет делаться в submitComment
        // Показываем контейнер комментариев, если он был скрыт
        commentsContainer.style.display = 'block';
        
        // Сохраняем новый комментарий в localStorage
        const savedComments = loadCommentsFromStorage(comment.post_id) || [];
        savedComments.push(comment);
        saveCommentsToStorage(comment.post_id, savedComments);
    }
}

async function submitComment(postId) {
    const commentInput = document.querySelector(`.comment-input[data-post-id="${postId}"]`);
    const content = commentInput.value.trim();
    
    if (content) {
        const success = await addComment(postId, content);
        if (success) {
            commentInput.value = '';
            
            // Обновляем счетчик комментариев
            const commentsCountElement = document.querySelector(`.comments-count[data-post-id="${postId}"]`);
            if (commentsCountElement) {
                let currentCount = parseInt(commentsCountElement.textContent) || 0;
                commentsCountElement.textContent = currentCount + 1;
            }
            
            // Перезагружаем комментарии для этого поста
            await loadComments(postId);
        }
    }
}

//сохранение
function saveAppState() {
    const appState = {
        openComments: loadOpenCommentsState(),
        posts: Array.from(document.querySelectorAll('.post-item')).map(post => {
            return {
                id: post.dataset.postId,
                // Другие данные поста
            };
        })
    };
    localStorage.setItem('appState', JSON.stringify(appState));
}

// И функцию для восстановления состояния
function loadAppState() {
    const savedState = localStorage.getItem('appState');
    if (savedState) {
        return JSON.parse(savedState);
    }
    return null;
}

// Вызывайте saveAppState при изменении состояния
document.addEventListener('DOMContentLoaded', function() {
    // Восстановление состояния
    const savedState = loadAppState();
    if (savedState) {
        // Восстановите открытые комментарии и другую информацию
    }
    
    // Сохраняем состояние при изменении
    setInterval(saveAppState, 5000); // Автосохранение каждые 5 секунд
});


document.addEventListener('keypress', function(e) {
    if (e.target.classList.contains('comment-input') && e.key === 'Enter') {
        e.preventDefault();
        const postId = e.target.dataset.postId;
        submitComment(postId);
    }
});


 // JavaScript для обработки наведения на sidebar
        const sidebar = document.querySelector('.sidebar');
        const logoImg = document.querySelector('.logo img');
        const logoText = document.querySelector('.logo span');
        
        // Функция для обновления позиции sidebar
        function updateSidebarPosition() {
            const headerHeight = document.querySelector('.header').offsetHeight;
            sidebar.style.top = `${headerHeight}px`;
            sidebar.style.height = `calc(100vh - ${headerHeight}px)`;
        }
        
        // Обновляем при загрузке и изменении размера окна
        window.addEventListener('load', updateSidebarPosition);
        window.addEventListener('resize', updateSidebarPosition);


        // Функция для загрузки нового аватара
async function uploadAvatar(file) {
    const token = localStorage.getItem('authToken');
    if (!token) {
        alert('Требуется авторизация');
        return false;
    }

    try {
        const formData = new FormData();
        formData.append('avatar', file);

        const response = await fetch('/api/profile/avatar', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });

        const result = await response.json();
        
        if (result.success) {
            // Обновляем localStorage
            localStorage.setItem('userAvatar', result.avatar_url);
            
            // Обновляем изображение на странице
            const userAvatarImgElement = document.getElementById('user-avatar-img');
            if (userAvatarImgElement) {
                userAvatarImgElement.src = result.avatar_url;
            }
            
            // Обновляем другие данные пользователя если они вернулись
            if (result.user) {
                localStorage.setItem('userName', result.user.name);
                localStorage.setItem('userUsername', result.user.username);
                loadSavedUserData(); // Перезагружаем данные
            }
            
            showNotification('Аватар успешно обновлен!', 'success');
            return true;
        } else {
            showNotification('Ошибка: ' + result.error, 'error');
            return false;
        }
    } catch (error) {
        console.error('Ошибка при загрузке аватара:', error);
        showNotification('Ошибка при загрузке аватара', 'error');
        return false;
    }
}

// Обработчик выбора файла аватара
function handleAvatarSelect(e) {
    const file = e.target.files[0];
    if (file && allowedFile(file)) {
        uploadAvatar(file);
    } else {
        showNotification('Недопустимый формат файла', 'error');
    }
}

// Добавьте это в инициализацию DOM
document.addEventListener('DOMContentLoaded', function() {
    // ... существующий код ...
    
    // Добавляем обработчик для input аватара
    const avatarInput = document.getElementById('avatar-input');
    if (avatarInput) {
        avatarInput.addEventListener('change', handleAvatarSelect);
    }
    
    // Добавляем обработчик клика по аватару для выбора файла
    const avatarContainer = document.getElementById('avatar-container');
    if (avatarContainer) {
        avatarContainer.addEventListener('click', function() {
            document.getElementById('avatar-input').click();
        });
    }
});

