import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import '../../../static/css/auth.css';
import { apiUrl } from '../../utils/api';

const Confirmation = () => {
  const [code, setCode] = useState(['', '', '', '', '']);
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [notification, setNotification] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const inputRefs = useRef([]);

  const email = new URLSearchParams(location.search).get('email')
    || localStorage.getItem('registerEmail')
    || '';
  const devCode = localStorage.getItem('verificationDevCode') || '';

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          setCanResend(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, []);

  const handleCodeChange = (index, value) => {
    if (!/^\d?$/.test(value)) return;

    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);

    if (value && index < 4) {
      inputRefs.current[index + 1]?.focus();
    }

    if (newCode.every((digit) => digit !== '') && index === 4) {
      handleSubmit();
    }
  };

  const handleKeyDown = (index, event) => {
    if (event.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (event) => {
    const paste = event.clipboardData.getData('text').slice(0, 5);
    if (/^\d{5}$/.test(paste)) {
      const digits = paste.split('');
      setCode(digits);
      inputRefs.current[4]?.focus();
    }
  };

  const showNotification = (message, type) => {
    setNotification({ message, type });
    setTimeout(() => setNotification(''), 3000);
  };

  const handleSubmit = async () => {
    const verificationCode = code.join('');

    if (verificationCode.length !== 5) {
      showNotification('Введите все 5 цифр кода', 'error');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(apiUrl('/verify'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          code: verificationCode
        }),
      });

      const data = await response.json();

      if (data.success) {
        if (data.registration_token) {
          sessionStorage.setItem('registrationToken', data.registration_token);
        }
        showNotification('Email успешно подтвержден!', 'success');
        localStorage.removeItem('registerEmail');
        localStorage.removeItem('verificationDevCode');
        setTimeout(() => {
          navigate('/auth/account_creation', { state: { email } });
        }, 2000);
      } else {
        showNotification(typeof data.error === 'string' ? data.error : data.error?.message || 'Неверный код подтверждения', 'error');
        setCode(['', '', '', '', '']);
        inputRefs.current[0]?.focus();
      }
    } catch (error) {
      showNotification('Ошибка соединения с сервером', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!canResend || !email) return;

    try {
      const response = await fetch(apiUrl('/resend'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (data.success) {
        showNotification('Новый код отправлен на вашу почту', 'success');
        setCountdown(60);
        setCanResend(false);
        setCode(['', '', '', '', '']);
        inputRefs.current[0]?.focus();
      } else {
        showNotification(data.error || 'Ошибка при отправке кода', 'error');
      }
    } catch (error) {
      showNotification('Ошибка соединения с сервером', 'error');
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

        <h1 className="register-card__title">Проверьте почту</h1>
        <p className="register-card__subtitle">
          Мы отправили вам 5-значный код подтверждения. Введите его ниже, чтобы продолжить.
        </p>

        <div className="confirmation-email">
          <i className="fas fa-envelope confirmation-email__icon"></i>
          <span id="email-display">{email}</span>
        </div>

        {devCode && (
          <div className="confirmation-dev-code">
            Код для локальной разработки: <strong>{devCode}</strong>
          </div>
        )}
        
        <div className="confirmation-code">
          {code.map((digit, index) => (
            <input
              key={index}
              type="text"
              className="confirmation-code__input"
              maxLength="1"
              autoComplete="off"
              value={digit}
              onChange={(event) => handleCodeChange(index, event.target.value)}
              onKeyDown={(event) => handleKeyDown(index, event)}
              onPaste={index === 0 ? handlePaste : undefined}
              ref={(element) => (inputRefs.current[index] = element)}
              disabled={isLoading}
            />
          ))}
        </div>

        <button
          id="submit"
          className="register-form__submit"
          onClick={handleSubmit}
          disabled={isLoading}
        >
          <span>{isLoading ? 'Проверка...' : 'Подтвердить'}</span>
          <i className="fas fa-arrow-right" aria-hidden="true"></i>
        </button>

        <div className="confirmation-resend">
          <span>Не получили код?</span>
          <button
            className={`confirmation-resend__button ${canResend ? 'active' : 'disabled'}`}
            onClick={handleResendCode}
            disabled={!canResend}
          >
            Отправить снова {!canResend && `(${countdown} сек)`}
          </button>
        </div>
      </main>

      {notification && (
        <div className={`confirmation-notification ${notification.type}`} id="notification">
          {notification.message}
        </div>
      )}
    </div>
  );
};

export default Confirmation;
