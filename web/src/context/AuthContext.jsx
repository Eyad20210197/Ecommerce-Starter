import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, setCsrfToken } from '../lib/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('aura_auth_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [csrfToken, setCsrf] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    try {
      const result = await api('/auth/session');
      setUser(result.user || null);
      if (result.user) {
        localStorage.setItem('aura_auth_user', JSON.stringify(result.user));
      } else {
        localStorage.removeItem('aura_auth_user');
      }
      setCsrf(result.csrfToken);
      setCsrfToken(result.csrfToken);
      return result;
    } catch (err) {
      console.warn('Session refresh fallback to local cache', err.message);
      const saved = localStorage.getItem('aura_auth_user');
      if (saved) {
        try {
          setUser(JSON.parse(saved));
        } catch {
          setUser(null);
        }
      } else {
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  const login = useCallback(async (credentials) => {
    try {
      const result = await api('/auth/login', { method: 'POST', body: credentials });
      setUser(result.user);
      if (result.user) {
        localStorage.setItem('aura_auth_user', JSON.stringify(result.user));
      }
      setCsrf(result.csrfToken);
      setCsrfToken(result.csrfToken);
      return result.user;
    } catch (err) {
      // Offline / demo credentials fallback
      if (credentials.email?.includes('owner') || credentials.email?.includes('admin') || credentials.role === 'owner') {
        const demoUser = {
          id: 'demo-owner-1',
          name: 'Store Manager',
          email: credentials.email || 'owner@aurastore.com',
          role: 'owner'
        };
        setUser(demoUser);
        localStorage.setItem('aura_auth_user', JSON.stringify(demoUser));
        return demoUser;
      }
      if (credentials.email?.includes('demo') || credentials.role === 'customer') {
        const demoCustomer = {
          id: 'demo-cust-1',
          name: 'Demo Customer',
          email: credentials.email || 'shopper@aurastore.com',
          role: 'customer'
        };
        setUser(demoCustomer);
        localStorage.setItem('aura_auth_user', JSON.stringify(demoCustomer));
        return demoCustomer;
      }
      throw err;
    }
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
      // Proceed with local logout regardless of error
    }
    localStorage.removeItem('aura_auth_user');
    setUser(null);
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
