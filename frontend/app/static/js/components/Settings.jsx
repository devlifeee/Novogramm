import React, { useState, useEffect } from 'react';
import AvatarModal from './AvatarModal';

const Settings = () => {
    // Загружаем данные из localStorage или используем значения по умолчанию
    const [name, setName] = useState(localStorage.getItem('userName') || 'Ванечек');
    const [username, setUsername] = useState(localStorage.getItem('userUsername') || 'ivan');
    const [avatar, setAvatar] = useState(localStorage.getItem('userAvatar') || '/static/images/freedom_img.jpg');
    const [bio, setBio] = useState(localStorage.getItem('userBio') || 'Люблю программирование и путешествия ');
    
    const [isEditingName, setIsEditingName] = useState(false);
    const [isEditingUsername, setIsEditingUsername] = useState(false);
    const [isEditingBio, setIsEditingBio] = useState(false);
    const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
    const [tempName, setTempName] = useState(name);
    const [tempUsername, setTempUsername] = useState(username);
    const [tempBio, setTempBio] = useState(bio);
    
    // Статистика пользователя
    const [stats, setStats] = useState({
        posts: 0,
        followers: 0,
        following: 0
    });
    
    // Пример постов пользователя
    const [userPosts, setUserPosts] = useState([
        {
            id: 1,
            content: 'скоро дроп',
            date: '2 часа назад',
            likes: 42,
            comments: 8
        },
        {
            id: 2,
            content: 'Новый проект почти готов...',
            date: '1 день назад',
            likes: 128,
            comments: 15
        },
        {
            id: 3,
            content: 'Изучаю React - потрясающая технология!',
            date: '3 дня назад',
            likes: 56,
            comments: 12
        }
    ]);
    
    



    useEffect(() => {
        // Загружаем данные из localStorage при монтировании компонента
        const loadUserData = () => {
            const savedName = localStorage.getItem('userName');
            const savedUsername = localStorage.getItem('userUsername');
            const savedAvatar = localStorage.getItem('userAvatar');
            const savedBio = localStorage.getItem('userBio');
            
            if (savedName) setName(savedName);
            if (savedUsername) setUsername(savedUsername);
            if (savedAvatar) setAvatar(savedAvatar);
            if (savedBio) setBio(savedBio);
            
            // Также обновляем временные значения для форм редактирования
            setTempName(savedName || 'Ванечек');
            setTempUsername(savedUsername || 'ivan');
            setTempBio(savedBio || 'Люблю программирование и гулять');
        };

        loadUserData();

        // Слушаем изменения в localStorage (на случай, если данные обновятся в другом месте)
        const handleStorageChange = () => {
            loadUserData();
        };

        window.addEventListener('storage', handleStorageChange);
        
        // Очистка слушателя при размонтировании
        return () => {
            window.removeEventListener('storage', handleStorageChange);
        };
    }, []);

    const handleSaveName = () => {
        if (tempName.trim() === '') {
            alert('Имя не может быть пустым');
            return;
        }
        setName(tempName);
        // Сохраняем в localStorage
        localStorage.setItem('userName', tempName);
        setIsEditingName(false);
    };

    const handleSaveUsername = () => {
        if (tempUsername.trim() === '') {
            alert('Юзернейм не может быть пустым');
            return;
        }
        setUsername(tempUsername);
        // Сохраняем в localStorage
        localStorage.setItem('userUsername', tempUsername);
        setIsEditingUsername(false);
    };

    const handleSaveBio = () => {
        setBio(tempBio);
        // Сохраняем в localStorage
        localStorage.setItem('userBio', tempBio);
        setIsEditingBio(false);
    };

    const handleAvatarChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const newAvatar = event.target.result;
                setAvatar(newAvatar);
                // Сохраняем в localStorage
                localStorage.setItem('userAvatar', newAvatar);
            };
            reader.readAsDataURL(file);
        }
        setIsAvatarModalOpen(false);
    };

    // Функция для синхронизации с сервером
    const syncWithServer = async () => {
    try {
        const token = localStorage.getItem('authToken');
        const response = await fetch('/api/profile', {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: name,
                username: username,
                bio: bio,
            }),
        });
        
        const result = await response.json();
        
        if (result.success) {
            //Обновление localStorage из ответа сервера
            if (result.user) {
                localStorage.setItem('userName', result.user.name);
                localStorage.setItem('userUsername', result.user.username);
                localStorage.setItem('userBio', result.user.bio);
                
                if (result.user.avatar) {
                    localStorage.setItem('userAvatar', result.user.avatar);
                    setAvatar(result.user.avatar);
                }
            }
            console.log('Профиль успешно обновлен на сервере');
            showNotification('Профиль обновлен!', 'success');
        } else {
            console.error('Ошибка при обновлении профиля на сервере:', result.error);
            showNotification('Ошибка при обновлении профиля: ' + result.error, 'error');
        }
    } catch (error) {
        console.error('Ошибка синхронизации с сервером:', error);
        showNotification('Ошибка синхронизации с сервером', 'error');
    }
};


   

    return (
        <main className="main-content">
            <div className="settings-container">
                <div className="settings-card">
                    <div className="settings-header">
                        <i className="fas fa-user-cog"></i>
                        <h2>Профиль пользователя</h2>
                    </div>
                {/* Количество выполненных заданий */}
                <div className='zadan'>
                    <div className="stat-zadan">
                        <span className="zadan-label">Выполнено заданий</span>
                        <span className="zadan-number">{stats.zadan}</span>
                    </div>
                </div>
                    <div className="profile-section">
                        {/* Аватарка слева */}
                        <div className="avatar-column">
                            <div className="avatar-container" onClick={() => setIsAvatarModalOpen(true)}>
                                <img src={avatar} alt="Аватар" className="profile-avatar" />
                                <div className="profile-avatar-edit">
                                    <i className="fas fa-camera"></i>
                                </div>
                            </div>
                        </div>

                        {/* Информация справа от аватарки */}
                        <div className="info-column">
                            {/* Имя и юзернейм в одной строке */}
                            <div className="name-username-row">
                                {isEditingName ? (
                                    <div className="form-group inline-form">
                                        <input 
                                            type="text" 
                                            value={tempName} 
                                            onChange={(e) => setTempName(e.target.value)}
                                            autoFocus
                                            className="edit-input"
                                        />
                                        <div className="form-actions">
                                            <button className="btn-primary" onClick={handleSaveName}>
                                                <i className="fas fa-check"></i>
                                            </button>
                                            <button className="btn-secondary" onClick={() => setIsEditingName(false)}>
                                                <i className="fas fa-times"></i>
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <h2 className="profile-name" onClick={() => setIsEditingName(true)}>
                                        {name}
                                        <i className="fas fa-pencil-alt edit-icon"></i>
                                    </h2>
                                )}
                                
                                {isEditingUsername ? (
                                    <div className="form-group inline-form">
                                        <input 
                                            type="text" 
                                            value={tempUsername} 
                                            onChange={(e) => setTempUsername(e.target.value)}
                                            className="edit-input username-input"
                                        />
                                        <div className="form-actions">
                                            <button className="btn-primary" onClick={handleSaveUsername}>
                                                <i className="fas fa-check"></i>
                                            </button>
                                            <button className="btn-secondary" onClick={() => setIsEditingUsername(false)}>
                                                <i className="fas fa-times"></i>
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="profile-username" onClick={() => setIsEditingUsername(true)}>
                                        @{username}
                                        <i className="fas fa-pencil-alt edit-icon"></i>
                                    </p>
                                )}
                            </div>

                            {/* Цитата/описание под именем и юзернеймом */}
                            <div className="bio-section">
                                {isEditingBio ? (
                                    <div className="form-group">
                                        <textarea 
                                            value={tempBio} 
                                            onChange={(e) => setTempBio(e.target.value)}
                                            autoFocus
                                            className="edit-textarea"
                                            rows="2"
                                            placeholder="Расскажите о себе..."
                                        />
                                        <div className="form-actions">
                                            <button className="btn-primary" onClick={handleSaveBio}>
                                                <i className="fas fa-check"></i> Сохранить
                                            </button>
                                            <button className="btn-secondary" onClick={() => setIsEditingBio(false)}>
                                                Отмена
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="profile-bio" onClick={() => setIsEditingBio(true)}>
                                        <p>{bio}</p>
                                        <i className="fas fa-pencil-alt edit-icon"></i>
                                    </div>
                                )}
                            </div>

                            {/* Счетчики подписок */}
                            <div className="stats-section">
                                <div className="profile-stats">
                    
                                    <div className="stat-item">
                                        <span className="stat-number">{stats.followers}</span>
                                        <span className="stat-label">Подписчиков</span>
                                    </div>
                                    <div className="stat-item">
                                        <span className="stat-number">{stats.following}</span>
                                        <span className="stat-label">Подписок</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Секция с постами пользователя */}
                    <div className="profile-posts-section">
                        <h3 className="posts-section-title">
                            Посты ({userPosts.length})
                        </h3>
                        
                        <div className="posts-grid">
                            {userPosts.map(post => (
                                <div key={post.id} className="post-card">
                                    <div className="post-header">
                                        <img src={avatar} alt="Аватар" className="post-avatar" />
                                        <div className="post-user-info">
                                            <span className="post-username">{name}</span>
                                            <span className="post-date">{post.date}</span>
                                        </div>
                                    </div>
                                    <div className="post-content">
                                        <p>{post.content}</p>
                                    </div>
                                    <div className="post-actions">
                                        <button className="post-action-btn">
                                            <i className="fas fa-heart"></i> {post.likes}
                                        </button>
                                        <button className="post-action-btn">
                                            <i className="fas fa-comment"></i> {post.comments}
                                        </button>
                                        <button className="post-action-btn">
                                            <i className="fas fa-share"></i>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        
                        {userPosts.length === 0 && (
                            <div className="empty-posts">
                                <i className="fas fa-camera"></i>
                                <p>Пока нет публикаций</p>
                            </div>
                        )}
                    </div>

                    {/* Кнопка для принудительной синхронизации с сервером */}
                    <div className="sync-section">
                        <button className="btn-primary" onClick={syncWithServer}>
                            <i className="fas fa-sync-alt"></i> Синхронизировать с сервером
                        </button>
                    </div>
                </div>
            </div>
            
            {isAvatarModalOpen && (
                <AvatarModal 
                    onClose={() => setIsAvatarModalOpen(false)} 
                    onAvatarChange={handleAvatarChange}
                />
            )}
        </main>
    );
};

export default Settings;