import React, { createContext, useContext, useEffect, useState } from 'react';

const AuthContext = createContext(null);

const parseJson = async (response) => {
  try {
    return await response.json();
  } catch (error) {
    return {};
  }
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    const email = localStorage.getItem('authEmail');

    if (token) {
      setUser({ token, email });
    }

    setLoading(false);
  }, []);

  const register = async (email, password, confirmPassword, recaptchaToken = '') => {
    try {
      const response = await fetch('/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          confirm_password: confirmPassword,
          'g-recaptcha-response': recaptchaToken
        })
      });

      const data = await parseJson(response);
      if (!response.ok || !data.success) {
        return { success: false, error: data.error || 'Registration failed' };
      }

      if (data.token) {
        localStorage.setItem('authToken', data.token);
        localStorage.setItem('authEmail', email);
        setUser({ token: data.token, email });
      }

      return {
        success: true,
        token: data.token || '',
        skipVerification: Boolean(data.token),
        message: data.message || '',
        devCode: data.dev_code || ''
      };
    } catch (error) {
      return { success: false, error: 'Server connection error' };
    }
  };

  const login = async (email, password, recaptchaToken = '') => {
    try {
      const response = await fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          'g-recaptcha-response': recaptchaToken
        })
      });

      const data = await parseJson(response);
      if (!response.ok || !data.success) {
        return { success: false, error: data.error || 'Login failed' };
      }

      if (data.token) {
        localStorage.setItem('authToken', data.token);
        localStorage.setItem('authEmail', email);
      }

      setUser({
        ...(data.user || {}),
        email,
        token: data.token || ''
      });

      return { success: true, user: data.user || null };
    } catch (error) {
      return { success: false, error: 'Server connection error' };
    }
  };

  const forgotPassword = async (email, recaptchaToken = '') => {
    try {
      const response = await fetch('/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          'g-recaptcha-response': recaptchaToken
        })
      });

      const data = await parseJson(response);
      if (!response.ok || !data.success) {
        return { success: false, error: data.error || 'Password recovery failed' };
      }

      return { success: true, message: data.message || 'Instructions sent' };
    } catch (error) {
      return { success: false, error: 'Server connection error' };
    }
  };

  const changePassword = async (token, newPassword, confirmPassword) => {
    try {
      const response = await fetch('/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          new_password: newPassword,
          confirm_password: confirmPassword
        })
      });

      const data = await parseJson(response);
      if (!response.ok || !data.success) {
        return { success: false, error: data.error || 'Password change failed' };
      }

      return { success: true, message: data.message || 'Password changed' };
    } catch (error) {
      return { success: false, error: 'Server connection error' };
    }
  };

  const logout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('authEmail');
    setUser(null);
  };

  const value = {
    user,
    loading,
    isAuthenticated: Boolean(user?.token),
    register,
    login,
    forgotPassword,
    changePassword,
    logout
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
