import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import CandidateDetailPanel from './CandidateDetailPanel';

function ApplicantsPage({ API_BASE, token, onError }) {
  const [candidates, setCandidates] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedCandidateDetail, setSelectedCandidateDetail] = useState(null);
  const [uploadFile, setUploadFile] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [positions, setPositions] = useState([]);
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [toast, setToast] = useState(null);
  const [selectedMatchId, setSelectedMatchId] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [statusModal, setStatusModal] = useState(null);
  const [reEvaluateModal, setReEvaluateModal] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterPosition, setFilterPosition] = useState('All');
  const [filterAssignedTo, setFilterAssignedTo] = useState('All');


  const fetchPositions = useCallback(async () => {
    try {
      const response = await axios.get(`${API_BASE}/job-descriptions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setPositions(response.data || []);
    } catch (err) {
      console.error('Failed to load positions:', err);
    }
  }, [API_BASE, token]);


  function getScoreClass(score) {
    if (score >= 70) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
  }

  function getStatusClass(status) {
    if (!status || status === 'New') return 'new';
    if (status === 'Shortlisted' || status === 'Interview Scheduled') return 'green';
    if (status === 'Rejected by Manager' || status === 'Rejected by Org') return 'red';
    return 'gray';
  }

  const fetchCandidates = useCallback(async () => {
    try {
      const response = await axios.get(`${API_BASE}/candidates`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCandidates(response.data || []);
    } catch (err) {
      onError('Failed to load candidates: ' + (err.response?.data?.detail || err.message));
    }
  }, [API_BASE, token, onError]);

  useEffect(() => {
    fetchCandidates();
    fetchPositions();
  }, [fetchCandidates, fetchPositions]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  // Close dot menu on any document click
  useEffect(() => {
    const close = () => { setOpenMenuId(null); setMenuAnchor(null); };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);


  const handleUploadResume = async () => {
    if (!uploadFile || uploadFile.length === 0) {
      setToast({ type: 'error', message: 'Please select at least one file' });
      return;
    }
    if (!selectedPosition) {
      setToast({ type: 'error', message: 'Please select a position' });
      return;
    }

    const jdToMatch = selectedPosition;
    const filesToUpload = Array.from(uploadFile);

    setShowUploadModal(false);
    setUploadFile(null);
    setSelectedPosition(null);
    setProcessing(true);

    const results = { success: [], parseFailed: [], matchFailed: [] };

    for (const file of filesToUpload) {
      try {
        const formData = new FormData();
        formData.append('file', file);

        const parseResponse = await axios.post(`${API_BASE}/parse-resume`, formData, {
          headers: { 'Content-Type': 'multipart/form-data', Authorization: `Bearer ${token}` },
        });

        if (!parseResponse?.data?.id) throw new Error('Invalid parse response');

        try {
          await axios.post(`${API_BASE}/match-jd`, {
            candidate_id: parseResponse.data.id,
            jd_id: jdToMatch.id,
            resume_data: parseResponse.data,
            jd_text: jdToMatch.description,
          }, { headers: { Authorization: `Bearer ${token}` } });
          results.success.push(file.name);
        } catch (matchError) {
          console.error(`Match failed for ${file.name}:`, matchError);
          results.matchFailed.push({
            file: file.name,
            error: matchError.response?.data?.detail || matchError.message,
          });
        }
      } catch (parseError) {
        console.error(`Parse failed for ${file.name}:`, parseError);
        results.parseFailed.push({
          file: file.name,
          error: parseError.response?.data?.detail || parseError.message,
        });
      }
    }

    await fetchCandidates();
    setProcessing(false);

    if (results.success.length === filesToUpload.length) {
      setToast({ type: 'success', message: `Successfully uploaded ${results.success.length} resume(s)` });
    } else {
      const failedFiles = [
        ...results.parseFailed.map(f => `${f.file} (parse failed)`),
        ...results.matchFailed.map(f => `${f.file} (matching failed)`),
      ].join(', ');
      setToast({
        type: results.success.length > 0 ? 'warning' : 'error',
        message: `Uploaded ${results.success.length} of ${filesToUpload.length}. Failed: ${failedFiles}`,
      });
    }
  };

  const handleMenuOpen = (e, candidateId) => {
    e.stopPropagation();
    if (openMenuId === candidateId) {
      setOpenMenuId(null);
      setMenuAnchor(null);
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      setOpenMenuId(candidateId);
      setMenuAnchor({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    }
  };

  const handleStatusUpdate = async (status, comment) => {
    const matchId = statusModal.candidate.latest_match?.id;

    if (!matchId) {
      setToast({ type: 'error', message: 'No match found for this candidate' });
      setStatusModal(null);
      return;
    }

    setStatusModal(null);
    try {
      await axios.patch(
        `${API_BASE}/match-results/${matchId}/status`,
        { status, comment: comment || null },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setToast({ type: 'success', message: 'Status updated successfully' });
      await fetchCandidates();
    } catch (err) {
      setToast({ type: 'error', message: 'Failed to update status: ' + (err.response?.data?.detail || err.message) });
    }
  };

  const handleViewResume = async (candidateId) => {
    setOpenMenuId(null);
    setMenuAnchor(null);
    try {
      const response = await axios.get(
        `${API_BASE}/candidates/${candidateId}/resume-url`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      window.open(response.data.url, '_blank');
    } catch (err) {
      setToast({
        type: 'error',
        message: 'Failed to load resume: ' + (err.response?.data?.detail || err.message),
      });
    }
  };

  const handleReEvaluate = async (jdId) => {
    const candidate = reEvaluateModal.candidate;
    const jd = positions.find(p => p.id === jdId);
    const resumeData = {
      name: candidate.name,
      email: candidate.email,
      phone: candidate.phone,
      location: candidate.location,
      total_years_experience: candidate.total_years_experience,
      current_role: candidate.current_role,
      current_company: candidate.current_company,
      skills: candidate.skills,
      education: candidate.education,
      employment_history: candidate.employment_history,
    };
    try {
      await axios.post(
        `${API_BASE}/match-jd`,
        { candidate_id: candidate.id, jd_id: jdId, resume_data: resumeData, jd_text: jd.description },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (err) {
      setToast({ type: 'error', message: 'Re-evaluation failed: ' + (err.response?.data?.detail || err.message) });
      throw err;
    }

    // Match succeeded — reset status and leave an audit comment
    const statusComment = `Re-evaluated against ${jd.title} on ${new Date().toLocaleDateString()}`;
    try {
      await axios.patch(
        `${API_BASE}/candidates/${candidate.id}/status`,
        { status: 'New', comment: statusComment },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch {
      setToast({ type: 'error', message: 'Re-evaluation complete but status reset failed' });
    }

    setToast({ type: 'success', message: `Candidate re-evaluated successfully against ${jd.title}` });
    setReEvaluateModal(null);
    await fetchCandidates();
  };

  const positionMap = Object.fromEntries(positions.map(p => [p.id, p]));
  const uniquePositionTitles = [...new Set(candidates.map(c => c.latest_match?.position_title).filter(Boolean))];
  const uniqueAssignedTo = [...new Set(positions.map(p => p.assigned_to).filter(Boolean))];

  const filteredCandidates = candidates.filter((c) => {
    const search = searchTerm.toLowerCase();
    const matchesSearch = !searchTerm ||
      c.name?.toLowerCase().includes(search) ||
      c.email?.toLowerCase().includes(search);
    const matchesStatus = filterStatus === 'All' || (c.latest_match?.status || 'New') === filterStatus;
    const matchesPosition = filterPosition === 'All' || c.latest_match?.position_title === filterPosition;
    const pos = positionMap[c.latest_match?.position_id];
    const matchesAssignedTo = filterAssignedTo === 'All' || pos?.assigned_to === filterAssignedTo;
    return matchesSearch && matchesStatus && matchesPosition && matchesAssignedTo;
  });

  // Reset to page 1 whenever any filter or search changes
  useEffect(() => { setCurrentPage(1); }, [searchTerm, filterStatus, filterPosition, filterAssignedTo]);

  const totalPages = Math.ceil(filteredCandidates.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedCandidates = filteredCandidates.slice(startIndex, startIndex + itemsPerPage);

  const exportToExcel = () => {
    const exportData = filteredCandidates.map(c => ({
      'Name': c.name,
      'Email': c.email,
      'Phone': c.phone,
      'Location': c.location,
      'Current Role': c.current_role,
      'Current Company': c.current_company,
      'Experience (Years)': c.total_years_experience,
      'Position Applied': c.latest_match?.position_title || '-',
      'Overall Score': c.latest_match?.overall_score || '-',
      'Skills Match': c.latest_match?.score_breakdown?.skills_match || '-',
      'Experience Match': c.latest_match?.score_breakdown?.experience_match || '-',
      'Education Match': c.latest_match?.score_breakdown?.education_match || '-',
      'Hire Recommendation': c.latest_match?.hire_recommendation || '-',
      'Status': c.latest_match?.status || 'New',
      'Comments': c.latest_match?.comments || '-',
      'Uploaded Date': new Date(c.uploaded_at).toLocaleDateString(),
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Candidates');
    XLSX.writeFile(wb, `candidates_export_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="content">
      {toast && (
        <div className={`toast ${toast.type}`}>
          {toast.message}
        </div>
      )}

      {/* Fixed-position dot menu dropdown rendered outside table to avoid overflow clipping */}
      {openMenuId && menuAnchor && (
        <div className="dot-menu-dropdown" style={{ top: menuAnchor.top, right: menuAnchor.right }}>
          {candidates.find(c => c.id === openMenuId)?.s3_key && (
            <button onClick={() => handleViewResume(openMenuId)}>
              View Resume
            </button>
          )}
          <button
            onClick={() => {
              const candidate = candidates.find(c => c.id === openMenuId);
              setSelectedCandidateDetail(candidate);
              setOpenMenuId(null);
              setMenuAnchor(null);
            }}
          >
            View Details
          </button>
          <button
            onClick={() => {
              const candidate = candidates.find(c => c.id === openMenuId);
              setStatusModal({ candidate });
              setOpenMenuId(null);
              setMenuAnchor(null);
            }}
          >
            Change Status
          </button>
          <button
            onClick={() => {
              const candidate = candidates.find(c => c.id === openMenuId);
              setReEvaluateModal({ candidate });
              setOpenMenuId(null);
              setMenuAnchor(null);
            }}
          >
            Re-evaluate
          </button>
        </div>
      )}

      <div className={`page${selectedCandidateDetail ? ' with-panel' : ''}`}>
        <div className="page-header">
          <h1>Applicants ({filteredCandidates.length})</h1>
          <button
            className="btn btn-primary"
            onClick={() => {
              setShowUploadModal(true);
              fetchPositions();
            }}
            disabled={processing}
          >
            {processing ? (
              <>
                <span className="spinner"></span>
                Processing...
              </>
            ) : (
              'Upload New Resume'
            )}
          </button>
        </div>

        <div className="page-controls">
          <input
            type="text"
            placeholder="Search candidates..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="table-toolbar">
          <div className="filter-row">
            <div className="filter-group">
              <label>Status:</label>
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                <option value="All">All</option>
                {['New','Reviewed','Shortlisted','Interview Scheduled','On Hold','Rejected by Manager','Rejected by Org','Position Closed'].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="filter-group">
              <label>Position:</label>
              <select value={filterPosition} onChange={(e) => setFilterPosition(e.target.value)}>
                <option value="All">All</option>
                {uniquePositionTitles.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="filter-group">
              <label>Assigned To:</label>
              <select value={filterAssignedTo} onChange={(e) => setFilterAssignedTo(e.target.value)}>
                <option value="All">All</option>
                {uniqueAssignedTo.map(a => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
          </div>
          <button className="btn btn-excel" onClick={exportToExcel}>
            ↓ Export to Excel
          </button>
        </div>

        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}><input type="checkbox" /></th>
                <th style={{ width: '40px' }}>Photo</th>
                <th>Name</th>
                <th>Current Role</th>
                <th>Position</th>
                <th>Score</th>
                <th>Status</th>
                <th>Comments</th>
                <th>Email</th>
                <th>Location</th>
                <th>Applied</th>
                <th style={{ width: '50px' }}></th>
              </tr>
            </thead>
            <tbody>
              {paginatedCandidates.length === 0 ? (
                <tr>
                  <td colSpan="12" style={{ textAlign: 'center', padding: '20px' }}>
                    No applicants found
                  </td>
                </tr>
              ) : (
                paginatedCandidates.map((candidate) => (
                  <tr key={candidate.id} className="table-row">
                    <td><input type="checkbox" onClick={(e) => e.stopPropagation()} /></td>
                    <td>
                      <div className="avatar">{candidate.name?.[0]?.toUpperCase()}</div>
                    </td>
                    <td>
                      <span
                        className="candidate-name-link"
                        onClick={(e) => { e.stopPropagation(); setSelectedCandidateDetail(candidate); }}
                      >
                        {candidate.name}
                      </span>
                    </td>
                    <td>{candidate.current_role}</td>
                    <td className="text-muted">{candidate.latest_match?.position_title || '-'}</td>
                    <td>
                      {candidate.latest_match ? (
                        <span
                          className={`score-badge score-${getScoreClass(candidate.latest_match.overall_score)}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedMatchId(candidate.latest_match.id);
                          }}
                        >
                          {candidate.latest_match.overall_score}%
                        </span>
                      ) : (
                        <span className="text-muted">-</span>
                      )}
                    </td>
                    <td>
                      <span className={`status-badge status-${getStatusClass(candidate.latest_match?.status)}`}>
                        {candidate.latest_match?.status || 'New'}
                      </span>
                    </td>
                    <td
                      className="comment-cell"
                      title={candidate.latest_match?.comments || ''}
                      style={{
                        maxWidth: '200px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        cursor: candidate.latest_match?.comments ? 'help' : 'default',
                      }}
                    >
                      {candidate.latest_match?.comments || <span className="text-muted">-</span>}
                    </td>
                    <td>{candidate.email}</td>
                    <td>{candidate.location}</td>
                    <td>{new Date(candidate.uploaded_at).toLocaleDateString()}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <button
                        className="dot-menu-btn"
                        onClick={(e) => handleMenuOpen(e, candidate.id)}
                      >
                        ⋯
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="pagination-wrapper">
          <div className="pagination-left">
            <span className="pagination-info">
              Showing {filteredCandidates.length === 0 ? 0 : startIndex + 1}–{Math.min(startIndex + itemsPerPage, filteredCandidates.length)} of {filteredCandidates.length}
            </span>
          </div>
          <div className="pagination-right">
            <div className="per-page-selector">
              <label>Show:</label>
              <select
                value={itemsPerPage}
                onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
            <div className="pagination-controls">
              <button
                className="btn-page"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => p - 1)}
              >‹</button>
              {totalPages > 0 && getPageNumbers(currentPage, totalPages).map((p, i) =>
                p === '...'
                  ? <span key={`dots-${i}`} className="pagination-dots">…</span>
                  : <button
                      key={p}
                      className={`btn-page${currentPage === p ? ' active' : ''}`}
                      onClick={() => setCurrentPage(p)}
                    >{p}</button>
              )}
              <button
                className="btn-page"
                disabled={currentPage === totalPages || totalPages === 0}
                onClick={() => setCurrentPage(p => p + 1)}
              >›</button>
            </div>
          </div>
        </div>
      </div>

      {showUploadModal && (
        <UploadResumeModal
          onClose={() => {
            setShowUploadModal(false);
            setUploadFile(null);
            setSelectedPosition(null);
          }}
          onUpload={handleUploadResume}
          file={uploadFile}
          setFile={setUploadFile}
          positions={positions}
          selectedPosition={selectedPosition}
          setSelectedPosition={setSelectedPosition}
        />
      )}

      {selectedCandidateDetail && (
        <CandidateDetailPanel
          candidate={selectedCandidateDetail}
          onClose={() => setSelectedCandidateDetail(null)}
          API_BASE={API_BASE}
          token={token}
        />
      )}

      {selectedMatchId && (
        <MatchBreakdownModal
          matchId={selectedMatchId}
          onClose={() => setSelectedMatchId(null)}
          API_BASE={API_BASE}
          token={token}
        />
      )}

      {statusModal && (
        <StatusChangeModal
          candidate={statusModal.candidate}
          onClose={() => setStatusModal(null)}
          onSave={handleStatusUpdate}
        />
      )}

      {reEvaluateModal && (
        <ReEvaluateModal
          candidate={reEvaluateModal.candidate}
          positions={positions}
          onClose={() => setReEvaluateModal(null)}
          onEvaluate={handleReEvaluate}
        />
      )}
    </div>
  );
}

function getPageNumbers(currentPage, totalPages) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const pages = new Set([1, totalPages]);
  for (let i = Math.max(2, currentPage - 2); i <= Math.min(totalPages - 1, currentPage + 2); i++) {
    pages.add(i);
  }
  const sorted = Array.from(pages).sort((a, b) => a - b);
  const result = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) result.push('...');
    result.push(sorted[i]);
  }
  return result;
}

function capitalize(str) {
  return String(str).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function renderScorecard(scorecard) {
  if (!scorecard) return null;
  const rows = Array.isArray(scorecard)
    ? scorecard
    : Object.entries(scorecard).map(([k, v]) =>
        typeof v === 'object' && v !== null ? { criterion: k, ...v } : { criterion: k, value: v }
      );
  if (!rows.length) return null;
  const headers = Object.keys(rows[0]);
  return (
    <div className="match-section">
      <h3>Scorecard</h3>
      <table className="scorecard-table">
        <thead>
          <tr>{headers.map((h) => <th key={h}>{capitalize(h)}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {headers.map((h) => <td key={h}>{String(row[h] ?? '')}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusChangeModal({ candidate, onClose, onSave }) {
  const STATUS_OPTIONS = [
    'New',
    'Reviewed',
    'Shortlisted',
    'Interview Scheduled',
    'On Hold',
    'Rejected by Manager',
    'Rejected by Org',
    'Position Closed',
  ];
  const [status, setStatus] = useState(candidate.latest_match?.status || 'New');
  const [comment, setComment] = useState(candidate.latest_match?.comments || '');

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h2>Update Candidate Status — {candidate.name}</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600' }}>Status:</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.9rem' }}
            >
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600' }}>Comments:</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add comments..."
              rows={4}
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.9rem', resize: 'vertical' }}
            />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onSave(status, comment)}>Save</button>
        </div>
      </div>
    </div>
  );
}

function MatchBreakdownModal({ matchId, onClose, API_BASE, token }) {
  const [matchData, setMatchData] = useState(null);
  const [loading, setLoading] = useState(true);

  function getScoreClass(score) {
    if (score >= 70) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
  }

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get(`${API_BASE}/match-results/${matchId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setMatchData(response.data);
      } catch (err) {
        console.error('Failed to fetch match result:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [matchId, API_BASE, token]);

  const getRecommendationClass = (rec) => {
    if (!rec) return 'gray';
    const r = rec.toLowerCase();
    if (r.includes('strong yes') || r === 'yes') return 'green';
    if (r.includes('maybe')) return 'yellow';
    return 'red';
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg match-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Match Breakdown{matchData?.position_title ? ` — ${matchData.position_title}` : ''}</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {loading ? (
            <p>Loading...</p>
          ) : !matchData ? (
            <p>Failed to load match data.</p>
          ) : (
            <div className="match-breakdown">
              <div className="match-overall">
                <span className={`score-badge score-badge-large score-${getScoreClass(matchData.overall_score)}`}>
                  {matchData.overall_score}%
                </span>
                <span className="match-overall-label">Overall Match Score</span>
              </div>

              {matchData.score_breakdown && (
                <div className="match-section">
                  <h3>Score Breakdown</h3>
                  {Object.entries(matchData.score_breakdown).map(([key, value]) => (
                    <div key={key} className="progress-row">
                      <span className="progress-label">{capitalize(key)}</span>
                      <div className="progress-bar">
                        <div
                          className={`progress-fill progress-${getScoreClass(value)}`}
                          style={{ width: `${Math.min(Number(value), 100)}%` }}
                        />
                      </div>
                      <span className="progress-value">{value}%</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="match-two-col">
                {matchData.matching_skills?.length > 0 && (
                  <div className="match-section">
                    <h3>Matching Skills</h3>
                    <div className="skills-list">
                      {matchData.matching_skills.map((skill) => (
                        <span key={skill} className="badge badge-match-skill">{skill}</span>
                      ))}
                    </div>
                  </div>
                )}
                {matchData.missing_skills?.length > 0 && (
                  <div className="match-section">
                    <h3>Missing Skills</h3>
                    <div className="skills-list">
                      {matchData.missing_skills.map((skill) => (
                        <span key={skill} className="badge badge-missing-skill">{skill}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="match-two-col">
                {matchData.strong_points?.length > 0 && (
                  <div className="match-section">
                    <h3>Strong Points</h3>
                    <ul className="match-list match-list-green">
                      {matchData.strong_points.map((point, i) => (
                        <li key={i}>{point}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {matchData.red_flags?.length > 0 && (
                  <div className="match-section">
                    <h3>Red Flags</h3>
                    <ul className="match-list match-list-red">
                      {matchData.red_flags.map((flag, i) => (
                        <li key={i}>{flag}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {renderScorecard(matchData.scorecard)}

              {matchData.hire_recommendation && (
                <div className={`recommendation-banner recommendation-${getRecommendationClass(matchData.hire_recommendation)}`}>
                  <strong>Recommendation: {matchData.hire_recommendation}</strong>
                  {matchData.recommendation_reason && <p>{matchData.recommendation_reason}</p>}
                </div>
              )}

              {matchData.summary && (
                <div className="match-section">
                  <h3>Summary</h3>
                  <p className="match-summary">{matchData.summary}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function UploadResumeModal({ onClose, onUpload, file, setFile, positions, selectedPosition, setSelectedPosition }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Upload Resume</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              Select Resume File:
            </label>
            <input
              type="file"
              accept=".pdf"
              multiple
              onChange={(e) => setFile(e.target.files)}
            />
            {file && file.length > 0 && (
              <div style={{ marginTop: '10px' }}>
                <strong>Selected files ({file.length}):</strong>
                <ul style={{ margin: '5px 0', paddingLeft: '20px' }}>
                  {Array.from(file).map((f, idx) => (
                    <li key={idx} style={{ fontSize: '0.875rem', color: '#475569' }}>{f.name}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              Select Position: *
            </label>
            <select
              value={selectedPosition?.id || ''}
              onChange={(e) => {
                const position = positions.find(p => p.id === parseInt(e.target.value, 10));
                setSelectedPosition(position);
              }}
              style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
              required
            >
              <option value="">Choose a position...</option>
              {positions.filter(p => p.status === 'open').map((position) => (
                <option key={position.id} value={position.id}>
                  {position.title}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={onUpload}
            disabled={!file || file.length === 0 || !selectedPosition}
          >
            {file && file.length > 1 ? `Upload ${file.length} Resumes` : 'Upload Resume'}
          </button>
        </div>
      </div>
    </div>
  );
}

function CandidateDetailsModal({ candidate, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{candidate.name}</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="candidate-details">
            <p><strong>Email:</strong> {candidate.email}</p>
            <p><strong>Phone:</strong> {candidate.phone}</p>
            <p><strong>Location:</strong> {candidate.location}</p>
            <p><strong>Experience:</strong> {candidate.total_years_experience} years</p>
            <p><strong>Current Role:</strong> {candidate.current_role}</p>
            <p><strong>Company:</strong> {candidate.current_company}</p>
            <div>
              <strong>Skills:</strong>
              {candidate.skills?.map((skill) => (
                <span key={skill} className="badge badge-skill">{skill}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReEvaluateModal({ candidate, positions, onClose, onEvaluate }) {
  const [selectedJdId, setSelectedJdId] = useState('');
  const [evaluating, setEvaluating] = useState(false);

  const openPositions = positions.filter(p => p.status === 'open');

  const handleEvaluate = async () => {
    if (!selectedJdId) return;
    setEvaluating(true);
    try {
      await onEvaluate(Number(selectedJdId));
    } catch {
      // error toast already shown by parent; keep modal open
    } finally {
      setEvaluating(false);
    }
  };

  const fieldStyle = {
    width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1',
    borderRadius: '6px', fontSize: '0.9rem',
  };

  return (
    <div className="modal-overlay">
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Re-evaluate Candidate — {candidate.name}</h2>
          <button className="close-btn" onClick={onClose} disabled={evaluating}>×</button>
        </div>
        <div className="modal-body">
          {candidate.latest_match && (
            <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '8px', marginBottom: '16px', fontSize: '0.875rem', color: '#64748b' }}>
              <p><strong>Currently matched with:</strong> {candidate.latest_match.position_title}</p>
              <p style={{ marginTop: '4px' }}><strong>Current score:</strong> {candidate.latest_match.overall_score}%</p>
            </div>
          )}
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600' }}>Select New Position:</label>
            <select value={selectedJdId} onChange={(e) => setSelectedJdId(e.target.value)} style={fieldStyle}>
              <option value="">Choose a position...</option>
              {openPositions.map(p => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={evaluating}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={handleEvaluate}
            disabled={!selectedJdId || evaluating}
          >
            {evaluating ? 'Evaluating...' : 'Evaluate'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ApplicantsPage;
