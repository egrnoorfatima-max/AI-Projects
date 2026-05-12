import React, { useState } from 'react';
import axios from 'axios';

function Login({ API_BASE, onLoginSuccess }) {
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await axios.post(
        `${API_BASE}/login`,
        new URLSearchParams({
          username: loginEmail,
          password: loginPassword,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      const accessToken = response.data?.access_token;
      if (!accessToken) {
        throw new Error('Login failed, no token returned');
      }

      onLoginSuccess(accessToken, loginEmail);
      setLoginPassword('');
    } catch (err) {
      setError('Login failed: ' + (err.response?.data?.detail || err.message));
    }
    setLoading(false);
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <h2>Recruiter Login</h2>
        {error && <div className="login-error">{error}</div>}
        <label>
          Email
          <input
            type="email"
            value={loginEmail}
            onChange={(e) => setLoginEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={loginPassword}
            onChange={(e) => setLoginPassword(e.target.value)}
            placeholder="Enter your password"
          />
        </label>
        <button className="btn btn-primary" onClick={handleLogin} disabled={loading || !loginEmail || !loginPassword}>
          {loading ? 'Signing in...' : 'Login'}
        </button>
      </div>
    </div>
  );
}

export default Login;