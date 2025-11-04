import { useState } from 'react';
import axios from '../api/axios';
import { useNavigate } from 'react-router-dom';

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleRegister = async () => {
    try {
      const res = await axios.post('/auth/register', form);
      localStorage.setItem('token', res.data.accessToken);
      navigate('/'); // redirect to home/dashboard
    } catch (err) {
      alert(err.response?.data?.message || 'Register failed');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 shadow-md rounded w-96">
        <h2 className="text-2xl font-semibold mb-4">Register</h2>
        <input name="name" placeholder="Name" className="input" onChange={handleChange} />
        <input name="email" placeholder="Email" className="input mt-2" onChange={handleChange} />
        <input name="password" type="password" placeholder="Password" className="input mt-2" onChange={handleChange} />
        <button onClick={handleRegister} className="btn-primary mt-4 w-full">
          Register
        </button>
      </div>
    </div>
  );
}
