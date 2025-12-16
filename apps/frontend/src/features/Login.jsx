import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../api/client';
import useAuthStore from '../stores/authStore';

function Login() {
  const navigate = useNavigate();
  const { token, setToken, setUser, isAuthenticated } = useAuthStore();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (token || isAuthenticated) {
      navigate('/dashboard');
    }
  }, [token, isAuthenticated, navigate]);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { data } = await authApi.login(form);
      setToken(data.access_token);
      const me = await authApi.me();
      setUser(me.data);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '420px', margin: '3rem auto' }}>
      <h2 style={{ marginBottom: '1rem' }}>Welcome back</h2>
      <form onSubmit={submit} style={{ display: 'grid', gap: '0.75rem' }} aria-label="login-form">
        <label style={{ display: 'grid', gap: '0.3rem' }}>
          <span>Email</span>
          <input
            aria-label="email-input"
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            required
            style={{ padding: '0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}
          />
        </label>
        <label style={{ display: 'grid', gap: '0.3rem' }}>
          <span>Password</span>
          <input
            aria-label="password-input"
            name="password"
            type="password"
            value={form.password}
            onChange={handleChange}
            required
            style={{ padding: '0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}
          />
        </label>
        <button
          aria-label="login-submit"
          type="submit"
          disabled={loading}
          style={{
            padding: '0.75rem',
            background: '#0f172a',
            color: 'white',
            border: 'none',
            borderRadius: '10px',
            cursor: 'pointer',
          }}
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
        {error && <div style={{ color: '#b91c1c' }}>{error}</div>}
      </form>
    </div>
  );
}

export default Login;
