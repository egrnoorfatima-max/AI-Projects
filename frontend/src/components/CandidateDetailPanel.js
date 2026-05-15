import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

export default function CandidateDetailPanel({ candidate, onClose, API_BASE, token, onScheduleInterview }) {
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

  const handleReschedule = async (interviewId) => {
    if (!rescheduleForm.interview_date || !rescheduleForm.interview_time) return;
    setActionLoading(true);
    const payload = {
      interview_date: rescheduleForm.interview_date,
      interview_time: rescheduleForm.interview_time,
    };
    console.log('Reschedule payload:', payload);
    try {
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

  return (
    <div className="detail-panel">

        {/* Candidate header */}
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
          {onScheduleInterview && (
            <button
              className="btn btn-primary"
              style={{ marginTop: '14px', width: '100%' }}
              onClick={() => onScheduleInterview(candidate)}
            >
              Schedule Interview
            </button>
          )}
        </div>

        {/* Scrollable body */}
        <div className="detail-panel-content">

          {/* Current Application */}
          <div className="detail-section">
            <h3>Current Application</h3>

            {candidate.latest_match ? (
              <>
                {/* Compact header row */}
                <ApplicationHeader
                  positionTitle={candidate.latest_match.position_title}
                  score={candidate.latest_match.overall_score}
                  status={candidate.latest_match.status}
                  matchedAt={candidate.latest_match.matched_at}
                  showResume={!!candidate.s3_key}
                  onViewResume={handleViewResume}
                />

                {candidate.latest_match.comments && (
                  <p style={{ fontSize: '13px', color: '#6b7280', fontStyle: 'italic', margin: '8px 0 0', lineHeight: '1.5' }}>
                    {candidate.latest_match.comments}
                  </p>
                )}

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

          {/* Interviews */}
          <div className="detail-section">
            <h3>Interviews</h3>

            {loadingInterviews ? (
              <p style={{ color: '#9ca3af', fontSize: '14px' }}>Loading interviews…</p>
            ) : interviews.length === 0 ? (
              <p style={{ color: '#9ca3af', fontSize: '14px' }}>No interviews scheduled yet.</p>
            ) : (
              <div className="interview-list">
                {interviews.map((iv) => (
                  <div key={iv.id} className={`interview-card interview-card-${iv.status}`}>
                    <div className="interview-card-top">
                      <div className="interview-card-meta">
                        <span className={`interview-type-badge interview-type-${iv.interview_type}`}>
                          {iv.interview_type === 'video' ? 'Video' : iv.interview_type === 'phone' ? 'Phone' : 'Onsite'}
                        </span>
                        <span className={`interview-status-badge interview-status-${iv.status}`}>
                          {iv.status.charAt(0).toUpperCase() + iv.status.slice(1)}
                        </span>
                      </div>
                      <div className="interview-card-datetime">
                        <strong>{formatDate(iv.interview_date)}</strong>
                        {' at '}
                        <strong>{formatTime(iv.interview_time)}</strong>
                        <span style={{ color: '#94a3b8', marginLeft: '6px' }}>({iv.duration_minutes} min)</span>
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                        Interviewer: {iv.interviewer_email}
                      </div>
                    </div>

                    {iv.google_meet_link && iv.status !== 'cancelled' && (
                      <a
                        href={iv.google_meet_link}
                        target="_blank"
                        rel="noreferrer"
                        className="interview-meet-link-inline"
                      >
                        Join Google Meet →
                      </a>
                    )}

                    {/* Reschedule inline form */}
                    {reschedulingId === iv.id ? (
                      <div className="interview-reschedule-form">
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
                          style={{ padding: '5px 12px', fontSize: '0.8rem' }}
                          onClick={() => handleReschedule(iv.id)}
                          disabled={actionLoading}
                        >
                          Confirm
                        </button>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '5px 10px', fontSize: '0.8rem' }}
                          onClick={() => setReschedulingId(null)}
                          disabled={actionLoading}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : iv.status !== 'cancelled' && (
                      <div className="interview-card-actions">
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                          onClick={() => {
                            setReschedulingId(iv.id);
                            setRescheduleForm({ interview_date: iv.interview_date, interview_time: iv.interview_time });
                          }}
                          disabled={actionLoading}
                        >
                          Reschedule
                        </button>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '4px 10px', fontSize: '0.8rem', color: '#dc2626' }}
                          onClick={() => handleCancel(iv.id)}
                          disabled={actionLoading}
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Application History */}
          <div className="detail-section">
            <h3>Previous Applications</h3>

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
                          className="btn btn-secondary"
                          style={{ padding: '4px 10px', fontSize: '12px' }}
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

function ApplicationHeader({ positionTitle, score, status, matchedAt, showResume, onViewResume }) {
  return (
    <div>
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

      {/* Score Breakdown */}
      {matchData.score_breakdown && (
        <div className="score-breakdown-list">
          {Object.entries(matchData.score_breakdown).map(([key, value]) => (
            <div key={key} className="score-breakdown-item">
              <div className="score-breakdown-label">
                <span>{key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</span>
                <span>{value}%</span>
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

      {/* Skills — side by side */}
      {(matchData.matching_skills?.length > 0 || matchData.missing_skills?.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px' }}>
          <div>
            <div style={{ fontWeight: '600', fontSize: '13px', color: '#374151', marginBottom: '8px' }}>
              Matching Skills
            </div>
            <div className="skills-grid">
              {(matchData.matching_skills || []).map(s => (
                <span key={s} className="skill-badge-match">{s}</span>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontWeight: '600', fontSize: '13px', color: '#374151', marginBottom: '8px' }}>
              Missing Skills
            </div>
            <div className="skills-grid">
              {(matchData.missing_skills || []).map(s => (
                <span key={s} className="skill-badge-missing">{s}</span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Strong Points & Red Flags — side by side */}
      {(matchData.strong_points?.length > 0 || matchData.red_flags?.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px' }}>
          <div>
            <div style={{ fontWeight: '700', fontSize: '13px', color: '#335c38', marginBottom: '6px' }}>
              Strong Points
            </div>
            <ul className="points-list">
              {(matchData.strong_points || []).map((pt, i) => <li key={i}>{pt}</li>)}
            </ul>
          </div>
          <div>
            <div style={{ fontWeight: '700', fontSize: '13px', color: '#dc2626', marginBottom: '6px' }}>
              Red Flags
            </div>
            <ul className="points-list">
              {(matchData.red_flags || []).map((f, i) => (
                <li key={i} style={{ color: '#374151' }}>{f}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Recommendation */}
      {matchData.hire_recommendation && (
        <div
          className={`recommendation-banner recommendation-${getRecommendationClass(matchData.hire_recommendation)}`}
          style={{ marginTop: '20px' }}
        >
          <strong>Recommendation: {matchData.hire_recommendation}</strong>
          {matchData.recommendation_reason && <p>{matchData.recommendation_reason}</p>}
        </div>
      )}

    </div>
  );
}

function getScoreClass(score) {
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

function getScoreColor(score) {
  if (score >= 70) return '#16a34a';
  if (score >= 40) return '#d97706';
  return '#dc2626';
}

function getStatusClass(status) {
  if (!status || status === 'New') return 'new';
  if (['Shortlisted', 'Interview Scheduled'].includes(status)) return 'green';
  if (['Rejected by Manager', 'Rejected by Org'].includes(status)) return 'red';
  return 'gray';
}

function getRecommendationClass(rec) {
  if (!rec) return 'gray';
  const r = rec.toLowerCase();
  if (r.includes('strong yes') || r === 'yes') return 'green';
  if (r.includes('maybe')) return 'yellow';
  return 'red';
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
