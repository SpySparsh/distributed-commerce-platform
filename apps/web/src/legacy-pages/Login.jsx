import { useState } from 'react';
import axios from '../api/axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { buildLoginPayload, validateEmail } from '../lib/auth-contract';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleLogin = async (event) => {
    event.preventDefault();
    setError('');

    if (!validateEmail(email)) {
      setError('Enter a valid email address.');
      return;
    }

    if (!password) {
      setError('Password is required.');
      return;
    }

    try {
      setLoading(true);
      const payload = await buildLoginPayload({ email, password });
      const res = await axios.post('/auth/login', payload);
      login(res.data.user, res.data.accessToken, res.data.csrfToken);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error?.message || err.response?.data?.message || err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <form onSubmit={handleLogin} className="bg-white p-8 shadow-md rounded w-96">
        <h2 className="text-2xl font-semibold mb-4">Login</h2>
        {error && <p className="mb-3 rounded bg-red-50 p-2 text-sm text-red-600">{error}</p>}
        <input
          type="email"
          placeholder="Email"
          className="input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
        <input
          type="password"
          placeholder="Password"
          className="input mt-2"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
        <button type="submit" disabled={loading} className="btn-primary mt-4 w-full">
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>
    </div>
  );
}
