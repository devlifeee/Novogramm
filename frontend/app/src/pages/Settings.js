import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../../static/css/set.css';

const Settings = () => {
  const [name, setName] = useState(localStorage.getItem('userName') || 'Пользователь');
  const [username, setUsername] = useState(localStorage.getItem('userUsername') || 'username');
  const [avatar, setAvatar] = useState(localStorage.getItem('userAvatar') || '/static/images/default-avatar.png');
  const [bio, setBio] = useState(localStorage.getItem('userBio') || '');
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (!token) {
      navigate('/login', { replace: true });
      return;
    }
    loadUserData();
  }, [navigate]);

  const loadUserData = async () => {
    const token = localStorage.getItem('authToken');
    try {
      const response = await fetch('/api/get_user_data', {
        headers: {
          'Authorization': token
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.user) {
          setName(data.user.name || 'Пользователь');
          setUsername(data.user.username || 'username');
          setAvatar(data.user.avatar || '/static/images/default-avatar.png');
          setBio(data.user.bio || '');
        }
      }
    } catch (error) {
      console.error('Ошибка загрузки данных:', error);
    }
  };

  const handleSave = async () => {
    const token = localStorage.getItem('authToken');
    try {
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name, username, bio })
      });

      const result = await response.json();
      if (result.success) {
        localStorage.setItem('userName', name);
        localStorage.setItem('userUsername', username);
        if (result.user?.avatar) {
          setAvatar(result.user.avatar);
          localStorage.setItem('userAvatar', result.user.avatar);
        }
        alert('Профиль обновлен!');
      } else {
        alert('Ошибка: ' + result.error);
      }
    } catch (error) {
      console.error('Ошибка сохранения:', error);
      alert('Ошибка при сохранении');
    }
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const token = localStorage.getItem('authToken');
      const formData = new FormData();
      formData.append('avatar', file);

      fetch('/api/profile/avatar', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      })
        .then(res => res.json())
        .then(result => {
          if (result.success) {
            setAvatar(result.avatar_url);
            localStorage.setItem('userAvatar', result.avatar_url);
          }
        })
        .catch(err => console.error('Ошибка загрузки аватара:', err));
    }
  };

  return (
    <div className="settings-container">
      <div className="settings-card">
        <h2>Настройки профиля</h2>
        
        <div className="profile-section">
          <div className="avatar-section">
            <img src={avatar} alt="Аватар" className="profile-avatar" />
            <input
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              style={{ display: 'none' }}
              id="avatar-input"
            />
            <button onClick={() => document.getElementById('avatar-input').click()}>
              Изменить аватар
            </button>
          </div>

          <div className="form-section">
            <div className="form-group">
              <label>Имя</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Юзернейм</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>О себе</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows="4"
              />
            </div>

            <button onClick={handleSave} className="save-button">
              Сохранить изменения
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;

