import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { api } from '@/api/apiClient';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);

  const checkUserAuth = useCallback(async () => {
    setIsLoadingAuth(true);
    try {
      const currentUser = await api.auth.me();
      setUser(currentUser);
      setIsAuthenticated(true);
      setAuthError(null);
    } catch (error) {
      setUser(null);
      setIsAuthenticated(false);
      // Sem sessão válida (nunca logou, ou token expirado) - não é um erro
      // pra mostrar na tela, só significa "precisa fazer login".
      if (error?.status === 401 || error?.status === 403) {
        setAuthError({ type: 'auth_required', message: 'Authentication required' });
      } else if (error) {
        setAuthError({ type: 'unknown', message: error.message || 'Erro ao verificar sessão' });
      }
    } finally {
      setIsLoadingAuth(false);
    }
  }, []);

  useEffect(() => {
    checkUserAuth();
  }, [checkUserAuth]);

  const login = async (email, password) => {
    const loggedInUser = await api.auth.login(email, password);
    setUser(loggedInUser);
    setIsAuthenticated(true);
    setAuthError(null);
    return loggedInUser;
  };

  const logout = (shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);
    api.auth.logout(shouldRedirect ? '/login' : undefined);
  };

  const navigateToLogin = () => {
    api.auth.redirectToLogin(window.location.pathname + window.location.search);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoadingAuth,
        // Mantidos por compatibilidade com telas que ainda checam esses
        // campos (equivalentes ao fluxo de autenticação externo antigo) - a
        // checagem de "public settings" da plataforma não existe mais no
        // backend próprio.
        isLoadingPublicSettings: false,
        appPublicSettings: null,
        authError,
        login,
        logout,
        navigateToLogin,
        checkUserAuth,
        checkAppState: checkUserAuth,
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
