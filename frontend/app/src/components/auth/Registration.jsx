import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useRecaptcha } from '../../hooks/useRecaptcha';
import '../../../static/css/auth.css';

const Register = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const navigate = useNavigate();
  const { register } = useAuth();
  const recaptcha = useRecaptcha();

  useEffect(() => {
    if (localStorage.getItem('authToken')) {
      navigate('/home', { replace: true });
    }
  }, [navigate, recaptcha]);

  const validateField = (name, value) => {
    const nextErrors = {};

    if (name === 'email') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (value && !emailRegex.test(value)) {
        nextErrors.email = 'Введите корректный email';
      }
    }

    if (name === 'password') {
      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;
      if (value && (value.length < 8 || !passwordRegex.test(value))) {
        nextErrors.password = 'Минимум 8 символов, заглавная буква и цифра';
      }
    }

    if (name === 'confirmPassword' && value && value !== formData.password) {
      nextErrors.confirmPassword = 'Пароли не совпадают';
    }

    setFieldErrors((prev) => {
      const updated = { ...prev };
      delete updated[name];
      return { ...updated, ...nextErrors };
    });
  };

  const handleChange = (event) => {
    const { id, value } = event.target;
    setFormData((prev) => ({ ...prev, [id]: value }));
    validateField(id, value);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    validateField('email', formData.email);
    validateField('password', formData.password);
    validateField('confirmPassword', formData.confirmPassword);

    if (!formData.email || !formData.password || !formData.confirmPassword) {
      setError('Заполните все поля');
      return;
    }

    if (!agree) {
      setError('Нужно согласиться с условиями использования');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }

    if (Object.keys(fieldErrors).length > 0) {
      setError('Исправьте ошибки в форме');
      return;
    }

    setIsSubmitting(true);

    const result = await register(
      formData.email,
      formData.password,
      formData.confirmPassword,
      ''
    );

    if (result.success) {
      localStorage.setItem('registerEmail', formData.email);
      if (result.devCode) {
        localStorage.setItem('verificationDevCode', result.devCode);
      } else {
        localStorage.removeItem('verificationDevCode');
      }
      if (result.token || result.skipVerification) {
        navigate('/auth/account_creation', { state: { email: formData.email } });
      } else {
        navigate(`/auth/confirmation?email=${encodeURIComponent(formData.email)}`);
      }
    } else {
      setError(result.error);
    }

    setIsSubmitting(false);
  };

  const getFieldClass = (fieldName) => {
    if (fieldErrors[fieldName]) return 'error';
    if (formData[fieldName] && !fieldErrors[fieldName]) return 'valid';
    return '';
  };

  const renderPasswordIcon = (isVisible) => (
    <svg
      className="register-form__peek-icon"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M2.8 12s3.2-5.6 9.2-5.6 9.2 5.6 9.2 5.6-3.2 5.6-9.2 5.6S2.8 12 2.8 12Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 14.8a2.8 2.8 0 1 0 0-5.6 2.8 2.8 0 0 0 0 5.6Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      {isVisible && (
        <path
          d="M4.5 19.5 19.5 4.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      )}
    </svg>
  );

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

        <h1 className="register-card__title">Регистрация</h1>
        <p className="register-card__subtitle">
          Создайте аккаунт и продолжите настройку профиля.
        </p>

        <form className="register-form" id="registration-form" onSubmit={handleSubmit}>
          <div className="register-form__field">
            <label className="register-form__label" htmlFor="email">Электронная почта</label>
            <div className="register-form__control">
              <i className="fas fa-envelope register-form__icon"></i>
              <input
                type="email"
                id="email"
                value={formData.email}
                onChange={handleChange}
                className={`register-form__input ${getFieldClass('email')}`}
                placeholder="you@example.com"
                required
                maxLength="50"
              />
            </div>
          </div>

          <div className="register-form__row">
            <div className="register-form__field">
              <label className="register-form__label" htmlFor="password">Пароль</label>
              <div className="register-form__control">
                <i className="fas fa-lock register-form__icon"></i>
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  value={formData.password}
                  onChange={handleChange}
                  className={`register-form__input ${getFieldClass('password')}`}
                  placeholder="Пароль"
                  required
                  maxLength="30"
                />
                <button
                  type="button"
                  className="register-form__peek"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                >
                  {renderPasswordIcon(showPassword)}
                </button>
              </div>
              {fieldErrors.password && (
                <p className="register-form__hint register-form__hint--error">
                  {fieldErrors.password}
                </p>
              )}
            </div>

            <div className="register-form__field">
              <label className="register-form__label" htmlFor="confirmPassword">Подтвердите пароль</label>
              <div className="register-form__control">
                <i className="fas fa-lock register-form__icon"></i>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  id="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className={`register-form__input ${getFieldClass('confirmPassword')}`}
                  placeholder="Повторите пароль"
                  required
                  maxLength="30"
                />
                <button
                  type="button"
                  className="register-form__peek"
                  onClick={() => setShowConfirmPassword((value) => !value)}
                  aria-label={showConfirmPassword ? 'Скрыть подтверждение пароля' : 'Показать подтверждение пароля'}
                >
                  {renderPasswordIcon(showConfirmPassword)}
                </button>
              </div>
              {fieldErrors.confirmPassword && (
                <p className="register-form__hint register-form__hint--error">
                  {fieldErrors.confirmPassword}
                </p>
              )}
            </div>
          </div>

          <div className="register-form__checkbox">
            <input
              type="checkbox"
              id="agree"
              checked={agree}
              onChange={(event) => setAgree(event.target.checked)}
              className="register-form__checkbox-input"
              required
            />
            <label className="register-form__checkbox-label" htmlFor="agree">
              Нажимая зарегистрироваться, я соглашаюсь с{' '}
              <Link to="/auth/privacy-policy" target="_blank" className="register-form__policy-link">
                условиями использования и политикой конфиденциальности
              </Link>
            </label>
          </div>

          {error && (
            <div id="error-message" className="register-form__error">
              {error}
            </div>
          )}

          <button type="submit" id="register-button" className="register-form__submit" disabled={isSubmitting}>
            <span>{isSubmitting ? 'Регистрируем...' : 'Зарегистрироваться'}</span>
            <i className="fas fa-arrow-right" aria-hidden="true"></i>
          </button>
        </form>

        <div className="register-form__login">
          <Link to="/login">Есть аккаунт? Войти</Link>
        </div>
      </main>
    </div>
  );
};

export default Register;
