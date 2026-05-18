import React, { useState } from 'react';
import Login from './components/Login';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import ApplicantsPage from './components/ApplicantsPage';
import PositionsPage from './components/PositionsPage';
import SettingsPage from './components/SettingsPage';
import './App.css';

const API_BASE = "http://127.0.0.1:8000"
//"https://ai-projects-jj5i.onrender.com"
//"http://127.0.0.1:8000"

function isTokenExpired(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 < Date.now();
  } catch {
    return true; // unparseable token → treat as expired
  }
}

function getValidToken() {
  const stored = localStorage.getItem('token');
  if (!stored) return null;
  if (isTokenExpired(stored)) {
    localStorage.clear();
    return null;
  }
  return stored;
}

function App() {
  // Lazy initializer: validates + clears expired token before first render
  const [token, setToken] = useState(getValidToken);
  const [adminEmail, setAdminEmail] = useState(localStorage.getItem('adminEmail'));
  const [currentPage, setCurrentPage] = useState('applicants');
  const [error, setError] = useState('');

  const isLoggedIn = !!token;

  // Allow child components to navigate via custom event
  React.useEffect(() => {
    const handler = (e) => setCurrentPage(e.detail);
    window.addEventListener('navigate', handler);
    return () => window.removeEventListener('navigate', handler);
  }, []);

  const handleLoginSuccess = (newToken, email) => {
    setToken(newToken);
    setAdminEmail(email);
    localStorage.setItem('token', newToken);
    localStorage.setItem('adminEmail', email);
  };

  const handleLogout = () => {
    setToken(null);
    setAdminEmail(null);
    localStorage.clear();
    setCurrentPage('applicants');
  };

  if (!isLoggedIn) {
    return <Login API_BASE={API_BASE} onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="app-container">
      <Sidebar currentPage={currentPage} setCurrentPage={setCurrentPage} />
      <div className="main-content">
        <Header adminEmail={adminEmail} onLogout={handleLogout} />
        <div className="content">
          {error && <div className="error-banner">{error}</div>}
          {currentPage === 'applicants' && (
            <ApplicantsPage API_BASE={API_BASE} token={token} onError={setError} />
          )}
          {currentPage === 'positions' && (
            <PositionsPage API_BASE={API_BASE} token={token} onError={setError} />
          )}
          {currentPage === 'settings' && (
            <SettingsPage API_BASE={API_BASE} token={token} />
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
