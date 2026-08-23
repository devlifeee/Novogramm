import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../../../static/css/auth.css';
import { useAuth } from '../../hooks/useAuth';
import { useRecaptcha } from '../../hooks/useRecaptcha';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState({ text: '', type: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const navigate = useNavigate();
  const { forgotPassword } = useAuth();
  const recaptcha = useRecaptcha();

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!email) {
      setMessage({ text: 'Введите email адрес', type: 'error' });
      return;
    }

    const recaptchaToken = recaptcha.getResponse();
    if (recaptcha.isRequired && !recaptchaToken) {
      setMessage({ text: recaptcha.error || 'Подтвердите reCAPTCHA перед отправкой.', type: 'error' });
      return;
    }

    setIsSubmitting(true);
    setMessage({ text: '', type: '' });

    try {
      const result = await forgotPassword(email, recaptchaToken);

      if (result.success) {
        setMessage({
          text: 'Инструкции по восстановлению пароля отправлены на ваш email',
          type: 'success'
        });
        setEmail('');

        recaptcha.reset();

        setTimeout(() => {
          navigate('/login');
        }, 3000);
      } else {
        setMessage({ text: result.error, type: 'error' });
        recaptcha.reset();
      }
    } catch (error) {
      setMessage({ text: 'Ошибка соединения с сервером', type: 'error' });
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

        <h1 className="register-card__title">Восстановление пароля</h1>
        <p className="register-card__subtitle">
          Введите email, и мы вышлем инструкции для восстановления пароля.
        </p>

        <form className="register-form" id="forgotPasswordForm" onSubmit={handleSubmit}>
          <div className="register-form__field">
            <label className="register-form__label" htmlFor="email">Электронная почта</label>
            <div className="register-form__control">
              <i className="fas fa-envelope register-form__icon"></i>
              <input
                type="email"
                id="email"
                name="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="register-form__input"
                placeholder="you@example.com"
                required
                disabled={isSubmitting}
              />
            </div>
          </div>

          {recaptcha.isRequired && <div className="auth-recaptcha" ref={recaptcha.containerRef}></div>}
          {recaptcha.isLoading && <div className="register-form__hint">Загрузка reCAPTCHA...</div>}
          {recaptcha.error && <div className="register-form__error">{recaptcha.error}</div>}

          {message.text && (
            <div
              id="message"
              className={`register-form__error ${message.type === 'success' ? 'register-form__error--success' : ''}`}
            >
              {message.text}
            </div>
          )}

          <button
            type="submit"
            className="register-form__submit"
            disabled={isSubmitting || (recaptcha.isRequired && recaptcha.isLoading)}
          >
            <span>{isSubmitting ? 'Отправка...' : 'Отправить инструкции'}</span>
            <i className="fas fa-arrow-right" aria-hidden="true"></i>
          </button>
        </form>

        <div className="register-form__login">
          <Link to="/login">Вернуться к входу</Link>
        </div>
      </main>
    </div>
  );
};

export default ForgotPassword;
