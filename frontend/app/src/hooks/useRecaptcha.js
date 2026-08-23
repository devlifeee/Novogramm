import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const RECAPTCHA_SCRIPT_URL = 'https://www.recaptcha.net/recaptcha/api.js?render=explicit';
let recaptchaScriptPromise;

const loadRecaptcha = () => {
  if (window.grecaptcha) {
    return Promise.resolve(window.grecaptcha);
  }

  if (!recaptchaScriptPromise) {
    recaptchaScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = RECAPTCHA_SCRIPT_URL;
      script.async = true;
      script.defer = true;
      script.onload = () => window.grecaptcha ? resolve(window.grecaptcha) : reject(new Error('reCAPTCHA did not initialize'));
      script.onerror = () => reject(new Error('reCAPTCHA failed to load'));
      document.head.appendChild(script);
    });
  }

  return recaptchaScriptPromise;
};

export const useRecaptcha = ({ enabled = true } = {}) => {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);
  const tokenRef = useRef('');
  const isRequired = __RECAPTCHA_REQUIRED__ && enabled;
  const [isLoading, setIsLoading] = useState(isRequired);
  const [error, setError] = useState('');

  const reset = useCallback(() => {
    tokenRef.current = '';
    setError('');
    if (widgetIdRef.current !== null && window.grecaptcha) {
      window.grecaptcha.reset(widgetIdRef.current);
    }
  }, []);

  useEffect(() => {
    let active = true;

    if (!isRequired) {
      tokenRef.current = '';
      widgetIdRef.current = null;
      setIsLoading(false);
      setError('');
      return undefined;
    }

    if (!__RECAPTCHA_SITE_KEY__) {
      setIsLoading(false);
      setError('reCAPTCHA не настроена. Обратитесь к администратору.');
      return undefined;
    }

    setIsLoading(true);
    setError('');

    loadRecaptcha()
      .then((grecaptcha) => {
        if (!active || !containerRef.current) return;

        widgetIdRef.current = grecaptcha.render(containerRef.current, {
          sitekey: __RECAPTCHA_SITE_KEY__,
          theme: 'dark',
          size: 'normal',
          callback: (token) => {
            tokenRef.current = token;
            if (active) setError('');
          },
          'expired-callback': () => {
            tokenRef.current = '';
            if (active) setError('Срок действия проверки reCAPTCHA истёк. Подтвердите её снова.');
          },
          'error-callback': () => {
            tokenRef.current = '';
            if (active) setError('Не удалось выполнить проверку reCAPTCHA. Попробуйте ещё раз.');
          },
        });
        if (active) setIsLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setIsLoading(false);
        setError('Не удалось загрузить reCAPTCHA. Проверьте соединение, обновите страницу и попробуйте ещё раз.');
      });

    return () => {
      active = false;
      tokenRef.current = '';
      widgetIdRef.current = null;
    };
  }, [isRequired]);

  return useMemo(() => ({
    containerRef,
    error,
    getResponse: () => tokenRef.current,
    isLoading,
    isRequired,
    reset,
  }), [error, isLoading, isRequired, reset]);
};
