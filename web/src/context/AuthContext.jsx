import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, setCsrfToken } from '../lib/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [csrfToken, setCsrf] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    try {
      const result = await api('/auth/session');
      setUser(result.user || null);
      setCsrf(result.csrfToken || null);
      setCsrfToken(result.csrfToken || null);
      return result;
    } catch (err) {
      setUser(null);
      setCsrf(null);
      setCsrfToken(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  const login = useCallback(async (credentials) => {
    const result = await api('/auth/login', { method: 'POST', body: credentials });
    setUser(result.user);
    setCsrf(result.csrfToken);
    setCsrfToken(result.csrfToken);
    return result.user;
  }, []);

  const register = useCallback(async (data) => {
    const result = await api('/auth/register', { method: 'POST', body: data });
    setUser(result.user);
    setCsrf(result.csrfToken);
    setCsrfToken(result.csrfToken);
    return result.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api('/auth/logout', { method: 'POST' });
    } catch {
      // Proceed with local state cleanup
    }
    setUser(null);
    setCsrf(null);
    setCsrfToken(null);
    await refreshSession();
  }, [refreshSession]);

  const updateProfile = useCallback(async (profileData) => {
    const result = await api('/auth/profile', { method: 'PATCH', body: profileData });
    setUser(result.user);
    return result.user;
  }, []);

  const changePassword = useCallback(async (passwordData) => {
    const result = await api('/auth/password', { method: 'POST', body: passwordData });
    setCsrf(result.csrfToken);
    setCsrfToken(result.csrfToken);
    return result;
  }, []);

  const value = {
    user,
    csrfToken,
    loading,
    login,
    register,
    logout,
    updateProfile,
    changePassword,
    refreshSession,
    isStaff: user && user.role !== 'customer',
    isOwner: user && user.role === 'owner',
    isManager: user && ['owner', 'manager'].includes(user.role),
    isWarehouse: user && ['owner', 'warehouse'].includes(user.role),
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
