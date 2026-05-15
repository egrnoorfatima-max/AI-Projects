import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

export default function SettingsPage({ API_BASE, token }) {
  const [googleConnected, setGoogleConnected] = useState(false);
  const [checking, setChecking] = useState(true);
  const [toast, setToast] = useState(null);

  const checkStatus = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE}/auth/google/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setGoogleConnected(res.data.connected);
    } catch {
      setGoogleConnected(false);
    } finally {
      setChecking(false);
    }
  }, [API_BASE, token]);

  useEffect(() => { checkStatus(); }, [checkStatus]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const handleConnect = () => {
    const popup = window.open(
      `${API_BASE}/auth/google`,
      'google_oauth',
      'width=520,height=660,scrollbars=yes,resizable=yes'
    );

    const onMessage = (e) => {
      if (e.data === 'google_connected') {
        window.removeEventListener('message', onMessage);
        setGoogleConnected(true);
        setToast({ type: 'success', message: 'Google Calendar connected successfully!' });
      }
    };
    window.addEventListener('message', onMessage);

    // Fallback: re-check when popup closes
    const poll = setInterval(() => {
      if (!popup || popup.closed) {
        clearInterval(poll);
        window.removeEventListener('message', onMessage);
        checkStatus();
      }
    }, 800);
  };

  const handleDisconnect = async () => {
    try {
      await axios.delete(`${API_BASE}/auth/google/disconnect`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setGoogleConnected(false);
      setToast({ type: 'success', message: 'Google Calendar disconnected.' });
    } catch {
      setToast({ type: 'error', message: 'Failed to disconnect. Please try again.' });
    }
  };

  return (
    <div className="settings-page">
      {toast && <div className={`toast ${toast.type}`}>{toast.message}</div>}

      <div className="settings-card">
        <h1 className="settings-title">Settings</h1>

        <div className="settings-section">
          <h2 className="settings-section-title">Integrations</h2>

          <div className="settings-item">
            <div className="settings-item-left">
              <div className="settings-item-icon">📅</div>
              <div className="settings-item-info">
                <div className="settings-item-title">Google Calendar &amp; Meet</div>
                <div className="settings-item-desc">
                  Connect your Google account to schedule interviews and automatically generate Google Meet links.
                  Calendar invites are sent to both the interviewer and candidate.
                </div>
              </div>
            </div>
            <div className="settings-item-action">
              {checking ? (
                <span className="settings-status-checking">Checking…</span>
              ) : googleConnected ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span className="settings-status-connected">✓ Connected</span>
                  <button className="btn btn-secondary" onClick={handleDisconnect}>
                    Disconnect
                  </button>
                </div>
              ) : (
                <button className="btn btn-primary" onClick={handleConnect}>
                  Connect Google Calendar
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
