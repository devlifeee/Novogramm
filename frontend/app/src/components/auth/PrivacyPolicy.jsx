import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../../../static/css/auth.css';

const PrivacyPolicy = () => {
  const navigate = useNavigate();

  const goBack = () => {
    navigate(-1);
  };

  return (
    <div className="register-page auth-policy-page">
      <img
        className="register-page__background-image"
        src="/static/images/register-bg.png"
        alt=""
        aria-hidden="true"
      />
      <div className="register-page__overlay" aria-hidden="true"></div>

      <main className="register-card auth-policy-card">
        <div className="auth-policy-card__header">
          <div className="auth-policy-card__brand">
            <div className="register-card__logo" aria-label="Novogramm">
              <img src="/static/images/logo.png" alt="Novogramm" />
            </div>
            <span>Novogramm</span>
          </div>

          <button className="auth-policy-card__back" type="button" onClick={goBack}>
            Назад
          </button>
        </div>

        <h1 className="register-card__title">Политика конфиденциальности</h1>
        <p className="register-card__subtitle">
          Коротко о том, как Novogramm относится к вашим данным и безопасности аккаунта.
        </p>

        <div className="auth-policy-card__content">
          <section>
            <h2>1. Введение</h2>
            <p>
              Novogramm ценит вашу конфиденциальность и стремится защищать личные данные,
              которые вы предоставляете при использовании сервиса.
            </p>
            <p>
              Используя Novogramm, вы соглашаетесь с принципами обработки данных,
              описанными в этой политике.
            </p>
          </section>

          <section>
            <h2>2. Какие данные мы можем собирать</h2>
            <p>
              Мы можем обрабатывать данные, которые нужны для регистрации, входа,
              настройки профиля, публикаций и корректной работы социальной сети.
            </p>
            <ul>
              <li>Данные аккаунта: email, имя, username и настройки профиля.</li>
              <li>Данные активности: публикации, комментарии и взаимодействия внутри сервиса.</li>
              <li>Технические данные: тип браузера, устройство и базовая информация для безопасности.</li>
            </ul>
          </section>

          <section>
            <h2>3. Как мы используем данные</h2>
            <p>
              Данные используются для работы аккаунта, защиты от злоупотреблений,
              восстановления доступа и улучшения пользовательского опыта.
            </p>
          </section>

          <section>
            <h2>4. Безопасность</h2>
            <p>
              Мы применяем разумные технические меры, чтобы защищать аккаунты и снижать
              риск несанкционированного доступа.
            </p>
          </section>

          <div className="auth-policy-card__updated">
            Последнее обновление: 23 августа 2025 г.
          </div>
        </div>
      </main>
    </div>
  );
};

export default PrivacyPolicy;
