import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const INTERVIEW_BORDER = {
  scheduled: '#2563eb',
  rescheduled: '#2563eb',
  completed: '#16a34a',
  cancelled: '#dc2626',
};

const sectionHr = { border: 'none', borderTop: '1.5px solid #e5e7eb', margin: '24px 0 16px 0' };
const sectionTitle = { fontSize: '16px', fontWeight: '700', color: '#111827' };
const sectionHeader = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderLeft: '4px solid #2563eb', paddingLeft: '10px', marginBottom: '12px' };

export default function CandidateDetailPanel({ candidate, onClose, API_BASE, token, onScheduleInterview, onCandidateUpdated, refreshInterviewsToken }) {
  const [latestMatchDetails, setLatestMatchDetails] = useState(null);
  const [loadingMatch, setLoadingMatch] = useState(false);
  const [applications, setApplications] = useState([]);
  const [loadingApps, setLoadingApps] = useState(false);
  const [selectedHistoricalMatch, setSelectedHistoricalMatch] = useState(null);
  const [loadingHistorical, setLoadingHistorical] = useState(false);
  const [interviews, setInterviews] = useState([]);
  const [loadingInterviews, setLoadingInterviews] = useState(false);
  const [reschedulingId, setReschedulingId] = useState(null);
  const [rescheduleForm, setRescheduleForm] = useState({ interview_date: '', interview_time: '' });
  const [actionLoading, setActionLoading] = useState(false);
  const [showPastInterviews, setShowPastInterviews] = useState(false);
  const [hoveredCardId, setHoveredCardId] = useState(null);
  const [hoveredDetailsId, setHoveredDetailsId] = useState(null);

  const fetchMatchDetails = useCallback(async (matchId, setData, setLoading) => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/match-results/${matchId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setData(res.data);
    } catch (err) {
      console.error('Failed to fetch match details:', err);
    } finally {
      setLoading(false);
    }
  }, [API_BASE, token]);

  const fetchApplications = useCallback(async () => {
    setLoadingApps(true);
    try {
      const res = await axios.get(`${API_BASE}/candidates/${candidate.id}/applications`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setApplications((res.data.applications || []).slice(1));
    } catch (err) {
      console.error('Failed to fetch applications:', err);
    } finally {
      setLoadingApps(false);
    }
  }, [API_BASE, token, candidate.id]);

  const fetchInterviews = useCallback(async () => {
    setLoadingInterviews(true);
    try {
      const res = await axios.get(`${API_BASE}/interviews/candidate/${candidate.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setInterviews(res.data || []);
    } catch (err) {
      console.error('Failed to fetch interviews:', err);
    } finally {
      setLoadingInterviews(false);
    }
  }, [API_BASE, token, candidate.id]);

  useEffect(() => {
    if (candidate.latest_match?.id) {
      fetchMatchDetails(candidate.latest_match.id, setLatestMatchDetails, setLoadingMatch);
    }
    fetchApplications();
    fetchInterviews();
  }, [candidate.latest_match?.id, fetchMatchDetails, fetchApplications, fetchInterviews]);

  useEffect(() => {
    if (refreshInterviewsToken > 0) fetchInterviews();
  }, [refreshInterviewsToken, fetchInterviews]);

  const handleReschedule = async (interviewId) => {
    if (!rescheduleForm.interview_date || !rescheduleForm.interview_time) return;
    setActionLoading(true);
    const payload = {
      interview_date: rescheduleForm.interview_date,
      interview_time: rescheduleForm.interview_time,
    };
    console.log('Reschedule payload:', payload);
    try {
      console.log("Reschedule payload:", JSON.stringify(payload))
      await axios.patch(
        `${API_BASE}/interviews/${interviewId}/reschedule`,
        payload,
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
      );
      setReschedulingId(null);
      setRescheduleForm({ interview_date: '', interview_time: '' });
      fetchInterviews();
    } catch (err) {
      console.error('Reschedule failed:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async (interviewId) => {
    if (!window.confirm('Cancel this interview? The Google Calendar event will also be deleted.')) return;
    setActionLoading(true);
    try {
      await axios.patch(
        `${API_BASE}/interviews/${interviewId}/cancel`,
        {},
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
      );
      fetchInterviews();
      onCandidateUpdated && onCandidateUpdated();
    } catch (err) {
      console.error('Cancel failed:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleViewHistoricalDetails = (app) => {
    if (selectedHistoricalMatch?.id === app.match_id) {
      setSelectedHistoricalMatch(null);
      return;
    }
    fetchMatchDetails(app.match_id, setSelectedHistoricalMatch, setLoadingHistorical);
  };

  const handleViewResume = async () => {
    try {
      const res = await axios.get(`${API_BASE}/candidates/${candidate.id}/resume-url`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      window.open(res.data.url, '_blank');
    } catch (err) {
      console.error('Failed to get resume URL:', err);
    }
  };

  const activeInterviews = interviews.filter(iv => ['scheduled', 'rescheduled'].includes(iv.status));
  const pastInterviews = interviews.filter(iv => ['completed', 'cancelled'].includes(iv.status));

  return (
    <div className="detail-panel">

      {/* ── Candidate header ───────────────────────────────── */}
      <div className="detail-panel-header">
        <button className="detail-panel-close" onClick={onClose}>×</button>
        <div className="candidate-avatar-large">{candidate.name?.[0]?.toUpperCase()}</div>
        <div className="candidate-name-large">{candidate.name}</div>
        {(candidate.current_role || candidate.current_company) && (
          <div className="candidate-info-row">
            <span>{candidate.current_role}</span>
            {candidate.current_company && <span>@ {candidate.current_company}</span>}
          </div>
        )}
        {candidate.email && (
          <div className="candidate-info-row"><span>{candidate.email}</span></div>
        )}
        {(candidate.phone || candidate.location) && (
          <div className="candidate-info-row">
            {candidate.phone && <span>{candidate.phone}</span>}
            {candidate.location && <span>{candidate.location}</span>}
          </div>
        )}
        {candidate.total_years_experience != null && (
          <div className="candidate-info-row">
            <span>{candidate.total_years_experience} years experience</span>
          </div>
        )}
      </div>

      {/* ── Scrollable body ────────────────────────────────── */}
      <div className="detail-panel-content">

        {/* 1. Interviews */}
        <div className="detail-section">
          <hr style={{ ...sectionHr, marginTop: 0 }} />
          <div style={sectionHeader}>
            <span style={sectionTitle}>Interviews</span>
            {onScheduleInterview && (
              <button
                onClick={() => onScheduleInterview(candidate)}
                style={{
                  fontSize: '12px',
                  fontWeight: '500',
                  padding: '4px 10px',
                  border: '1px solid #3b82f6',
                  color: '#3b82f6',
                  background: 'transparent',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  lineHeight: '1.4',
                }}
              >
                + Schedule Interview
              </button>
            )}
          </div>

          {loadingInterviews ? (
            <p style={{ color: '#9ca3af', fontSize: '13px' }}>Loading…</p>
          ) : (
            <>
              {activeInterviews.length === 0 && pastInterviews.length === 0 && (
                <p style={{ color: '#9ca3af', fontSize: '13px' }}>No interviews scheduled yet.</p>
              )}

              {activeInterviews.map((iv) => (
                <div
                  key={iv.id}
                  onMouseEnter={() => setHoveredCardId(iv.id)}
                  onMouseLeave={() => setHoveredCardId(null)}
                  style={{
                    border: '1px solid #e5e7eb',
                    borderLeft: `4px solid ${INTERVIEW_BORDER[iv.status] || '#94a3b8'}`,
                    borderRadius: '8px',
                    padding: '14px 16px',
                    marginBottom: '10px',
                    background: hoveredCardId === iv.id ? '#f9fafb' : '#ffffff',
                    transition: 'background 0.15s',
                  }}
                >
                  <div style={{ fontSize: '15px', fontWeight: '600', color: '#111827', marginBottom: '5px' }}>
                    {formatDate(iv.interview_date)} · {formatTime(iv.interview_time)}
                    <span style={{ fontWeight: '400', fontSize: '13px', color: '#6b7280', marginLeft: '8px' }}>({iv.duration_minutes} min)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#6b7280' }}>
                    <span className={`interview-type-badge interview-type-${iv.interview_type}`}>
                      {iv.interview_type === 'video' ? 'Video' : iv.interview_type === 'phone' ? 'Phone' : 'Onsite'}
                    </span>
                    <span>{iv.interviewer_email}</span>
                  </div>

                  {iv.google_meet_link && (
                    <a
                      href={iv.google_meet_link}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        marginTop: '10px',
                        fontSize: '12px',
                        fontWeight: '500',
                        color: '#fff',
                        textDecoration: 'none',
                        padding: '4px 10px',
                        background: '#16a34a',
                        borderRadius: '6px',
                        border: 'none',
                      }}
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="#fff">
                        <path d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4z"/>
                      </svg>
                      Join Google Meet →
                    </a>
                  )}

                  {reschedulingId === iv.id ? (
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '10px', flexWrap: 'wrap' }}>
                      <input
                        type="date"
                        className="interview-reschedule-input"
                        min={new Date().toISOString().split('T')[0]}
                        value={rescheduleForm.interview_date}
                        onChange={(e) => setRescheduleForm((f) => ({ ...f, interview_date: e.target.value }))}
                      />
                      <input
                        type="time"
                        className="interview-reschedule-input"
                        value={rescheduleForm.interview_time}
                        onChange={(e) => setRescheduleForm((f) => ({ ...f, interview_time: e.target.value }))}
                      />
                      <button
                        className="btn btn-primary"
                        style={{ padding: '4px 10px', fontSize: '12px' }}
                        onClick={() => handleReschedule(iv.id)}
                        disabled={actionLoading}
                      >
                        Confirm
                      </button>
                      <button
                        style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: '13px', cursor: 'pointer', padding: '4px 0' }}
                        onClick={() => setReschedulingId(null)}
                        disabled={actionLoading}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '16px', marginTop: '10px' }}>
                      <button
                        style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '13px', cursor: 'pointer', padding: '0', fontWeight: '500' }}
                        onClick={() => {
                          setReschedulingId(iv.id);
                          setRescheduleForm({ interview_date: iv.interview_date, interview_time: iv.interview_time });
                        }}
                        disabled={actionLoading}
                      >
                        Reschedule
                      </button>
                      <button
                        style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: '13px', cursor: 'pointer', padding: '0', fontWeight: '500' }}
                        onClick={() => handleCancel(iv.id)}
                        disabled={actionLoading}
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              ))}

              {pastInterviews.length > 0 && (
                <div style={{ marginTop: activeInterviews.length > 0 ? '4px' : '0' }}>
                  <button
                    onClick={() => setShowPastInterviews(p => !p)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#94a3b8',
                      fontSize: '12px',
                      cursor: 'pointer',
                      padding: '2px 0',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    {showPastInterviews ? '▴' : '▾'} {pastInterviews.length} past interview{pastInterviews.length !== 1 ? 's' : ''}
                  </button>
                  {showPastInterviews && (
                    <div style={{ marginTop: '6px' }}>
                      {pastInterviews.map((iv) => (
                        <div
                          key={iv.id}
                          style={{
                            border: '1px solid #f1f5f9',
                            borderLeft: `3px solid ${INTERVIEW_BORDER[iv.status] || '#94a3b8'}`,
                            borderRadius: '0 6px 6px 0',
                            padding: '8px 12px',
                            marginBottom: '6px',
                            background: '#fafafa',
                            opacity: 0.6,
                          }}
                        >
                          <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '500' }}>
                            {formatDate(iv.interview_date)} · {formatTime(iv.interview_time)}
                            <span style={{
                              marginLeft: '8px',
                              color: iv.status === 'completed' ? '#16a34a' : '#ef4444',
                              textTransform: 'capitalize',
                            }}>
                              {iv.status}
                            </span>
                          </div>
                          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                            {iv.interview_type === 'video' ? 'Video' : iv.interview_type === 'phone' ? 'Phone' : 'Onsite'} · {iv.interviewer_email}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* 2. Current Application */}
        <div className="detail-section">
          <hr style={sectionHr} />
          <div style={sectionHeader}>
            <span style={sectionTitle}>Current Application</span>
          </div>

          {candidate.latest_match ? (
            <>
              <ApplicationHeader
                positionTitle={candidate.latest_match.position_title}
                score={candidate.latest_match.overall_score}
                status={candidate.latest_match.status}
                matchedAt={candidate.latest_match.matched_at}
                showResume={!!candidate.s3_key}
                onViewResume={handleViewResume}
              />

              {loadingMatch ? (
                <p style={{ color: '#9ca3af', fontSize: '14px', marginTop: '12px' }}>Loading details…</p>
              ) : latestMatchDetails && (
                <MatchDetails matchData={latestMatchDetails} />
              )}
            </>
          ) : (
            <p style={{ color: '#9ca3af', fontSize: '14px' }}>No match data yet.</p>
          )}
        </div>

        {/* 3. Previous Applications */}
        <div className="detail-section">
          <hr style={sectionHr} />
          <div style={sectionHeader}>
            <span style={sectionTitle}>Previous Applications</span>
          </div>

          {loadingApps ? (
            <p style={{ color: '#9ca3af', fontSize: '14px' }}>Loading history…</p>
          ) : selectedHistoricalMatch ? (
            <div>
              <button
                className="btn btn-secondary btn-back-history"
                onClick={() => setSelectedHistoricalMatch(null)}
                disabled={loadingHistorical}
              >
                ← Back to History
              </button>
              {loadingHistorical ? (
                <p style={{ color: '#9ca3af', fontSize: '14px' }}>Loading…</p>
              ) : (
                <>
                  <ApplicationHeader
                    positionTitle={selectedHistoricalMatch.position_title}
                    score={selectedHistoricalMatch.overall_score}
                    status={selectedHistoricalMatch.status}
                    matchedAt={selectedHistoricalMatch.matched_at}
                    showResume={false}
                  />
                  <MatchDetails matchData={selectedHistoricalMatch} />
                </>
              )}
            </div>
          ) : (
            <table className="history-table">
              <thead>
                <tr>
                  <th>Date Applied</th>
                  <th>Position</th>
                  <th>Score</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {applications.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="history-empty">No previous applications</td>
                  </tr>
                ) : applications.map(app => (
                  <tr key={app.match_id}>
                    <td>{new Date(app.matched_at).toLocaleDateString()}</td>
                    <td>{app.position_title || '—'}</td>
                    <td>
                      <span className={`score-badge score-${getScoreClass(app.overall_score)}`}>
                        {app.overall_score}%
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge status-${getStatusClass(app.status)}`}>
                        {app.status || 'New'}
                      </span>
                    </td>
                    <td>
                      <button
                        onMouseEnter={() => setHoveredDetailsId(app.match_id)}
                        onMouseLeave={() => setHoveredDetailsId(null)}
                        style={{
                          padding: '4px 10px',
                          fontSize: '12px',
                          border: `1px solid ${hoveredDetailsId === app.match_id ? '#2563eb' : '#d1d5db'}`,
                          borderRadius: '6px',
                          background: 'white',
                          color: hoveredDetailsId === app.match_id ? '#2563eb' : '#374151',
                          cursor: 'pointer',
                          transition: 'color 0.15s, border-color 0.15s',
                        }}
                        onClick={() => handleViewHistoricalDetails(app)}
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </div>
    </div>
  );
}

// ── Helper components ──────────────────────────────────────────────────────────

function ApplicationHeader({ positionTitle, score, status, matchedAt, showResume, onViewResume }) {
  return (
    <div style={{ background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '12px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <span style={{ fontWeight: '600', fontSize: '15px', color: '#1f2937' }}>
          {positionTitle || '—'}
        </span>
        <span className={`score-badge score-${getScoreClass(score)}`}>
          {score}%
        </span>
        <span className={`status-badge status-${getStatusClass(status)}`}>
          {status || 'New'}
        </span>
        {showResume && (
          <span
            onClick={onViewResume}
            style={{ fontSize: '13px', color: '#2563eb', cursor: 'pointer', textDecoration: 'none' }}
            onMouseEnter={e => e.target.style.textDecoration = 'underline'}
            onMouseLeave={e => e.target.style.textDecoration = 'none'}
          >
            View Resume →
          </span>
        )}
      </div>
      <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>
        Applied {new Date(matchedAt).toLocaleDateString()}
      </div>
    </div>
  );
}

function MatchDetails({ matchData }) {
  return (
    <div style={{ marginTop: '16px' }}>

      {matchData.score_breakdown && (
        <div className="score-breakdown-list">
          {Object.entries(matchData.score_breakdown).map(([key, value]) => (
            <div key={key} className="score-breakdown-item">
              <div className="score-breakdown-label">
                <span style={{ fontSize: '13px', fontWeight: '500', color: '#374151' }}>
                  {key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                </span>
                <span style={{ fontSize: '13px', fontWeight: '600', color: '#374151' }}>{value}%</span>
              </div>
              <div className="score-breakdown-bar">
                <div
                  className="score-breakdown-fill"
                  style={{ width: `${Math.min(Number(value), 100)}%`, background: getScoreColor(value) }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {(matchData.matching_skills?.length > 0 || matchData.missing_skills?.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px' }}>
          <div>
            <div style={{ fontWeight: '600', fontSize: '13px', color: '#374151', marginBottom: '8px' }}>Matching Skills</div>
            <div className="skills-grid">
              {(matchData.matching_skills || []).map(s => (
                <span key={s} className="skill-badge-match">{s}</span>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontWeight: '600', fontSize: '13px', color: '#374151', marginBottom: '8px' }}>Missing Skills</div>
            <div className="skills-grid">
              {(matchData.missing_skills || []).map(s => (
                <span key={s} className="skill-badge-missing">{s}</span>
              ))}
            </div>
          </div>
        </div>
      )}

      {(matchData.strong_points?.length > 0 || matchData.red_flags?.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px' }}>
          <div>
            <div style={{ fontWeight: '700', fontSize: '13px', color: '#16a34a', marginBottom: '6px' }}>Strong Points</div>
            <div>
              {(matchData.strong_points || []).map((pt, i) => (
                <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', padding: '5px 0', borderBottom: '1px solid #f3f4f6', fontSize: '13px', color: '#374151' }}>
                  <span style={{ color: '#16a34a', fontSize: '14px', lineHeight: '1.4', flexShrink: 0 }}>●</span>
                  <span>{pt}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontWeight: '700', fontSize: '13px', color: '#dc2626', marginBottom: '6px' }}>Red Flags</div>
            <div>
              {(matchData.red_flags || []).map((f, i) => (
                <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', padding: '5px 0', borderBottom: '1px solid #f3f4f6', fontSize: '13px', color: '#374151' }}>
                  <span style={{ color: '#dc2626', fontSize: '14px', lineHeight: '1.4', flexShrink: 0 }}>●</span>
                  <span>{f}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {matchData.hire_recommendation && (
        <div style={{
          marginTop: '20px',
          background: '#fffbeb',
          border: '1px solid #fde68a',
          borderLeft: '4px solid #f59e0b',
          borderRadius: '8px',
          padding: '12px 16px',
        }}>
          <div style={{ fontSize: '12px', fontWeight: '700', color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
            Recommendation
          </div>
          <div style={{ fontSize: '13px', fontWeight: '600', color: '#78350f' }}>
            {matchData.hire_recommendation}
          </div>
          {matchData.recommendation_reason && (
            <p style={{ fontSize: '13px', color: '#78350f', margin: '6px 0 0', lineHeight: '1.5' }}>
              {matchData.recommendation_reason}
            </p>
          )}
        </div>
      )}

    </div>
  );
}

// ── Utilities ──────────────────────────────────────────────────────────────────

function getScoreClass(score) {
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

function getScoreColor(score) {
  if (score >= 70) return '#16a34a';
  if (score >= 40) return '#f59e0b';
  return '#dc2626';
}

function getStatusClass(status) {
  if (!status || status === 'New') return 'new';
  if (['Shortlisted', 'Interview Scheduled'].includes(status)) return 'green';
  if (['Rejected by Manager', 'Rejected by Org'].includes(status)) return 'red';
  return 'gray';
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });
}

function formatTime(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
}
