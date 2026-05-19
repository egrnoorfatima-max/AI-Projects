import React, { useState } from 'react';
import axios from 'axios';

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&family=DM+Serif+Display:ital@0;1&display=swap');

  /* ── Page ─────────────────────────────────────────────────── */
  .hiq-page {
    position: relative;
    min-height: 100vh;
    background: #1a2236;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 20px;
    overflow: hidden;
    font-family: 'Sora', sans-serif;
  }

  /* ── Background decoration (layer 0) ─────────────────────── */
  .hiq-ring {
    position: absolute;
    border-radius: 50%;
    border: 1px solid rgba(91,124,246,0.07);
    pointer-events: none;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 0;
  }
  .hiq-dot {
    position: absolute;
    width: 3px;
    height: 3px;
    border-radius: 50%;
    background: #5b7cf6;
    opacity: 0.28;
    pointer-events: none;
    z-index: 0;
  }
  .hiq-line {
    position: absolute;
    height: 1px;
    width: 180px;
    background: rgba(91,124,246,0.06);
    pointer-events: none;
    z-index: 0;
  }

  /* ── Brand (layer 2) ─────────────────────────────────────── */
  .hiq-brand {
    display: flex;
    align-items: center;
    gap: 11px;
    margin-bottom: 40px;
    animation: hiqFadeUp 0.5s ease both;
    animation-delay: 0ms;
    position: relative;
    z-index: 2;
  }
  .hiq-brand-mark {
    width: 38px;
    height: 38px;
    border-radius: 10px;
    background: #5b7cf6;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .hiq-brand-name {
    font-size: 20px;
    font-weight: 700;
    color: #eef1fa;
    letter-spacing: -0.3px;
  }
  .hiq-brand-iq {
    color: #5b7cf6;
  }

  /* ── Card (layer 2) ──────────────────────────────────────── */
  .hiq-card {
    position: relative;
    max-width: 420px;
    width: 100%;
    background: #212d45;
    border: 1px solid rgba(255,255,255,0.09);
    border-radius: 20px;
    padding: 40px 40px 36px;
    animation: hiqFadeUp 0.5s ease both;
    animation-delay: 80ms;
    z-index: 2;
  }
  .hiq-card-bar {
    position: absolute;
    top: 0;
    left: 24px;
    right: 24px;
    height: 2px;
    background: #5b7cf6;
    border-radius: 0 0 2px 2px;
    opacity: 0.7;
  }
  .hiq-card-header {
    margin-bottom: 30px;
  }
  .hiq-heading {
    font-family: 'DM Serif Display', serif;
    font-size: 30px;
    font-weight: 400;
    color: #eef1fa;
    line-height: 1.2;
    letter-spacing: -0.3px;
    margin: 0;
  }
  .hiq-heading em {
    font-style: italic;
    color: #5b7cf6;
  }
  .hiq-subheading {
    font-size: 13.5px;
    color: #8a9bbf;
    margin-top: 6px;
    margin-bottom: 0;
  }

  /* ── Form ─────────────────────────────────────────────────── */
  .hiq-form {
    display: flex;
    flex-direction: column;
  }
  .hiq-field {
    display: flex;
    flex-direction: column;
    margin-bottom: 18px;
  }
  .hiq-label {
    font-size: 11.5px;
    font-weight: 600;
    letter-spacing: 0.7px;
    text-transform: uppercase;
    color: #566280;
    margin-bottom: 7px;
    display: block;
  }
  .hiq-input-wrap {
    position: relative;
  }
  .hiq-input-icon {
    position: absolute;
    left: 14px;
    top: 50%;
    transform: translateY(-50%);
    color: #566280;
    pointer-events: none;
    display: flex;
    align-items: center;
  }
  .hiq-input {
    width: 100%;
    height: 48px;
    padding: 0 44px 0 42px;
    background: #1e2a42;
    border: 1px solid rgba(255,255,255,0.09);
    border-radius: 12px;
    font-family: 'Sora', sans-serif;
    font-size: 14px;
    color: #eef1fa;
    outline: none;
    box-sizing: border-box;
    transition: border-color 0.2s, box-shadow 0.2s;
  }
  .hiq-input::placeholder {
    color: #566280;
  }
  .hiq-input:focus {
    border-color: #5b7cf6;
    box-shadow: 0 0 0 3px rgba(91,124,246,0.15);
  }
  .hiq-eye-btn {
    position: absolute;
    right: 14px;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    cursor: pointer;
    color: #566280;
    display: flex;
    align-items: center;
    padding: 0;
    transition: color 0.15s;
    line-height: 0;
  }
  .hiq-eye-btn:hover {
    color: #8a9bbf;
  }

  /* ── Error ────────────────────────────────────────────────── */
  .hiq-error {
    font-size: 13px;
    color: #f87171;
    margin-top: -8px;
    margin-bottom: 10px;
  }

  /* ── Checkbox ─────────────────────────────────────────────── */
  .hiq-checkbox-row {
    display: flex;
    align-items: center;
    gap: 9px;
    font-size: 13px;
    color: #8a9bbf;
    margin-top: 4px;
    margin-bottom: 24px;
    cursor: pointer;
    user-select: none;
  }
  .hiq-checkbox-native {
    display: none;
  }
  .hiq-checkbox-box {
    width: 17px;
    height: 17px;
    min-width: 17px;
    border-radius: 5px;
    background: #1e2a42;
    border: 1px solid rgba(255,255,255,0.09);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s, border-color 0.15s;
    box-sizing: border-box;
  }
  .hiq-checkbox-box.hiq-checked {
    background: #5b7cf6;
    border-color: #5b7cf6;
  }

  /* ── Sign In Button ───────────────────────────────────────── */
  .hiq-btn {
    width: 100%;
    height: 50px;
    background: #5b7cf6;
    color: #fff;
    font-family: 'Sora', sans-serif;
    font-size: 15px;
    font-weight: 600;
    border: none;
    border-radius: 12px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 9px;
    transition: background 0.2s, box-shadow 0.2s, transform 0.15s;
  }
  .hiq-btn:hover:not(:disabled) {
    background: #4a6be8;
    box-shadow: 0 6px 22px rgba(91,124,246,0.32);
    transform: translateY(-1px);
  }
  .hiq-btn:hover:not(:disabled) .hiq-btn-arrow {
    transform: translateX(4px);
  }
  .hiq-btn:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
  .hiq-btn-arrow {
    display: flex;
    align-items: center;
    transition: transform 0.2s;
  }

  /* ── Card Footer ──────────────────────────────────────────── */
  .hiq-card-footer {
    margin-top: 20px;
    text-align: center;
    font-size: 13px;
    color: #566280;
  }
  .hiq-card-footer a {
    color: #5b7cf6;
    font-weight: 500;
    text-decoration: none;
  }
  .hiq-card-footer a:hover {
    text-decoration: underline;
  }

  /* ── Tagline (layer 2) ────────────────────────────────────── */
  .hiq-tagline {
    margin-top: 28px;
    font-size: 12px;
    color: #566280;
    letter-spacing: 0.3px;
    text-align: center;
    animation: hiqFadeUp 0.5s ease both;
    animation-delay: 160ms;
    position: relative;
    z-index: 2;
  }

  /* ── Card eyebrow ─────────────────────────────────────────── */
  .hiq-eyebrow {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: #5b7cf6;
    margin-bottom: 10px;
    margin-top: 0;
  }

  /* ── Animations ───────────────────────────────────────────── */
  @keyframes hiqFadeUp {
    from { opacity: 0; transform: translateY(16px); }
    to   { opacity: 1; transform: translateY(0); }
  }
`;

function Login({ API_BASE, onLoginSuccess }) {
  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [showPw, setShowPw]         = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');
  const [emailError, setEmailError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError('Invalid email');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await axios.post(
        `${API_BASE}/login`,
        new URLSearchParams({ username: email, password }),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );
      const accessToken = res.data?.access_token;
      if (!accessToken) throw new Error('No token returned');
      onLoginSuccess(accessToken, email);
      setPassword('');
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{CSS}</style>
      <div className="hiq-page">

        {/* ── Background rings ── */}
        {[580, 880, 1180].map(size => (
          <div key={size} className="hiq-ring" style={{ width: size, height: size }} />
        ))}

        {/* ── Accent dots ── */}
        <div className="hiq-dot" style={{ top: '22%', left:  '18%' }} />
        <div className="hiq-dot" style={{ top: '65%', left:  '12%' }} />
        <div className="hiq-dot" style={{ top: '30%', right: '15%' }} />
        <div className="hiq-dot" style={{ top: '72%', right: '22%' }} />

        {/* ── Hairlines ── */}
        <div className="hiq-line" style={{ top: '20%',    left:  '5%' }} />
        <div className="hiq-line" style={{ bottom: '22%', right: '8%' }} />

        {/* ── Brand ── */}
        <div className="hiq-brand">
          <div className="hiq-brand-mark">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <span className="hiq-brand-name">
            Hire<span className="hiq-brand-iq">IQ</span>
          </span>
        </div>

        {/* ── Card ── */}
        <div className="hiq-card">
          <div className="hiq-card-bar" />

          <div className="hiq-card-header">
            <p className="hiq-eyebrow">Hire smarter, move faster.</p>
            <h1 className="hiq-heading">Welcome <em>back</em></h1>
            <p className="hiq-subheading">Sign in to your recruiter dashboard</p>
          </div>

          <form className="hiq-form" onSubmit={handleSubmit} noValidate>

            {/* Email */}
            <div className="hiq-field">
              <label className="hiq-label" htmlFor="hiq-email">Email address</label>
              <div className="hiq-input-wrap">
                <span className="hiq-input-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="4" width="20" height="16" rx="2" />
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                  </svg>
                </span>
                <input
                  id="hiq-email"
                  className="hiq-input"
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setEmailError(''); }}
                  placeholder="you@company.com"
                  autoComplete="email"
                  required
                />
              </div>
              {emailError && <p className="hiq-error" style={{ marginTop: 6, marginBottom: 0 }}>{emailError}</p>}
            </div>

            {/* Password */}
            <div className="hiq-field">
              <label className="hiq-label" htmlFor="hiq-password">Password</label>
              <div className="hiq-input-wrap">
                <span className="hiq-input-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </span>
                <input
                  id="hiq-password"
                  className="hiq-input"
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="hiq-eye-btn"
                  onClick={() => setShowPw(p => !p)}
                  tabIndex={-1}
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                >
                  {showPw ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Inline error */}
            {error && <p className="hiq-error">{error}</p>}

            {/* Remember me */}
            <label className="hiq-checkbox-row">
              <input
                className="hiq-checkbox-native"
                type="checkbox"
                checked={rememberMe}
                onChange={e => setRememberMe(e.target.checked)}
              />
              <span className={`hiq-checkbox-box${rememberMe ? ' hiq-checked' : ''}`}>
                {rememberMe && (
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="1.5,6 5,9.5 10.5,3" />
                  </svg>
                )}
              </span>
              Keep me signed in
            </label>

            {/* Submit */}
            <button
              type="submit"
              className="hiq-btn"
              disabled={loading || !email || !password}
            >
              {loading ? (
                'Signing in…'
              ) : (
                <>
                  Sign in
                  <span className="hiq-btn-arrow">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14" />
                      <path d="m12 5 7 7-7 7" />
                    </svg>
                  </span>
                </>
              )}
            </button>

          </form>

          <div className="hiq-card-footer">
            Need access?{' '}
            <a href="mailto:admin@hireiq.com">Contact your admin</a>
          </div>
        </div>

        {/* ── Tagline ── */}
        <p className="hiq-tagline">Hire smarter, move faster. · HireIQ</p>

      </div>
    </>
  );
}

export default Login;
