import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const RECAPTCHA_SCRIPT_URL = 'https://www.recaptcha.net/recaptcha/api.js?render=explicit';
const RECAPTCHA_SITE_KEY = typeof __RECAPTCHA_SITE_KEY__ === 'string'
  ? __RECAPTCHA_SITE_KEY__.trim()
  : '';
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
      script.onload = () => window.grecaptcha
        ? resolve(window.grecaptcha)
        : reject(new Error('reCAPTCHA API loaded without window.grecaptcha'));
      script.onerror = () => reject(new Error('reCAPTCHA API script failed to load'));
      document.head.appendChild(script);
    });
  }

  return recaptchaScriptPromise;
};

const waitForRecaptchaReady = (grecaptcha) => new Promise((resolve, reject) => {
  if (typeof grecaptcha.render !== 'function') {
    reject(new Error('reCAPTCHA API initialized without grecaptcha.render'));
    return;
  }

  if (typeof grecaptcha.ready !== 'function') {
    resolve(grecaptcha);
    return;
  }

  try {
    grecaptcha.ready(() => resolve(grecaptcha));
  } catch (error) {
    reject(error);
  }
});

const errorMessage = (error) => error instanceof Error ? error.message : String(error);

export const useRecaptcha = ({ enabled = true } = {}) => {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);
  const tokenRef = useRef('');
  const mountedRef = useRef(false);
  const renderAttemptRef = useRef(0);
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
    mountedRef.current = true;
    const renderAttempt = ++renderAttemptRef.current;
    const isCurrentAttempt = () => mountedRef.current && renderAttempt === renderAttemptRef.current;

    if (!isRequired) {
      tokenRef.current = '';
      widgetIdRef.current = null;
      setIsLoading(false);
      setError('');
      return () => {
        mountedRef.current = false;
      };
    }

    if (!RECAPTCHA_SITE_KEY) {
      setIsLoading(false);
      setError('RECAPTCHA_SITE_KEY is missing from the production build. Set the public Appwrite build variable and rebuild the Site.');
      return () => {
        mountedRef.current = false;
      };
    }

    setIsLoading(true);
    setError('');

    loadRecaptcha()
      .then(waitForRecaptchaReady)
      .then((grecaptcha) => {
        if (!isCurrentAttempt()) return;

        const container = containerRef.current;
        if (!container) {
          throw new Error('reCAPTCHA container was not mounted');
        }

        const existingWidgetId = container.dataset.recaptchaWidgetId;
        if (existingWidgetId !== undefined) {
          widgetIdRef.current = Number(existingWidgetId);
          setIsLoading(false);
          return;
        }

        try {
          widgetIdRef.current = grecaptcha.render(container, {
            sitekey: RECAPTCHA_SITE_KEY,
            theme: 'dark',
            size: 'normal',
            callback: (token) => {
              if (!mountedRef.current || containerRef.current !== container) return;
              tokenRef.current = token;
              setError('');
            },
            'expired-callback': () => {
              if (!mountedRef.current || containerRef.current !== container) return;
              tokenRef.current = '';
              setError('Срок действия проверки reCAPTCHA истёк. Подтвердите её снова.');
            },
            'error-callback': () => {
              if (!mountedRef.current || containerRef.current !== container) return;
              tokenRef.current = '';
              setError('Не удалось выполнить проверку reCAPTCHA. Попробуйте ещё раз.');
            },
          });
          container.dataset.recaptchaWidgetId = String(widgetIdRef.current);
          setIsLoading(false);
        } catch (renderError) {
          console.error('reCAPTCHA render failed', renderError);
          throw new Error(`reCAPTCHA render failed: ${errorMessage(renderError)}`);
        }
      })
      .catch((recaptchaError) => {
        if (!isCurrentAttempt()) return;
        console.error('reCAPTCHA initialization failed', recaptchaError);
        setIsLoading(false);
        setError(errorMessage(recaptchaError));
      });

    return () => {
      mountedRef.current = false;
      tokenRef.current = '';
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
