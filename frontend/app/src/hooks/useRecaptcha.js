// /app/app/src/hooks/useRecaptcha.js
export const useRecaptcha = () => {
  // ВАЖНО: Отключаем reCAPTCHA для разработки
  const RECAPTCHA_DISABLED = true;
  
  const renderRecaptcha = (containerId, onSuccess, onExpired, onError) => {
    console.log('reCAPTCHA would render in:', containerId);
    // Ничего не делаем, так как отключено
  };

  const getResponse = () => {
    // Всегда возвращаем пустую строку
    return '';
  };

  const reset = () => {
    console.log('reCAPTCHA reset');
  };

  return { renderRecaptcha, getResponse, reset };
};