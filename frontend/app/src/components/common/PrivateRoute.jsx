import React from 'react';
import { Navigate } from 'react-router-dom';

const PrivateRoute = ({ children }) => {
  const isAuthenticated = () => {
    const token = localStorage.getItem('authToken');
    return !!token;
  };

  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default PrivateRoute;