import React, { useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import '../../../static/css/auth.css';

const ResetPassword = () => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const navigate = useNavigate();
  const { token } = useParams();
  const location = useLocation();
  const { changePassword } = useAuth();

  const getToken = () => {
    if (token) return token;
    const searchParams = new URLSearchParams(location.search);
    return searchParams.get('token') || '';
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!newPassword || !confirmPassword) {
      setError('Заполните все поля');
      return;
    }

    if (newPassword.length < 6) {
      setError('Пароль должен содержать минимум 6 символов');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }

    setIsSubmitting(true);

    try {
      const resetToken = getToken();
      if (!resetToken) {
        setError('Неверная или отсутствующая ссылка для сброса пароля');
        setIsSubmitting(false);
        return;
      }

      const result = await changePassword(resetToken, newPassword, confirmPassword);

      if (result.success) {
        setSuccess('Пароль успешно изменен');
        setTimeout(() => {
          navigate('/login');
        }, 3000);
      } else {
        setError(result.error || 'Ошибка при смене пароля');
      }
    } catch (error) {
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

        <h1 className="register-card__title">Новый пароль</h1>
        <p className="register-card__subtitle">
          Введите новый пароль для вашего аккаунта.
        </p>

        <form className="register-form" id="reset-password-form" onSubmit={handleSubmit}>
          <input type="hidden" id="reset-token" value={getToken()} />

          <div className="register-form__field">
            <label className="register-form__label" htmlFor="new-password">Новый пароль</label>
            <div className="register-form__control">
              <i className="fas fa-lock register-form__icon"></i>
              <input
                type="password"
                id="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                className="register-form__input"
                placeholder="Введите новый пароль"
                required
                minLength="6"
                maxLength="30"
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="register-form__field">
            <label className="register-form__label" htmlFor="confirm-password">Подтвердите пароль</label>
            <div className="register-form__control">
              <i className="fas fa-lock register-form__icon"></i>
              <input
                type="password"
                id="confirm-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="register-form__input"
                placeholder="Повторите новый пароль"
                required
                minLength="6"
                maxLength="30"
                disabled={isSubmitting}
              />
            </div>
          </div>

          {error && <div id="error-message" className="register-form__error">{error}</div>}
          {success && <div id="success-message" className="register-form__error register-form__error--success">{success}</div>}

          <button type="submit" id="reset-button" className="register-form__submit" disabled={isSubmitting}>
            <span>{isSubmitting ? 'Изменяем...' : 'Изменить пароль'}</span>
            <i className="fas fa-arrow-right" aria-hidden="true"></i>
          </button>
        </form>

        <div className="register-form__login">
          <a
            href="/login"
            onClick={(event) => {
              event.preventDefault();
              navigate('/login');
            }}
          >
            Вернуться к входу
          </a>
        </div>
      </main>
    </div>
  );
};

export default ResetPassword;
