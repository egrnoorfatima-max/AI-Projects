import React, { useState, useEffect } from 'react';
import axios from 'axios';

const TODAY = new Date().toISOString().split('T')[0];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const DURATIONS = [
  { value: 30, label: '30 minutes' },
  { value: 45, label: '45 minutes' },
  { value: 60, label: '1 hour' },
  { value: 90, label: '1.5 hours' },
];

const INTERVIEW_TYPES = [
  { value: 'video', label: 'Video — Google Meet' },
  { value: 'phone', label: 'Phone Call' },
  { value: 'onsite', label: 'Onsite' },
];

export default function ScheduleInterviewModal({
  candidate,
  API_BASE,
  token,
  onClose,
  onScheduled,
  onGoToSettings,
}) {
  const [googleConnected, setGoogleConnected] = useState(null); // null = checking
  const [form, setForm] = useState({
    interviewer_email: '',
    candidate_email: candidate?.email || '',
    interview_date: '',
    interview_time: '',
    duration_minutes: 60,
    interview_type: 'video',
    notes: '',
  });
  const [emailErrors, setEmailErrors] = useState({ interviewer_email: false, candidate_email: false });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null); // success state with meet link
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  // Check Google connection on mount
  useEffect(() => {
    axios
      .get(`${API_BASE}/auth/google/status`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setGoogleConnected(res.data.connected))
      .catch(() => setGoogleConnected(false));
  }, [API_BASE, token]);

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleEmailChange = (key, value) => {
    set(key, value);
    setEmailErrors((prev) => ({ ...prev, [key]: value.length > 0 && !EMAIL_RE.test(value) }));
  };

  const handleSubmit = async () => {
    const interviewerInvalid = !EMAIL_RE.test(form.interviewer_email);
    const candidateInvalid = !EMAIL_RE.test(form.candidate_email);
    if (interviewerInvalid || candidateInvalid) {
      setEmailErrors({ interviewer_email: interviewerInvalid, candidate_email: candidateInvalid });
      return;
    }
    if (!form.interview_date || !form.interview_time) {
      setError('Date and time are required.');
      return;
    }
    setEmailErrors({ interviewer_email: false, candidate_email: false });
    setError('');
    setSubmitting(true);
    try {
      const res = await axios.post(
        `${API_BASE}/interviews/schedule`,
        {
          candidate_id: candidate.id,
          position_id: candidate.latest_match?.position_id || null,
          interviewer_email: form.interviewer_email,
          candidate_email: form.candidate_email,
          interview_date: form.interview_date,
          interview_time: form.interview_time,
          duration_minutes: form.duration_minutes,
          interview_type: form.interview_type,
          notes: form.notes || null,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setResult(res.data);
      onScheduled && onScheduled();
    } catch (err) {
      const detail = err.response?.data?.detail || err.message;
      setError(detail);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(result.google_meet_link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const inputStyle = {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid #e2e8f0',
    borderRadius: '6px',
    fontSize: '0.9rem',
    fontFamily: 'inherit',
    marginTop: '4px',
    boxSizing: 'border-box',
  };

  const labelStyle = {
    display: 'block',
    marginBottom: '14px',
    fontSize: '0.875rem',
    fontWeight: '500',
    color: '#1e293b',
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
        <div className="modal-header">
          <h2>Schedule Interview — {candidate?.name}</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {/* Google not connected warning */}
          {googleConnected === false && (
            <div className="interview-no-google">
              <span>⚠️</span>
              <div>
                <strong>Google Calendar not connected.</strong>
                <p>
                  Connect your Google account in{' '}
                  <button className="link-btn" onClick={onGoToSettings}>Settings</button>{' '}
                  to schedule interviews and generate Meet links.
                </p>
              </div>
            </div>
          )}

          {/* Success state */}
          {result ? (
            <div className="interview-success">
              <div className="interview-success-icon">✓</div>
              <h3>Interview Scheduled!</h3>
              <p>
                <strong>{new Date(result.interview_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</strong>
                {' at '}
                <strong>{formatTime(result.interview_time)}</strong>
              </p>
              <p style={{ color: '#64748b', fontSize: '0.875rem', marginTop: '4px' }}>
                Calendar invites sent to {result.interviewer_email} and {result.candidate_email}.
              </p>

              {result.google_meet_link && (
                <div className="interview-meet-link-box">
                  <span className="interview-meet-label">Google Meet Link</span>
                  <div className="interview-meet-link-row">
                    <a href={result.google_meet_link} target="_blank" rel="noreferrer" className="interview-meet-link">
                      {result.google_meet_link}
                    </a>
                    <button className="btn btn-secondary" onClick={handleCopy} style={{ flexShrink: 0, fontSize: '0.8rem', padding: '6px 12px' }}>
                      {copied ? '✓ Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Form */
            <div style={{ opacity: googleConnected === false ? 0.45 : 1, pointerEvents: googleConnected === false ? 'none' : 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                <label style={labelStyle}>
                  <span style={{ display: 'flex', alignItems: 'center' }}>
                    Interviewer Email *
                    {emailErrors.interviewer_email && (
                      <span style={{ color: '#ef4444', fontSize: '12px', marginLeft: '8px', fontWeight: 400 }}>Invalid Email</span>
                    )}
                  </span>
                  <input
                    type="email"
                    style={{ ...inputStyle, border: emailErrors.interviewer_email ? '1px solid #ef4444' : '1px solid #e2e8f0' }}
                    value={form.interviewer_email}
                    onChange={(e) => handleEmailChange('interviewer_email', e.target.value)}
                    placeholder="recruiter@company.com"
                  />
                </label>
                <label style={labelStyle}>
                  <span style={{ display: 'flex', alignItems: 'center' }}>
                    Candidate Email *
                    {emailErrors.candidate_email && (
                      <span style={{ color: '#ef4444', fontSize: '12px', marginLeft: '8px', fontWeight: 400 }}>Invalid Email</span>
                    )}
                  </span>
                  <input
                    type="email"
                    style={{ ...inputStyle, border: emailErrors.candidate_email ? '1px solid #ef4444' : '1px solid #e2e8f0' }}
                    value={form.candidate_email}
                    onChange={(e) => handleEmailChange('candidate_email', e.target.value)}
                    placeholder="candidate@email.com"
                  />
                </label>
                <label style={labelStyle}>
                  Interview Date *
                  <input
                    type="date"
                    style={inputStyle}
                    min={TODAY}
                    value={form.interview_date}
                    onChange={(e) => set('interview_date', e.target.value)}
                  />
                </label>
                <label style={labelStyle}>
                  Interview Time *
                  <input
                    type="time"
                    style={inputStyle}
                    value={form.interview_time}
                    onChange={(e) => set('interview_time', e.target.value)}
                  />
                </label>
                <label style={labelStyle}>
                  Duration
                  <select
                    style={inputStyle}
                    value={form.duration_minutes}
                    onChange={(e) => set('duration_minutes', Number(e.target.value))}
                  >
                    {DURATIONS.map((d) => (
                      <option key={d.value} value={d.value}>{d.label}</option>
                    ))}
                  </select>
                </label>
                <label style={labelStyle}>
                  Interview Type
                  <select
                    style={inputStyle}
                    value={form.interview_type}
                    onChange={(e) => set('interview_type', e.target.value)}
                  >
                    {INTERVIEW_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </label>
              </div>

              <label style={labelStyle}>
                Notes for Interviewer
                <textarea
                  style={{ ...inputStyle, resize: 'vertical', minHeight: '72px' }}
                  value={form.notes}
                  onChange={(e) => set('notes', e.target.value)}
                  placeholder="Topics to cover, things to look for…"
                />
              </label>

              {error && <div className="interview-error">{error}</div>}
            </div>
          )}
        </div>

        <div className="modal-footer">
          {result ? (
            <button className="btn btn-primary" onClick={onClose}>Done</button>
          ) : (
            <>
              <button className="btn btn-secondary" onClick={onClose} disabled={submitting}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={handleSubmit}
                disabled={submitting || googleConnected === false || googleConnected === null}
              >
                {submitting ? (
                  <><span className="spinner"></span> Scheduling…</>
                ) : (
                  'Schedule Interview'
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function formatTime(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
}
