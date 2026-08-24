import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import '../../../static/css/auth.css';
import { apiUrl } from '../../utils/api';

const AccountCreation = () => {
  const [formData, setFormData] = useState({
    name: '',
    username: ''
  });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const email = location.state?.email || localStorage.getItem('registerEmail');
  const registrationToken = sessionStorage.getItem('registrationToken') || '';

  useEffect(() => {
    if (!email) {
      navigate('/register');
    }
  }, [navigate, email]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    const nextValue = name === 'username' ? value.toLowerCase() : value;
    setFormData((prev) => ({ ...prev, [name]: nextValue }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!formData.name || !formData.username) {
      setError('Заполните все поля');
      return;
    }

    if (formData.username.length < 3 || formData.username.length > 10) {
      setError('Username должен быть от 3 до 10 символов');
      return;
    }

    if (!/^[a-z0-9_.]+$/.test(formData.username)) {
      setError('Username может содержать только латинские буквы, цифры, подчёркивание и точки');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(apiUrl('/complete_registration'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          registration_token: registrationToken,
          name: formData.name,
          username: formData.username
        })
      });

      const data = await response.json();

      if (data.success) {
        if (data.user?.token) {
          localStorage.setItem('authToken', data.user.token);
          localStorage.setItem('authEmail', email);
        }
        localStorage.removeItem('registerEmail');
        localStorage.removeItem('verificationDevCode');
        sessionStorage.removeItem('registrationToken');
        navigate('/home');
      } else {
        setError(data.error || 'Не удалось завершить регистрацию');
      }
    } catch (requestError) {
      setError('Ошибка соединения с сервером');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="register-page">
      <img
        className="register-page__background-image"
        src="/static/images/register-bg.png"
        alt=""
        aria-hidden="true"
      />
      <div className="register-page__overlay" aria-hidden="true"></div>

      <main className="register-card">
        <div className="register-card__logo" aria-label="Novogramm">
          <img src="/static/images/logo.png" alt="Novogramm" />
        </div>

        <h1 className="register-card__title">Настройте профиль</h1>
        <p className="register-card__subtitle">
          Добавьте имя и короткий username, чтобы другие могли вас найти.
        </p>

        <form className="register-form" id="account-creation-form" onSubmit={handleSubmit}>
          <div className="register-form__field">
            <label className="register-form__label" htmlFor="name">Имя</label>
            <div className="register-form__control">
              <i className="fas fa-user register-form__icon"></i>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="register-form__input"
                placeholder="Ваше имя"
                required
                maxLength="50"
              />
            </div>
          </div>

          <div className="register-form__field">
            <label className="register-form__label" htmlFor="username">Username</label>
            <div className="register-form__control">
              <i className="fas fa-at register-form__icon"></i>
              <input
                type="text"
                id="username"
                name="username"
                value={formData.username}
                onChange={handleChange}
                className="register-form__input"
                placeholder="username"
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="username"
                spellCheck={false}
                required
                maxLength="10"
                minLength="3"
              />
            </div>
          </div>

          {error && (
            <div id="error-message" className="register-form__error">
              {error}
            </div>
          )}

          <button
            type="submit"
            id="complete-registration-button"
            className="register-form__submit"
            disabled={isSubmitting}
          >
            <span>{isSubmitting ? 'Сохраняем...' : 'Перейти в Novogramm'}</span>
            <i className="fas fa-arrow-right" aria-hidden="true"></i>
          </button>
        </form>
      </main>
    </div>
  );
};

export default AccountCreation;
