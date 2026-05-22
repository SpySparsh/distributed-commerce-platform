import { createContext, useContext, useEffect, useState } from 'react';
import axios from '../api/axios';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [auth, setAuth] = useState({ user: null, accessToken: null, csrfToken: null });
  const [isHydrating, setIsHydrating] = useState(true);

  const login = (user, token, csrfToken) => {
    setAuth({ user, accessToken: token, csrfToken });
    localStorage.setItem('token', token);

    if (csrfToken) {
      localStorage.setItem('csrfToken', csrfToken);
    }
  };

  const logout = async () => {
    try {
      await axios.post('/auth/logout');
    } catch (err) {
      console.error('Logout failed', err);
    }

    setAuth({ user: null, accessToken: null, csrfToken: null });
    localStorage.removeItem('token');
    localStorage.removeItem('csrfToken');
  };

  useEffect(() => {
    const refresh = async () => {
      const csrfToken = localStorage.getItem('csrfToken');

      if (!csrfToken) {
        setIsHydrating(false);
        return;
      }

      try {
        const res = await axios.post('/auth/refresh', { csrfToken });
        login(res.data.user, res.data.accessToken, res.data.csrfToken);
      } catch (err) {
        console.error('Token refresh failed', err);
        localStorage.removeItem('token');
        localStorage.removeItem('csrfToken');
      } finally {
        setIsHydrating(false);
      }
    };

    refresh();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        accessToken: auth.accessToken,
        csrfToken: auth.csrfToken,
        user: auth.user,
        isHydrating,
        isAuthenticated: Boolean(auth.accessToken && auth.user),
        login,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
