import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useRecaptcha } from '../../hooks/useRecaptcha';
import '../../../static/css/auth.css';

const Login = () => {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryError, setRecoveryError] = useState('');
  const [recoverySuccess, setRecoverySuccess] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const navigate = useNavigate();
  const { login, forgotPassword } = useAuth();
  const recaptcha = useRecaptcha();

  useEffect(() => {
    if (localStorage.getItem('authToken')) {
      navigate('/home', { replace: true });
    }
  }, [navigate, recaptcha]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!formData.email || !formData.password) {
      setError('Заполните все поля');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Введите корректный email');
      return;
    }

    setIsSubmitting(true);

    let recaptchaToken = '';
    if (!window.RECAPTCHA_DISABLED && window.grecaptcha) {
      try {
        recaptchaToken = await window.grecaptcha.execute();
      } catch (captchaError) {
        setError('Ошибка reCAPTCHA. Попробуйте еще раз.');
        setIsSubmitting(false);
        return;
      }
    }

    const result = await login(formData.email, formData.password, recaptchaToken);

    if (result.success) {
      navigate('/home');
    } else {
      setError(result.error);
      recaptcha.reset();
    }

    setIsSubmitting(false);
  };

  const handlePasswordRecovery = async () => {
    setRecoveryError('');
    setRecoverySuccess('');

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!recoveryEmail || !emailRegex.test(recoveryEmail)) {
      setRecoveryError('Введите корректный email');
      return;
    }

    const result = await forgotPassword(recoveryEmail);

    if (result.success) {
      setRecoverySuccess(result.message);
      setTimeout(() => {
        setShowPasswordModal(false);
        setRecoveryEmail('');
        setRecoverySuccess('');
      }, 3000);
    } else {
      setRecoveryError(result.error);
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

      {showPasswordModal && (
        <div className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="recovery-title">
          <div className="auth-modal__card">
            <button className="auth-modal__close" type="button" onClick={() => setShowPasswordModal(false)}>
              &times;
            </button>
            <div className="register-card__logo" aria-hidden="true">
              <img src="/static/images/logo.png" alt="" />
            </div>
            <h2 className="auth-modal__title" id="recovery-title">Восстановление пароля</h2>
            <p className="auth-modal__subtitle">
              Введите email, и мы отправим инструкции для восстановления доступа.
            </p>

            <div className="register-form__field">
              <label className="register-form__label" htmlFor="recovery-email">Электронная почта</label>
              <div className="register-form__control">
                <i className="fas fa-envelope register-form__icon"></i>
                <input
                  type="email"
                  id="recovery-email"
                  value={recoveryEmail}
                  onChange={(event) => setRecoveryEmail(event.target.value)}
                  className="register-form__input"
                  placeholder="you@example.com"
                  required
                />
              </div>
            </div>

            {recoveryError && <div id="recovery-error" className="register-form__error">{recoveryError}</div>}
            {recoverySuccess && (
              <div id="recovery-success" className="register-form__error register-form__error--success">
                {recoverySuccess}
              </div>
            )}

            <button id="send-recovery" className="register-form__submit" type="button" onClick={handlePasswordRecovery}>
              <span>Отправить инструкции</span>
              <i className="fas fa-arrow-right" aria-hidden="true"></i>
            </button>
          </div>
        </div>
      )}

      <main className="register-card">
        <div className="register-card__logo" aria-label="Novogramm">
          <img src="/static/images/logo.png" alt="Novogramm" />
        </div>

        <h1 className="register-card__title">Вход</h1>
        <p className="register-card__subtitle">
          Продолжайте общение, публикации и настройку своей ленты.
        </p>

        <form className="register-form" id="login-form" onSubmit={handleSubmit}>
          <div className="register-form__field">
            <label className="register-form__label" htmlFor="email">Электронная почта</label>
            <div className="register-form__control">
              <i className="fas fa-envelope register-form__icon"></i>
              <input
                type="email"
                id="email"
                value={formData.email}
                onChange={(event) => setFormData({ ...formData, email: event.target.value })}
                className="register-form__input"
                placeholder="you@example.com"
                required
                maxLength="50"
              />
            </div>
          </div>

          <div className="register-form__field">
            <label className="register-form__label" htmlFor="password">Пароль</label>
            <div className="register-form__control">
              <i className="fas fa-lock register-form__icon"></i>
              <input
                type="password"
                id="password"
                value={formData.password}
                onChange={(event) => setFormData({ ...formData, password: event.target.value })}
                className="register-form__input"
                placeholder="Введите пароль"
                required
                maxLength="30"
              />
            </div>
          </div>

          {error && <div id="error-message" className="register-form__error">{error}</div>}

          <button type="submit" id="login-button" className="register-form__submit" disabled={isSubmitting}>
            <span>{isSubmitting ? 'Входим...' : 'Войти'}</span>
            <i className="fas fa-arrow-right" aria-hidden="true"></i>
          </button>
        </form>

        <div className="register-form__login register-form__login--stack">
          <Link to="/register">Нет аккаунта? Зарегистрироваться</Link>
          <a
            href="#"
            onClick={(event) => {
              event.preventDefault();
              setShowPasswordModal(true);
              setRecoveryEmail(formData.email);
            }}
          >
            Забыли пароль?
          </a>
        </div>
      </main>
    </div>
  );
};

export default Login;
