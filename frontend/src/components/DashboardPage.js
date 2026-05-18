import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  CartesianGrid, Legend,
  PieChart, Pie,
} from 'recharts';

const PIPELINE_COLORS = {
  New: '#2563eb',
  Reviewed: '#3b82f6',
  'Interview Scheduled': '#f59e0b',
  'On Hold': '#8b5cf6',
  Rejected: '#ef4444',
  Hired: '#16a34a',
  Archived: '#9ca3af',
};

const SCORE_COLORS = {
  'High (71-100%)': '#16a34a',
  'Medium (41-70%)': '#f59e0b',
  'Low (0-40%)': '#ef4444',
};

function getScoreBadgeStyle(score) {
  if (score >= 71) return { background: '#dcfce7', color: '#16a34a' };
  if (score >= 41) return { background: '#fef3c7', color: '#d97706' };
  return { background: '#fee2e2', color: '#dc2626' };
}

function getStatusBadgeStyle(status) {
  const s = (status || '').toLowerCase();
  if (s === 'new') return { background: '#2563eb', color: '#ffffff' };
  if (s === 'reviewed') return { background: '#dbeafe', color: '#1d4ed8' };
  if (s === 'interview scheduled') return { background: '#fef3c7', color: '#d97706' };
  if (s === 'on hold') return { background: '#ede9fe', color: '#7c3aed' };
  if (s === 'rejected') return { background: '#fee2e2', color: '#dc2626' };
  if (s === 'hired') return { background: '#dcfce7', color: '#16a34a' };
  if (s === 'archived') return { background: '#f3f4f6', color: '#4b5563' };
  return { background: '#2563eb', color: '#ffffff' };
}

function formatTime(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const display = hour % 12 || 12;
  return `${display}:${m} ${ampm}`;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton({ width = '100%', height = 16, radius = 6, style = {} }) {
  return (
    <div style={{
      width, height, borderRadius: radius,
      background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)',
      backgroundSize: '200% 100%',
      animation: 'dash-shimmer 1.4s infinite',
      ...style,
    }} />
  );
}

// ── Position Filter Dropdown ──────────────────────────────────────────────────

function PositionFilter({ positions, selectedId, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef(null);
  const searchRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (isOpen && searchRef.current) searchRef.current.focus();
  }, [isOpen]);

  const filtered = positions.filter(p =>
    p.title.toLowerCase().includes(search.toLowerCase())
  );

  const selectedLabel = selectedId
    ? (positions.find(p => p.id === selectedId)?.title || 'All Positions')
    : 'All Positions';

  return (
    <div ref={containerRef} className="filter-dropdown" style={{ minWidth: 220 }}>
      <button
        type="button"
        className={`filter-dropdown-trigger${isOpen ? ' open' : ''}`}
        onClick={() => { setIsOpen(p => !p); setSearch(''); }}
      >
        <span className="filter-dropdown-value">{selectedLabel}</span>
        <span className="filter-dropdown-arrow">▾</span>
      </button>

      {isOpen && (
        <div className="filter-dropdown-menu" style={{ minWidth: 220 }}>
          <div className="filter-dropdown-search-wrap">
            <input
              ref={searchRef}
              type="text"
              className="filter-dropdown-search-input"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search positions..."
              onClick={e => e.stopPropagation()}
            />
          </div>
          <div className="filter-dropdown-list">
            <div
              className={`filter-dropdown-option${!selectedId ? ' selected' : ''}`}
              onClick={() => { onChange(null); setIsOpen(false); setSearch(''); }}
            >
              All Positions
            </div>
            {filtered.length === 0 ? (
              <div className="filter-dropdown-empty">No results found</div>
            ) : filtered.map(p => (
              <div
                key={p.id}
                className={`filter-dropdown-option${selectedId === p.id ? ' selected' : ''}`}
                onClick={() => { onChange(p.id); setIsOpen(false); setSearch(''); }}
              >
                {p.title}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({ icon, label, value, color, loading }) {
  return (
    <div className="dash-stat-card">
      <div className="dash-stat-icon" style={{ background: color + '20', color }}>
        {icon}
      </div>
      <div className="dash-stat-body">
        {loading ? (
          <>
            <Skeleton height={32} width={80} style={{ marginBottom: 6 }} />
            <Skeleton height={13} width={100} />
          </>
        ) : (
          <>
            <div className="dash-stat-value">{value}</div>
            <div className="dash-stat-label">{label}</div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Section Card wrapper ───────────────────────────────────────────────────────

function SectionCard({ title, children, style = {} }) {
  return (
    <div className="dash-section-card" style={style}>
      <div className="dash-section-title">{title}</div>
      {children}
    </div>
  );
}

// ── Pipeline Bar Chart ────────────────────────────────────────────────────────

function PipelineChart({ data, loading }) {
  if (loading) {
    return (
      <div style={{ padding: '8px 0' }}>
        {[...Array(6)].map((_, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <Skeleton width={120} height={13} />
            <Skeleton width={`${20 + Math.random() * 60}%`} height={24} radius={4} />
            <Skeleton width={28} height={13} />
          </div>
        ))}
      </div>
    );
  }

  const chartData = [
    { name: 'New', count: data.new },
    { name: 'Reviewed', count: data.reviewed },
    { name: 'Interview Scheduled', count: data.interview_scheduled },
    { name: 'On Hold', count: data.on_hold },
    { name: 'Rejected', count: data.rejected },
    { name: 'Hired', count: data.hired },
    { name: 'Archived', count: data.archived },
  ]
    .filter(d => d.count > 0)
    .sort((a, b) => b.count - a.count);

  if (chartData.length === 0) {
    return <div className="dash-empty">No candidates in pipeline yet.</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 48, left: 20, bottom: 0 }}>
        <CartesianGrid vertical={true} horizontal={false} strokeDasharray="4 4" stroke="#e5e7eb" />
        <XAxis type="number" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: '#374151' }} width={130} axisLine={false} tickLine={false} />
        <Tooltip
          cursor={{ fill: '#f1f5f9' }}
          contentStyle={{ border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13 }}
          formatter={(value) => [value, 'Candidates']}
        />
        <Bar dataKey="count" barSize={28} radius={[0, 4, 4, 0]} label={{ position: 'right', fontSize: 12, fill: '#6b7280' }}>
          {chartData.map((entry) => (
            <Cell key={entry.name} fill={PIPELINE_COLORS[entry.name] || '#6b7280'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Score Donut Chart ─────────────────────────────────────────────────────────

function ScoreDonut({ data, loading }) {
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <Skeleton width={160} height={160} radius={80} />
        <Skeleton width={120} height={13} />
        <Skeleton width={100} height={13} />
      </div>
    );
  }

  const total = (data['0_40'] || 0) + (data['41_70'] || 0) + (data['71_100'] || 0);
  if (total === 0) {
    return <div className="dash-empty">No score data yet.</div>;
  }

  const chartData = [
    { name: 'High (71-100%)', value: data['71_100'] || 0 },
    { name: 'Medium (41-70%)', value: data['41_70'] || 0 },
    { name: 'Low (0-40%)', value: data['0_40'] || 0 },
  ].filter(d => d.value > 0);

  const RADIAN = Math.PI / 180;

  const renderCalloutLabel = ({ cx, cy, midAngle, outerRadius, value, name, percent }) => {
    if (percent === 0) return null;
    const sin = Math.sin(-RADIAN * midAngle);
    const cos = Math.cos(-RADIAN * midAngle);
    const sx = cx + (outerRadius + 4) * cos;
    const sy = cy + (outerRadius + 4) * sin;
    const mx = cx + (outerRadius + 24) * cos;
    const my = cy + (outerRadius + 24) * sin;
    const ex = mx + (cos >= 0 ? 1 : -1) * 18;
    const ey = my;
    const textAnchor = cos >= 0 ? 'start' : 'end';
    return (
      <g>
        <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`} stroke={SCORE_COLORS[name]} fill="none" strokeWidth={1.5} />
        <circle cx={ex} cy={ey} r={2} fill={SCORE_COLORS[name]} stroke="none" />
        <text
          x={ex + (cos >= 0 ? 4 : -4)}
          y={ey}
          textAnchor={textAnchor}
          fill="#374151"
          fontSize={11}
          dominantBaseline="central"
        >
          {`${value} (${Math.round(percent * 100)}%)`}
        </text>
      </g>
    );
  };

  const renderLegend = ({ payload }) => (
    <div style={{ display: 'flex', justifyContent: 'center', gap: 14, marginTop: 4, flexWrap: 'wrap' }}>
      {(payload || []).map((entry) => (
        <div key={entry.value} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: entry.color, flexShrink: 0 }} />
          <span style={{ color: '#374151' }}>{entry.value}</span>
        </div>
      ))}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <ResponsiveContainer width="100%" height={360}>
        <PieChart margin={{ top: 20, right: 70, bottom: 0, left: 70 }}>
          <Pie
            data={chartData}
            cx="50%"
            cy="47%"
            innerRadius={65}
            outerRadius={110}
            paddingAngle={2}
            dataKey="value"
            labelLine={false}
            label={renderCalloutLabel}
          >
            {chartData.map((entry) => (
              <Cell key={entry.name} fill={SCORE_COLORS[entry.name]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13 }}
            formatter={(value) => [value, 'Candidates']}
          />
          <Legend content={renderLegend} verticalAlign="bottom" align="center" />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Positions Table ───────────────────────────────────────────────────────────

function PositionsTable({ data, loading, onNavigate }) {
  if (loading) {
    return (
      <div>
        <Skeleton height={36} style={{ marginBottom: 4 }} />
        {[...Array(5)].map((_, i) => <Skeleton key={i} height={44} style={{ marginBottom: 4 }} />)}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return <div className="dash-empty">No positions found.</div>;
  }

  const rows = data.slice(0, 6);

  return (
    <>
      <table className="dash-table">
        <thead>
          <tr>
            <th>Position</th>
            <th style={{ textAlign: 'center' }}>Applicants</th>
            <th style={{ textAlign: 'center' }}>Avg Score</th>
            <th style={{ textAlign: 'center' }}>Interviewing</th>
            <th style={{ textAlign: 'center' }}>Hired</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(pos => (
            <tr key={pos.id} className="dash-table-row">
              <td>
                <div style={{ fontWeight: 500, color: '#111827', fontSize: 13 }}>{pos.title}</div>
                <div style={{ fontSize: 12, color: pos.status === 'open' ? '#16a34a' : '#9ca3af', textTransform: 'capitalize' }}>
                  {pos.status}
                </div>
              </td>
              <td style={{ textAlign: 'center', color: '#374151', fontSize: 13 }}>{pos.total_applicants}</td>
              <td style={{ textAlign: 'center' }}>
                {pos.avg_score > 0 ? (
                  <span className="dash-score-badge" style={getScoreBadgeStyle(pos.avg_score)}>
                    {pos.avg_score}%
                  </span>
                ) : <span style={{ color: '#9ca3af', fontSize: 13 }}>—</span>}
              </td>
              <td style={{ textAlign: 'center', color: '#374151', fontSize: 13 }}>{pos.shortlisted}</td>
              <td style={{ textAlign: 'center', color: '#374151', fontSize: 13 }}>{pos.hired}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {data.length > 6 && (
        <button className="dash-view-all" onClick={() => onNavigate('positions')}>
          View all {data.length} positions →
        </button>
      )}
    </>
  );
}

// ── Upcoming Interviews ───────────────────────────────────────────────────────

function UpcomingInterviews({ data, loading }) {
  if (loading) {
    return (
      <div>
        {[...Array(4)].map((_, i) => (
          <div key={i} style={{ padding: '12px 0', borderBottom: '1px solid #f1f5f9' }}>
            <Skeleton height={14} width="60%" style={{ marginBottom: 6 }} />
            <Skeleton height={12} width="40%" />
          </div>
        ))}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return <div className="dash-empty">No upcoming interviews scheduled.</div>;
  }

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
      {data.map((iv, idx) => (
        <div key={iv.id} style={{
          padding: '12px 0',
          borderBottom: idx < data.length - 1 ? '1px solid #f1f5f9' : 'none',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 12,
        }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: '#111827', marginBottom: 2 }}>
              {iv.candidate_name}
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{iv.position}</div>
            {iv.google_meet_link && (
              <a
                href={iv.google_meet_link}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: 12, color: '#2563eb', textDecoration: 'none', fontWeight: 500 }}
              >
                Join Meet →
              </a>
            )}
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#374151' }}>{formatDate(iv.interview_date)}</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{formatTime(iv.interview_time)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Top Candidates (hidden — code preserved) ──────────────────────────────────

function TopCandidates({ data, loading, onViewCandidate }) {
  if (loading) {
    return (
      <div style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 4 }}>
        {[...Array(5)].map((_, i) => (
          <div key={i} style={{ minWidth: 200, border: '1px solid #e5e7eb', borderRadius: 12, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <Skeleton width={40} height={40} radius={20} />
              <div style={{ flex: 1 }}>
                <Skeleton height={14} width="80%" style={{ marginBottom: 6 }} />
                <Skeleton height={12} width="60%" />
              </div>
            </div>
            <Skeleton height={24} width={60} />
          </div>
        ))}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return <div className="dash-empty">No candidate scores available yet.</div>;
  }

  return (
    <div style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 4 }}>
      {data.map(c => (
        <div key={c.candidate_id} className="dash-candidate-card">
          <div className="dash-candidate-avatar">
            {(c.name || '?')[0].toUpperCase()}
          </div>
          <div style={{ fontWeight: 600, fontSize: 14, color: '#111827', marginBottom: 2 }}>{c.name}</div>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 10 }}>{c.position}</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span className="dash-score-badge" style={getScoreBadgeStyle(c.score)}>{c.score}%</span>
            <span className="dash-score-badge" style={{ ...getStatusBadgeStyle(c.status), fontSize: 11 }}>{c.status}</span>
          </div>
          <button
            className="dash-view-profile-btn"
            onClick={() => onViewCandidate(c.candidate_id, c.name)}
          >
            View Profile
          </button>
        </div>
      ))}
    </div>
  );
}

// ── Main DashboardPage ────────────────────────────────────────────────────────

const SHOW_TOP_CANDIDATES = false;

function DashboardPage({ API_BASE, token }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPositionId, setSelectedPositionId] = useState(null);
  const [allPositions, setAllPositions] = useState([]);

  const fetchStats = useCallback(async (posId) => {
    setLoading(true);
    setError(null);
    try {
      const url = posId
        ? `${API_BASE}/dashboard/stats?position_id=${posId}`
        : `${API_BASE}/dashboard/stats`;
      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setStats(res.data);
      // Populate dropdown list only on unfiltered fetch
      if (!posId && res.data.positions) {
        setAllPositions(res.data.positions);
      }
    } catch {
      setError('Failed to load dashboard data. Please refresh.');
    } finally {
      setLoading(false);
    }
  }, [API_BASE, token]);

  useEffect(() => { fetchStats(selectedPositionId); }, [selectedPositionId, fetchStats]);

  const handleNavigate = (page) => {
    window.dispatchEvent(new CustomEvent('navigate', { detail: page }));
  };

  const handleViewCandidate = (candidateId, candidateName) => {
    const params = new URLSearchParams();
    params.set('search', candidateName);
    params.set('openCandidate', String(candidateId));
    window.history.pushState({}, '', `?${params.toString()}`);
    window.dispatchEvent(new CustomEvent('navigate', { detail: 'applicants' }));
  };

  const ov = stats?.overview || {};
  const pipe = stats?.pipeline || {};
  const scoreAnalytics = stats?.score_analytics || {};

  return (
    <div className="dash-page">
      <style>{`
        @keyframes dash-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>

      {error && (
        <div className="dash-error-banner">{error}</div>
      )}

      {/* Header row: title + position filter */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 8 }}>
        <h1 className="dash-title" style={{ marginBottom: 0 }}>Dashboard</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, color: '#6b7280', fontWeight: 500 }}>Filter by Position:</span>
          <PositionFilter
            positions={allPositions}
            selectedId={selectedPositionId}
            onChange={(id) => setSelectedPositionId(id)}
          />
        </div>
      </div>

      {/* Row 1: Overview Cards */}
      <div className="dash-stats-row">
        <StatCard icon="👥" label="Total Candidates" value={ov.total_candidates ?? 0} color="#2563eb" loading={loading} />
        <StatCard icon="📋" label="Active Positions" value={ov.active_positions ?? 0} color="#7c3aed" loading={loading} />
        <StatCard icon="⏸" label="On Hold Positions" value={ov.on_hold_positions ?? 0} color="#d97706" loading={loading} />
        <StatCard icon="🗓" label="Upcoming Interviews" value={ov.total_interviews ?? 0} color="#0891b2" loading={loading} />
        <StatCard icon="⭐" label="Avg Match Score" value={loading ? 0 : `${ov.avg_match_score ?? 0}%`} color="#16a34a" loading={loading} />
      </div>

      {/* Row 2: Pipeline + Score Distribution */}
      <div className="dash-two-col" style={{ '--left': '60%', '--right': '40%' }}>
        <SectionCard title="Candidate Pipeline">
          <PipelineChart data={pipe} loading={loading} />
        </SectionCard>
        <SectionCard title="Score Distribution">
          <ScoreDonut data={scoreAnalytics.score_distribution || {}} loading={loading} />
        </SectionCard>
      </div>

      {/* Row 3: Positions Table + Upcoming Interviews */}
      <div className="dash-two-col" style={{ '--left': '60%', '--right': '40%' }}>
        <SectionCard title="Positions Overview">
          <PositionsTable data={stats?.positions} loading={loading} onNavigate={handleNavigate} />
        </SectionCard>
        <SectionCard title="Upcoming Interviews">
          <UpcomingInterviews data={stats?.interviews?.upcoming} loading={loading} />
        </SectionCard>
      </div>

      {/* Row 4: Top Candidates — hidden */}
      {SHOW_TOP_CANDIDATES && (
        <SectionCard title="Top Candidates by Match Score">
          <TopCandidates
            data={scoreAnalytics.high_scorers}
            loading={loading}
            onViewCandidate={handleViewCandidate}
          />
        </SectionCard>
      )}
    </div>
  );
}

export default DashboardPage;
