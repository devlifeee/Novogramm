import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../../src/providers/AuthProvider';

import '../css/auth.css';
import '../css/stars.css';

import Login from '../../src/components/auth/Login.jsx';
import Register from '../../src/components/auth/Registration.jsx';
import Confirmation from '../../src/components/auth/Confirmation.jsx';
import AccountCreation from '../../src/components/auth/AccountCreation.jsx';
import ForgotPassword from '../../src/components/auth/ForgotPassword.jsx';
import PrivacyPolicy from '../../src/components/auth/PrivacyPolicy.jsx';
import ResetPassword from '../../src/components/auth/ResetPassword.jsx';
import Home from '../../src/pages/Home.jsx';
import Settings from '../../src/pages/Settings.jsx';
import Chats from '../../src/pages/Chats.jsx';

const PrivateRoute = ({ children }) => {
  const token = localStorage.getItem('authToken');
  return token ? children : <Navigate to="/login" replace />;
};

const App = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/register" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/auth/login" element={<Navigate to="/login" replace />} />
          <Route path="/register" element={<Register />} />
          <Route path="/auth/register" element={<Navigate to="/register" replace />} />
          <Route path="/auth/confirmation" element={<Confirmation />} />
          <Route path="/auth/account_creation" element={<AccountCreation />} />
          <Route path="/auth/forgot-password" element={<ForgotPassword />} />
          <Route path="/auth/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/auth/reset-password" element={<ResetPassword />} />
          <Route path="/auth/reset-password/:token" element={<ResetPassword />} />
          <Route
            path="/home"
            element={
              <PrivateRoute>
                <Home />
              </PrivateRoute>
            }
          />
          <Route
            path="/chats"
            element={
              <PrivateRoute>
                <Chats />
              </PrivateRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <PrivateRoute>
                <Settings />
              </PrivateRoute>
            }
          />
          <Route path="*" element={<Navigate to="/register" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
