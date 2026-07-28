// auth.js - reCAPTCHA integration for registration

// Global variables for reCAPTCHA
let recaptchaWidgetId;
let recaptchaInitStarted = false;
const RECAPTCHA_SITE_KEY = (typeof window !== 'undefined' && window.RECAPTCHA_SITE_KEY) ? window.RECAPTCHA_SITE_KEY : '';

// Global variables for DOM elements
let registrationForm, loginForm;
let emailInput, passwordInput, confirmPasswordInput, agreeCheckbox;
let errorMessage;
let submitButton;

// --- Utility functions for validation and errors ---
function clearError() {
    if (errorMessage) errorMessage.textContent = '';
}

function setFieldValidation(input, isValid) {
    if (!input) return;
    input.classList.remove('error', 'valid');
    if (isValid) {
        input.classList.add('valid');
    } else if (input.value.trim()) {
        input.classList.add('error');
    } else {
        input.classList.remove('error', 'valid');
    }
}

// --- reCAPTCHA handlers ---
function waitForRecaptchaReady(timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
        const start = Date.now();
        function check() {
            if (typeof grecaptcha !== 'undefined') {
                if (typeof grecaptcha.ready === 'function') {
                    grecaptcha.ready(() => resolve());
                    return;
                }
                if (typeof grecaptcha.render === 'function') {
                    resolve();
                    return;
                }
            }
            if (Date.now() - start > timeoutMs) {
                reject(new Error('reCAPTCHA API not ready'));
                return;
            }
            setTimeout(check, 150);
        }
        check();
    });
}

function initializeRecaptchaWidget() {
    console.log("1. initializeRecaptchaWidget called.");
    console.log("2. RECAPTCHA_SITE_KEY:", RECAPTCHA_SITE_KEY);
    
    if (typeof recaptchaWidgetId !== 'undefined') {
        console.log('reCAPTCHA already rendered, skipping duplicate render.');
        return;
    }

    if (!RECAPTCHA_SITE_KEY) {
        console.error('Site key missing. Check template and config.');
        if (errorMessage) errorMessage.textContent = 'CAPTCHA не настроена. Обратитесь к администратору.';
        return;
    }

    try {
        recaptchaInitStarted = true;
        recaptchaWidgetId = grecaptcha.render('recaptcha-placeholder', {
            sitekey: RECAPTCHA_SITE_KEY,
            size: 'normal',
            callback: onRecaptchaSuccess,
            'expired-callback': onRecaptchaExpired,
            'error-callback': function() {
                console.error('reCAPTCHA error-callback triggered');
                if (errorMessage) errorMessage.textContent = 'Ошибка CAPTCHA. Попробуйте снова.';
                if (submitButton) { 
                    submitButton.disabled = false; 
                    submitButton.textContent = 'Зарегистрироваться'; 
                }
            }
        });

        const placeholder = document.getElementById('recaptcha-placeholder');
        if (placeholder) placeholder.style.display = 'block';
        console.log("3. grecaptcha.render() successful. recaptchaWidgetId:", recaptchaWidgetId);
    } catch (e) {
        console.error("4. ERROR calling grecaptcha.render():", e);
        recaptchaInitStarted = false;
        if (errorMessage) errorMessage.textContent = 'Ошибка загрузки CAPTCHA. Проверьте Site Key или наличие div с id="recaptcha-placeholder".';
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = 'Зарегистрироваться';
        }
    }
}

function onRecaptchaSuccess(token) {
    console.log("reCAPTCHA successfully solved, token received:", token);
    clearError();
    
    // Only auto-submit if we're on registration page
    if (registrationForm) {
        submitRegistrationForm(token);
    }
    // For login page, just enable the submit button
    if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = submitButton.textContent.replace('...', '');
    }
}

function onRecaptchaExpired() {
    console.warn("reCAPTCHA expired.");
    grecaptcha.reset(recaptchaWidgetId);
    if (errorMessage) errorMessage.textContent = 'Срок действия CAPTCHA истёк. Пожалуйста, попробуйте снова.';
    if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = 'Зарегистрироваться';
    }
}

// --- Main registration form submission function ---
async function submitRegistrationForm(recaptchaToken = null) {
    // Only proceed if we're actually on a registration page
    if (!registrationForm) {
        console.warn("submitRegistrationForm called but no registration form found");
        return;
    }
    
    clearError();

    // Form validation
    let isValid = true;
    const currentEmail = emailInput ? emailInput.value.trim() : '';
    const currentPassword = passwordInput ? passwordInput.value : '';
    const currentConfirmPassword = confirmPasswordInput ? confirmPasswordInput.value : '';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;

    // Validate agreement checkbox (only if it exists - registration page)
    if (agreeCheckbox && !agreeCheckbox.checked) {
        if (errorMessage) errorMessage.textContent = 'Необходимо согласиться с условиями';
        isValid = false;
    }

    // Validate Email
    if (!currentEmail || !emailRegex.test(currentEmail)) {
        if (errorMessage) errorMessage.textContent = 'Введите корректный email адрес';
        setFieldValidation(emailInput, false);
        isValid = false;
    } else {
        setFieldValidation(emailInput, true);
    }

    // Validate Password and Confirmation (only for registration)
    if (!currentPassword || (confirmPasswordInput && !currentConfirmPassword)) {
        if (errorMessage) errorMessage.textContent = 'Все поля обязательны для заполнения';
        if (!currentPassword) setFieldValidation(passwordInput, false);
        if (confirmPasswordInput && !currentConfirmPassword) setFieldValidation(confirmPasswordInput, false);
        isValid = false;
    } else {
        if (currentPassword.length < 8) {
            if (errorMessage) errorMessage.textContent = 'Пароль должен быть не менее 8 символов';
            setFieldValidation(passwordInput, false);
            isValid = false;
        } else if (!passwordRegex.test(currentPassword)) {
            if (errorMessage) errorMessage.textContent = 'Пароль должен содержать хотя бы одну букву, одну заглавную букву и одну цифру';
            setFieldValidation(passwordInput, false);
            isValid = false;
        } else {
            setFieldValidation(passwordInput, true);
        }

        // Only check password confirmation if confirm field exists (registration page)
        if (confirmPasswordInput) {
            if (currentPassword !== currentConfirmPassword) {
                if (errorMessage) errorMessage.textContent = 'Пароли не совпадают';
                setFieldValidation(confirmPasswordInput, false);
                isValid = false;
            } else {
                setFieldValidation(confirmPasswordInput, true);
            }
        }
    }

    if (!isValid) {
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = 'Зарегистрироваться';
        }
        grecaptcha.reset(recaptchaWidgetId);
        return;
    }

    // reCAPTCHA logic: if no token, get it from widget (only if not disabled)
    if (!recaptchaToken && !window.RECAPTCHA_DISABLED) {
        if (typeof grecaptcha === 'undefined' || typeof recaptchaWidgetId === 'undefined') {
            console.error('grecaptcha or widget not initialized');
            if (errorMessage) errorMessage.textContent = 'CAPTCHA не готова. Обновите страницу.';
            if (submitButton) { 
                submitButton.disabled = false; 
                submitButton.textContent = 'Зарегистрироваться'; 
            }
            return;
        }

        const tokenFromWidget = grecaptcha.getResponse(recaptchaWidgetId);
        console.log('reCAPTCHA token from widget:', tokenFromWidget ? tokenFromWidget.substring(0, 50) + '...' : 'null');
        
        if (!tokenFromWidget) {
            console.log('No reCAPTCHA token - user needs to complete captcha');
            if (errorMessage) errorMessage.textContent = 'Подтвердите, что вы не робот.';
            if (submitButton) { 
                submitButton.disabled = false; 
                submitButton.textContent = 'Зарегистрироваться'; 
            }
            return;
        }
        recaptchaToken = tokenFromWidget;
    }

    // Send data to server
    console.log("Got recaptchaToken, sending request to server.");
    const originalButtonText = submitButton.textContent;
    if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'Регистрация...';
    }

    try {
        const requestData = {
            email: currentEmail,
            password: currentPassword,
            confirmPassword: currentConfirmPassword,
            'g-recaptcha-response': recaptchaToken
        };

        const response = await fetch('/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestData)
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Ошибка сервера');
        }

        if (result.success) {
            localStorage.setItem('registerEmail', currentEmail);
            window.location.href = `/auth/confirmation?email=${encodeURIComponent(currentEmail)}`;
        } else {
            if (errorMessage) errorMessage.textContent = result.error || 'Произошла ошибка при регистрации';
        }
    } catch (error) {
        console.error('Registration error:', error);
        if (errorMessage) errorMessage.textContent = error.message || 'Ошибка соединения с сервером. Попробуйте снова.';
    } finally {
        if (submitButton) {
            submitButton.textContent = originalButtonText;
            submitButton.disabled = false;
        }
        grecaptcha.reset(recaptchaWidgetId);
    }
}

// --- DOMContentLoaded: Initialize all elements and listeners ---
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOMContentLoaded in auth.js');

    // Initialize global variables for DOM elements
    registrationForm = document.getElementById('registration-form');
    loginForm = document.getElementById('login-form');
    emailInput = document.getElementById('email');
    passwordInput = document.getElementById('password');
    confirmPasswordInput = document.getElementById('confirmPassword');
    errorMessage = document.getElementById('error-message');
    agreeCheckbox = document.getElementById('agree');
    submitButton = document.getElementById('register-button');

    // Field validation event handlers
    if (emailInput) {
        emailInput.addEventListener('input', function() {
            clearError();
            const email = this.value.trim();
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            setFieldValidation(this, email && emailRegex.test(email));
        });
    }

    if (passwordInput) {
        passwordInput.addEventListener('input', function() {
            clearError();
            const password = this.value;
            const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;
            setFieldValidation(this, password.length >= 8 && passwordRegex.test(password));
            if (confirmPasswordInput && confirmPasswordInput.value) {
                confirmPasswordInput.dispatchEvent(new Event('input'));
            }
        });
    }

    if (confirmPasswordInput) {
        confirmPasswordInput.addEventListener('input', function() {
            clearError();
            const password = passwordInput.value;
            const confirmPassword = this.value;
            setFieldValidation(this, confirmPassword && password === confirmPassword);
        });
    }

    // Initialize reCAPTCHA when API is ready (only if not disabled)
    let initialized = false;
    const placeholder = document.getElementById('recaptcha-placeholder');
    
    if (!window.RECAPTCHA_DISABLED && placeholder && RECAPTCHA_SITE_KEY) {
        waitForRecaptchaReady(12000).then(() => {
        if (typeof recaptchaWidgetId !== 'undefined') return;
        
        recaptchaWidgetId = grecaptcha.render('recaptcha-placeholder', {
            sitekey: RECAPTCHA_SITE_KEY,
            size: 'normal',
            callback: onRecaptchaSuccess,
            'expired-callback': onRecaptchaExpired,
            'error-callback': function() {
                console.error('reCAPTCHA error-callback triggered');
                if (errorMessage) errorMessage.textContent = 'Ошибка CAPTCHA. Попробуйте снова.';
                if (submitButton) { 
                    submitButton.disabled = false; 
                    submitButton.textContent = 'Зарегистрироваться'; 
                }
            }
        });
        
        if (placeholder) placeholder.style.display = 'block';
        initialized = true;
        }).catch((e) => {
            console.error('reCAPTCHA API not ready:', e);
            if (errorMessage) errorMessage.textContent = 'CAPTCHA не загрузилась. Проверьте блокировщики/сеть и обновите страницу.';
        });
    }

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', function(event) {
        console.error('Unhandled promise rejection:', event.reason);
        if (errorMessage) errorMessage.textContent = 'Внутренняя ошибка. Попробуйте снова.';
        if (submitButton) { 
            submitButton.disabled = false; 
            submitButton.textContent = 'Зарегистрироваться'; 
        }
    });

    // Registration form submission handler
    if (registrationForm) {
        registrationForm.addEventListener('submit', function(event) {
            event.preventDefault();
            console.log("0. 'Register' button clicked.");
            if (submitButton) {
                submitButton.disabled = true;
                submitButton.textContent = 'Проверка...';
            }
            submitRegistrationForm();
        });
    } else {
        console.warn("Registration form (registration-form) not found.");
    }

    // Login form handler (if exists)
    if (loginForm) {
        loginForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (errorMessage) errorMessage.textContent = '';

            const loginEmail = document.getElementById('email').value.trim();
            const loginPassword = document.getElementById('password').value;
            const loginSubmitButton = document.getElementById('login-button');

            if (!loginEmail || !loginPassword) {
                if (errorMessage) errorMessage.textContent = 'Пожалуйста, заполните все поля';
                return;
            }

            const originalLoginButtonText = loginSubmitButton ? loginSubmitButton.textContent : 'Войти';
            if (loginSubmitButton) {
                loginSubmitButton.textContent = 'Вход...';
                loginSubmitButton.disabled = true;
            }

            try {
                const response = await fetch('/auth/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ email: loginEmail, password: loginPassword })
                });

                const data = await response.json();
                if (response.ok) {
                    window.location.href = '/home';
                } else {
                    if (errorMessage) errorMessage.textContent = data.error || 'Ошибка входа';
                }
            } catch (err) {
                console.error('Login error:', err);
                if (errorMessage) errorMessage.textContent = 'Ошибка сети или сервера';
            } finally {
                if (loginSubmitButton) {
                    loginSubmitButton.textContent = originalLoginButtonText;
                    loginSubmitButton.disabled = false;
                }
            }
        });
    }
});