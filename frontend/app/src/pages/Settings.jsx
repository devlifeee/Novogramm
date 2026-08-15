import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../../static/css/home.css';
import '../../static/css/settings.css';
import { apiUrl } from '../utils/api';

const DEFAULT_AVATAR = '/static/images/default-avatar.png';

const getAuthToken = () => localStorage.getItem('authToken') || '';

const normalizeUser = (user = {}) => ({
  name: user.name || '',
  username: user.username || '',
  email: user.email || '',
  bio: user.bio || '',
  avatar: user.avatar || DEFAULT_AVATAR
});

const Settings = () => {
  const navigate = useNavigate();
  const avatarInputRef = useRef(null);
  const [form, setForm] = useState(() =>
    normalizeUser({
      name: localStorage.getItem('userName'),
      username: localStorage.getItem('userUsername'),
      bio: localStorage.getItem('userBio'),
      avatar: localStorage.getItem('userAvatar')
    })
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const authToken = getAuthToken();

  const syncLocalUser = (user) => {
    localStorage.setItem('userName', user.name || '');
    localStorage.setItem('userUsername', user.username || '');
    localStorage.setItem('userBio', user.bio || '');
    localStorage.setItem('userAvatar', user.avatar || DEFAULT_AVATAR);
  };

  const updateForm = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setError('');
    setSuccess('');
  };

  const loadProfile = async () => {
    if (!authToken) {
      navigate('/login', { replace: true });
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(apiUrl('/api/profile'), {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const data = await response.json();

      if (response.status === 401) {
        localStorage.removeItem('authToken');
        navigate('/login', { replace: true });
        return;
      }

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Не удалось загрузить профиль');
      }

      const nextUser = normalizeUser(data.user);
      setForm(nextUser);
      syncLocalUser(nextUser);
    } catch (requestError) {
      setError(requestError.message || 'Не удалось загрузить профиль.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadProfile();
  }, []);

  const validateForm = () => {
    const name = form.name.trim();
    const username = form.username.trim().toLowerCase();
    const bio = form.bio.trim();

    if (name.length < 2) return 'Имя должно быть не короче 2 символов.';
    if (name.length > 60) return 'Имя должно быть не длиннее 60 символов.';
    if (username.length < 3 || username.length > 10) return 'Username должен быть от 3 до 10 символов.';
    if (!/^[a-z0-9_.]+$/.test(username)) return 'Username может содержать только латиницу, цифры, _ и точку.';
    if (bio.length > 240) return 'Описание должно быть не длиннее 240 символов.';

    return '';
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const payload = {
        name: form.name.trim(),
        username: form.username.trim().toLowerCase(),
        bio: form.bio.trim()
      };

      const response = await fetch(apiUrl('/api/profile'), {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      const data = await response.json();

      if (response.status === 401) {
        localStorage.removeItem('authToken');
        navigate('/login', { replace: true });
        return;
      }

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Не удалось сохранить изменения');
      }

      const nextUser = normalizeUser({ ...form, ...data.user });
      setForm(nextUser);
      syncLocalUser(nextUser);
      setSuccess('Профиль сохранен. Данные обновлены в базе.');
    } catch (requestError) {
      setError(requestError.message || 'Не удалось сохранить изменения.');
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Можно загрузить только изображение.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Аватар должен быть меньше 5 МБ.');
      return;
    }

    setUploadingAvatar(true);
    setError('');
    setSuccess('');

    try {
      const formData = new FormData();
      formData.append('avatar', file);

      const response = await fetch(apiUrl('/api/profile/avatar'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
        body: formData
      });
      const data = await response.json();

      if (response.status === 401) {
        localStorage.removeItem('authToken');
        navigate('/login', { replace: true });
        return;
      }

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Не удалось обновить аватар');
      }

      const avatar = data.avatar_url || data.user?.avatar || DEFAULT_AVATAR;
      const nextUser = normalizeUser({ ...form, ...(data.user || {}), avatar });
      setForm(nextUser);
      syncLocalUser(nextUser);
      setSuccess('Аватар обновлен и сохранен в базе.');
    } catch (requestError) {
      setError(requestError.message || 'Не удалось обновить аватар.');
    } finally {
      setUploadingAvatar(false);
      event.target.value = '';
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('authEmail');
    navigate('/login', { replace: true });
  };

  return (
    <div className="settings-page">
      <header className="settings-header">
        <Link className="settings-brand" to="/home">
          <img src="/static/images/logo.png" alt="Novogramm" />
          <span>Novogramm</span>
        </Link>
        <div className="settings-header__actions">
          <Link className="settings-button settings-button--ghost" to="/home">
            <i className="fas fa-arrow-left" />
            <span>На главную</span>
          </Link>
          <button className="settings-icon-button" type="button" onClick={handleLogout} aria-label="Выйти">
            <i className="fas fa-sign-out-alt" />
          </button>
        </div>
      </header>

      <main className="settings-shell">
        <aside className="home-sidebar" aria-label="Навигация">
          <nav className="home-nav">
            <Link to="/home" className="home-nav__item">
              <i className="fas fa-home" />
              <span>Главная</span>
            </Link>
            <Link to="/chats" className="home-nav__item">
              <i className="fas fa-comment-dots" />
              <span>Чаты</span>
            </Link>
            <Link to="/programing_mode" className="home-nav__item">
              <i className="fas fa-laptop-code" />
              <span>Programming mode</span>
            </Link>
            <Link to="/settings" className="home-nav__item active">
              <i className="fas fa-cog" />
              <span>Настройки</span>
            </Link>
          </nav>

          <button className="home-user-card" type="button" onClick={() => navigate('/settings')}>
            <img className="home-user-card__avatar" src={form.avatar || DEFAULT_AVATAR} alt="Аватар" />
            <span className="home-user-card__content">
              <strong>{form.name || 'Профиль'}</strong>
              <small>@{form.username || 'username'}</small>
            </span>
          </button>
        </aside>

        <section className="settings-card settings-profile-card">
          <div className="settings-profile-card__copy">
            <p className="settings-kicker">Аккаунт</p>
            <h1>Настройки профиля</h1>
          </div>

          <div className="settings-avatar">
            <img src={form.avatar || DEFAULT_AVATAR} alt="Аватар" />
            <button
              className="settings-button settings-button--primary"
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              disabled={uploadingAvatar || loading}
            >
              <i className="fas fa-camera" />
              <span>{uploadingAvatar ? 'Загружаем...' : 'Сменить аватар'}</span>
            </button>
            <input
              ref={avatarInputRef}
              className="settings-file-input"
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
              onChange={handleAvatarChange}
            />
          </div>
        </section>

        <form className="settings-card settings-form" onSubmit={handleSubmit}>
          {loading ? (
            <div className="settings-state">
              <i className="fas fa-spinner fa-spin" />
              <span>Загружаем данные аккаунта...</span>
            </div>
          ) : (
            <>
              <div className="settings-form__grid">
                <label className="settings-field">
                  <span>Имя</span>
                  <input
                    value={form.name}
                    onChange={(event) => updateForm('name', event.target.value)}
                    placeholder="Ваше имя"
                    maxLength={60}
                  />
                </label>

                <label className="settings-field">
                  <span>Username</span>
                  <input
                    value={form.username}
                    onChange={(event) => updateForm('username', event.target.value.toLowerCase())}
                    placeholder="username"
                    maxLength={10}
                  />
                </label>
              </div>

              <label className="settings-field">
                <span>Email</span>
                <input value={form.email || 'Email скрыт'} disabled />
              </label>

              <label className="settings-field">
                <span>О себе</span>
                <textarea
                  value={form.bio}
                  onChange={(event) => updateForm('bio', event.target.value)}
                  placeholder="Расскажите пару слов о себе"
                  maxLength={240}
                  rows={5}
                />
                <small>{form.bio.length}/240</small>
              </label>

              {error && <div className="settings-alert settings-alert--error">{error}</div>}
              {success && <div className="settings-alert settings-alert--success">{success}</div>}

              <div className="settings-form__actions">
                <button className="settings-button settings-button--ghost" type="button" onClick={loadProfile}>
                  <i className="fas fa-rotate-right" />
                  <span>Сбросить</span>
                </button>
                <button className="settings-button settings-button--primary" type="submit" disabled={saving}>
                  <span>{saving ? 'Сохраняем...' : 'Сохранить изменения'}</span>
                  <i className="fas fa-check" />
                </button>
              </div>
            </>
          )}
        </form>
      </main>
    </div>
  );
};

export default Settings;
