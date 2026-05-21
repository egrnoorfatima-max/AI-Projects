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

function formatTime(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });
}

function buildEmailPreview(form, candidate) {
  const positionTitle = candidate?.latest_match?.position_title || 'the position';
  const candidateName = candidate?.name || 'Candidate';
  const durationLabel = DURATIONS.find(d => d.value === form.duration_minutes)?.label || `${form.duration_minutes} minutes`;
  const typeLabel = INTERVIEW_TYPES.find(t => t.value === form.interview_type)?.label || form.interview_type;

  const customSuffix = form.custom_message?.trim()
    ? ` ${form.custom_message.trim()}`
    : '';

  const meetLine = form.interview_type === 'video'
    ? '\nJoin Google Meet: [meet link]'
    : '';

  return `Dear ${candidateName},

We are pleased to inform you that your interview has been scheduled for the ${positionTitle} position.${customSuffix}
Date: ${formatDate(form.interview_date)}  ${formatTime(form.interview_time)}
Duration: ${durationLabel}
Type: ${typeLabel}${meetLine}

Best regards,
Hiring Team`;
}

export default function ScheduleInterviewModal({
  candidate,
  API_BASE,
  token,
  onClose,
  onScheduled,
  onGoToSettings,
}) {
  const [googleConnected, setGoogleConnected] = useState(null);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    interviewer_email: '',
    candidate_email: candidate?.email || '',
    interview_date: '',
    interview_time: '',
    duration_minutes: 60,
    interview_type: 'video',
    notes: '',
    custom_message: '',
  });
  const [emailErrors, setEmailErrors] = useState({ interviewer_email: false, candidate_email: false });
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

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

  const handleNext = () => {
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
    const positionTitle = candidate?.latest_match?.position_title || 'the position';
    setEmailSubject(`Interview Scheduled — ${positionTitle}`);
    setEmailBody(buildEmailPreview(form, candidate));
    setStep(2);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const bodyHtml = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#111827;">${emailBody.replace(/\n/g, '<br>')}</div>`;
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
          custom_message: form.custom_message || null,
          email_subject: emailSubject,
          email_body: bodyHtml,
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

  const stepCircle = (num, active, done) => ({
    width: 22, height: 22, borderRadius: '50%',
    background: done ? '#10b981' : active ? '#2563eb' : '#e2e8f0',
    color: (active || done) ? 'white' : '#94a3b8',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 11, fontWeight: 700, flexShrink: 0,
  });

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
            <>
              {/* Step indicator */}
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20, fontSize: '0.8rem', fontWeight: 600 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: step === 1 ? '#2563eb' : '#10b981' }}>
                  <span style={stepCircle(1, step === 1, step > 1)}>{step > 1 ? '✓' : '1'}</span>
                  Interview Details
                </div>
                <div style={{ flex: 1, height: 1, background: '#e2e8f0', margin: '0 10px' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: step === 2 ? '#2563eb' : '#94a3b8' }}>
                  <span style={stepCircle(2, step === 2, false)}>2</span>
                  Email Preview
                </div>
              </div>

              {step === 1 ? (
                /* ── Step 1: Interview Details ── */
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

                  <label style={labelStyle}>
                    Message to Candidate (optional)
                    <textarea
                      style={{ ...inputStyle, resize: 'vertical', minHeight: '64px' }}
                      value={form.custom_message}
                      onChange={(e) => set('custom_message', e.target.value)}
                      placeholder="Add any additional information for the candidate…"
                      rows={3}
                    />
                  </label>

                  {error && <div className="interview-error">{error}</div>}
                </div>
              ) : (
                /* ── Step 2: Email Preview ── */
                <div>
                  <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: 16 }}>
                    Review and edit the email before it is sent to the candidate.
                  </p>
                  <label style={labelStyle}>
                    Subject
                    <input
                      type="text"
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                      style={inputStyle}
                    />
                  </label>
                  <label style={labelStyle}>
                    Email Body
                    <textarea
                      value={emailBody}
                      onChange={(e) => setEmailBody(e.target.value)}
                      rows={12}
                      style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
                    />
                  </label>
                  {form.interview_type === 'video' && (
                    <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: -8, marginBottom: 0 }}>
                      <em>[meet link] will be replaced with the actual Google Meet link after scheduling.</em>
                    </p>
                  )}
                  {error && <div className="interview-error" style={{ marginTop: 12 }}>{error}</div>}
                </div>
              )}
            </>
          )}
        </div>

        <div className="modal-footer">
          {result ? (
            <button className="btn btn-primary" onClick={onClose}>Done</button>
          ) : step === 1 ? (
            <>
              <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={handleNext}
                disabled={googleConnected === false || googleConnected === null}
              >
                Next →
              </button>
            </>
          ) : (
            <>
              <button className="btn btn-secondary" onClick={() => { setStep(1); setError(''); }}>← Back</button>
              <button
                className="btn btn-primary"
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting
                  ? <><span className="spinner"></span> Scheduling…</>
                  : 'Schedule & Send Email'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
