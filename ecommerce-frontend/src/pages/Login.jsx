import { useState } from 'react';
import axios from '../api/axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';



export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();
  const { login } = useAuth();

    const handleLogin = async () => {
    try {
        const res = await axios.post('/auth/login', { email, password });
        console.log('Login success:', res.data);
        login(res.data.user, res.data.accessToken); // if using context
        navigate('/');
    } catch (err) {
        console.log('Login error:', err.response?.data || err.message);
        alert(err.response?.data?.message || 'Login failed');
    }
    };


  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 shadow-md rounded w-96">
        <h2 className="text-2xl font-semibold mb-4">Login</h2>
        <input
          type="email"
          placeholder="Email"
          className="input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password"
          placeholder="Password"
          className="input mt-2"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button onClick={handleLogin} className="btn-primary mt-4 w-full">
          Login
        </button>
      </div>
    </div>
  );
}
