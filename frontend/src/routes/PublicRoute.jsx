import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FullScreenSpinner } from '../components/ui/Spinner';

export const PublicRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <FullScreenSpinner />;
  }

  if (isAuthenticated) {
    return <Navigate to="/app/dashboard" replace />;
  }

  return children;
};
