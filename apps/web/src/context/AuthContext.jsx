import { createContext, useContext, useEffect, useState } from 'react';
import axios from '../api/axios';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [auth, setAuth] = useState({ user: null, accessToken: null });

  const login = (user, token) => {
    setAuth({ user, accessToken: token });
    localStorage.setItem('token', token);
  };

  const logout = () => {
    setAuth({ user: null, accessToken: null });
    localStorage.removeItem('token');
  };

  // Optional: Load user from refresh token on mount
  useEffect(() => {
    const refresh = async () => {
      const storedToken = localStorage.getItem('token');
      if (!storedToken) return;

      try {
        const res = await axios.post('/auth/refresh-token');
        setAuth({ accessToken: res.data.accessToken, user: res.data.user });
      } catch (err) {
        console.error('Token refresh failed', err);
      }
    };
    refresh();
  }, []);

  useEffect(() => {
    console.log('🔐 Auth State Changed:', auth);
  }, [auth]);


  return (
    <AuthContext.Provider value={{ accessToken: auth.accessToken, user: auth.user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
