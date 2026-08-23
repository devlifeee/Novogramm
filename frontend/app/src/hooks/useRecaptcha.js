import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const RECAPTCHA_ONLOAD_CALLBACK = '__novogrammRecaptchaOnload';
const RECAPTCHA_SCRIPT_URL = `https://www.google.com/recaptcha/api.js?onload=${RECAPTCHA_ONLOAD_CALLBACK}&render=explicit`;
const RECAPTCHA_LOAD_TIMEOUT_MS = 10000;
const RECAPTCHA_POLL_INTERVAL_MS = 25;
const RECAPTCHA_SITE_KEY = typeof __RECAPTCHA_SITE_KEY__ === 'string'
  ? __RECAPTCHA_SITE_KEY__.trim()
  : '';
let recaptchaScriptPromise;

const getRenderableRecaptcha = () => (
  typeof window.grecaptcha?.render === 'function' ? window.grecaptcha : null
);

const findRecaptchaScript = () => Array.from(document.scripts).find((script) => (
  /^https:\/\/(www\.google\.com|www\.recaptcha\.net)\/recaptcha\/api\.js/.test(script.src)
));

const loadRecaptcha = () => {
  const readyRecaptcha = getRenderableRecaptcha();
  if (readyRecaptcha) {
    return Promise.resolve(readyRecaptcha);
  }

  if (recaptchaScriptPromise) {
    return recaptchaScriptPromise;
  }

  let resolveLoad;
  let rejectLoad;
  const promise = new Promise((resolve, reject) => {
    resolveLoad = resolve;
    rejectLoad = reject;
  });
  recaptchaScriptPromise = promise;

  const existingCallback = window[RECAPTCHA_ONLOAD_CALLBACK];
  let pollId;
  let timeoutId;
  let script;
  let settled = false;

  const cleanup = () => {
    window.clearInterval(pollId);
    window.clearTimeout(timeoutId);
    script?.removeEventListener('load', checkForRender);
    script?.removeEventListener('error', failToLoad);
    if (window[RECAPTCHA_ONLOAD_CALLBACK] === onApiLoad) {
      if (typeof existingCallback === 'function') {
        window[RECAPTCHA_ONLOAD_CALLBACK] = existingCallback;
      } else {
        delete window[RECAPTCHA_ONLOAD_CALLBACK];
      }
    }
  };

  const finish = (value) => {
    if (settled) return;
    settled = true;
    cleanup();
    resolveLoad(value);
  };

  const fail = (error) => {
    if (settled) return;
    settled = true;
    cleanup();
    rejectLoad(error);
  };

  const checkForRender = () => {
    const recaptcha = getRenderableRecaptcha();
    if (recaptcha) finish(recaptcha);
  };

  const onApiLoad = () => {
    if (typeof existingCallback === 'function') existingCallback();
    checkForRender();
  };

  const failToLoad = () => fail(new Error('reCAPTCHA API script failed to load'));

  window[RECAPTCHA_ONLOAD_CALLBACK] = onApiLoad;
  script = findRecaptchaScript();
  const appendScript = !script;
  if (!script) {
    script = document.createElement('script');
    script.src = RECAPTCHA_SCRIPT_URL;
    script.async = true;
    script.defer = true;
  }
  script.addEventListener('load', checkForRender);
  script.addEventListener('error', failToLoad);
  pollId = window.setInterval(checkForRender, RECAPTCHA_POLL_INTERVAL_MS);
  timeoutId = window.setTimeout(
    () => fail(new Error('Timed out waiting for reCAPTCHA API to expose grecaptcha.render')),
    RECAPTCHA_LOAD_TIMEOUT_MS,
  );
  if (appendScript) document.head.appendChild(script);
  checkForRender();

  promise.catch(() => {
    if (recaptchaScriptPromise === promise) recaptchaScriptPromise = null;
  });
  return promise;
};

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
