import { useState } from 'react';
import axios from '../api/axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  buildRegisterPayload,
  passwordRequirements,
  validateEmail,
  validatePasswordPolicy
} from '../lib/auth-contract';

const getValidationMessage = (error) => {
  const fieldErrors = error.response?.data?.error?.fieldErrors;

  if (fieldErrors) {
    return Object.entries(fieldErrors)
      .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
      .join('\n');
  }

  return error.response?.data?.error?.message || error.response?.data?.message || error.message || 'Registration failed.';
};

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleRegister = async (event) => {
    event.preventDefault();
    setError('');

    if (!validateEmail(form.email)) {
      setError('Enter a valid email address.');
      return;
    }

    if (!validatePasswordPolicy(form.password)) {
      setError('Password does not meet the security requirements.');
      return;
    }

    try {
      setLoading(true);
      const payload = await buildRegisterPayload(form);
      const res = await axios.post('/auth/register', payload);
      login(res.data.user, res.data.accessToken, res.data.csrfToken);
      navigate('/');
    } catch (err) {
      setError(getValidationMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <form onSubmit={handleRegister} className="bg-white p-8 shadow-md rounded w-96">
        <h2 className="text-2xl font-semibold mb-4">Register</h2>
        {error && <p className="mb-3 whitespace-pre-line rounded bg-red-50 p-2 text-sm text-red-600">{error}</p>}
        <input
          name="name"
          placeholder="Name"
          className="input"
          value={form.name}
          onChange={handleChange}
          autoComplete="name"
        />
        <input
          name="email"
          type="email"
          placeholder="Email"
          className="input mt-2"
          value={form.email}
          onChange={handleChange}
          autoComplete="email"
        />
        <input
          name="password"
          type="password"
          placeholder="Password"
          className="input mt-2"
          value={form.password}
          onChange={handleChange}
          autoComplete="new-password"
        />
        <ul className="mt-3 list-disc pl-5 text-xs text-gray-600">
          {passwordRequirements.map((requirement) => (
            <li key={requirement}>{requirement}</li>
          ))}
        </ul>
        <button type="submit" disabled={loading} className="btn-primary mt-4 w-full">
          {loading ? 'Creating account...' : 'Register'}
        </button>
      </form>
    </div>
  );
}
