import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../../../static/css/auth.css';
import { useAuth } from '../../hooks/useAuth';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState({ text: '', type: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const recaptchaRef = useRef(null);

  const navigate = useNavigate();
  const { forgotPassword } = useAuth();

  useEffect(() => {
    const loadRecaptcha = () => {
      if (window.RECAPTCHA_DISABLED) return;

      const script = document.createElement('script');
      script.src = 'https://www.recaptcha.net/recaptcha/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);

      script.onload = () => {
        if (window.grecaptcha && recaptchaRef.current) {
          window.grecaptcha.render(recaptchaRef.current, {
            sitekey: process.env.REACT_APP_RECAPTCHA_SITE_KEY || window.RECAPTCHA_SITE_KEY,
            theme: 'dark',
            size: 'normal'
          });
        }
      };
    };

    loadRecaptcha();
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!email) {
      setMessage({ text: 'Введите email адрес', type: 'error' });
      return;
    }

    setIsSubmitting(true);
    setMessage({ text: '', type: '' });

    try {
      let recaptchaToken = '';
      if (!window.RECAPTCHA_DISABLED && window.grecaptcha) {
        recaptchaToken = await window.grecaptcha.execute();
      }

      const result = await forgotPassword(email, recaptchaToken);

      if (result.success) {
        setMessage({
          text: 'Инструкции по восстановлению пароля отправлены на ваш email',
          type: 'success'
        });
        setEmail('');

        if (window.grecaptcha) {
          window.grecaptcha.reset();
        }

        setTimeout(() => {
          navigate('/login');
        }, 3000);
      } else {
        setMessage({ text: result.error, type: 'error' });
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

          {!window.RECAPTCHA_DISABLED && (
            <div id="recaptcha-placeholder" className="auth-recaptcha" ref={recaptchaRef}></div>
          )}

          {message.text && (
            <div
              id="message"
              className={`register-form__error ${message.type === 'success' ? 'register-form__error--success' : ''}`}
            >
              {message.text}
            </div>
          )}

          <button type="submit" className="register-form__submit" disabled={isSubmitting}>
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
