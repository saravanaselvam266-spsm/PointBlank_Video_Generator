import React, { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../api/client';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const initAuth = async () => {
    try {
      const token = localStorage.getItem('pb_token');
      if (!token) {
        setUser(null);
        setIsLoading(false);
        return;
      }
      const res = await authApi.getMe();
      if (res.data) {
        setUser(res.data);
      } else {
        setUser(null);
      }
    } catch (err) {
      setUser(null);
      localStorage.removeItem('pb_token');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    initAuth();
  }, []);

  const login = async (email, password) => {
    setIsLoading(true);
    try {
      const res = await authApi.login({ email, password });
      const { access_token, user: userData } = res.data;
      if (access_token) {
        localStorage.setItem('pb_token', access_token);
      }
      setUser(userData);
      return userData;
    } catch (err) {
      setUser(null);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch (err) {
      // Ignore logout backend errors
    } finally {
      localStorage.removeItem('pb_token');
      setUser(null);
      window.location.href = '/login';
    }
  };

  const refreshUser = async () => {
    try {
      const res = await authApi.getMe();
      if (res.data) {
        setUser(res.data);
      }
    } catch (err) {
      console.error('Failed to refresh user identity:', err);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        refreshUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
