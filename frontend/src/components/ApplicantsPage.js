import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import CandidateDetailPanel from './CandidateDetailPanel';
import ScheduleInterviewModal from './ScheduleInterviewModal';

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
  const [scheduleModal, setScheduleModal] = useState(null); // { candidate }
  const [refreshInterviewsToken, setRefreshInterviewsToken] = useState(0);
  const [selectedCandidates, setSelectedCandidates] = useState([]);
  const [bulkStatusModal, setBulkStatusModal] = useState(false);
  const [compareModal, setCompareModal] = useState(false);
  const [emailModal, setEmailModal] = useState(null);
  const [pendingOpenCandidateId, setPendingOpenCandidateId] = useState(null);


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
    switch (status) {
      case 'Reviewed': return 'reviewed';
      case 'Interview Scheduled': return 'interview';
      case 'On Hold': return 'on-hold';
      case 'Rejected': return 'rejected';
      case 'Hired': return 'hired';
      case 'Archived': return 'archived';
      default: return 'new';
    }
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

  const refreshCandidateDetail = useCallback(async (candidateId) => {
    try {
      const response = await axios.get(`${API_BASE}/candidates`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const fresh = response.data || [];
      setCandidates(fresh);
      if (candidateId) {
        const updated = fresh.find(c => c.id === candidateId);
        if (updated) setSelectedCandidateDetail(updated);
      }
    } catch (err) {
      console.error('Failed to refresh candidate:', err);
    }
  }, [API_BASE, token]);

  useEffect(() => {
    fetchCandidates();
    fetchPositions();
  }, [fetchCandidates, fetchPositions]);

  // Handle cross-page "open candidate panel" event from Dashboard
  useEffect(() => {
    const handler = (e) => {
      const id = e.detail;
      setCandidates(prev => {
        const found = prev.find(c => c.id === id);
        if (found) setSelectedCandidateDetail(found);
        return prev;
      });
    };
    window.addEventListener('open-candidate', handler);
    return () => window.removeEventListener('open-candidate', handler);
  }, []);

  // On mount: read URL params set by Dashboard "View Profile"
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const searchParam = params.get('search');
    const openId = params.get('openCandidate');
    if (searchParam) setSearchTerm(searchParam);
    if (openId) setPendingOpenCandidateId(Number(openId));
  }, []);

  // Once candidates load, open the pending panel and clear URL params
  useEffect(() => {
    if (!pendingOpenCandidateId || candidates.length === 0) return;
    const candidate = candidates.find(c => c.id === pendingOpenCandidateId);
    if (candidate) {
      setSelectedCandidateDetail(candidate);
      setPendingOpenCandidateId(null);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [candidates, pendingOpenCandidateId]);

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
    const candidateForEmail = statusModal.candidate;

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
      if (status === 'Rejected' || status === 'Archived') {
        setEmailModal({ type: 'single', candidate: candidateForEmail, status });
      }
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

  const handleBulkStatusUpdate = async (status, comment) => {
    const bulkIds = [...selectedCandidates];
    const affectedCandidates = candidates.filter(c => bulkIds.includes(c.id));
    setBulkStatusModal(false);
    try {
      const response = await axios.post(
        `${API_BASE}/candidates/bulk-status-update`,
        { candidate_ids: bulkIds, status, comment: comment || null },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const count = response.data.updated_count;
      setToast({ type: 'success', message: `${count} candidate${count !== 1 ? 's' : ''} status updated to "${status}"` });
      setSelectedCandidates([]);
      await fetchCandidates();
      if ((status === 'Rejected' || status === 'Archived') && affectedCandidates.length > 0) {
        setEmailModal({ type: 'bulk', candidates: affectedCandidates, status });
      }
    } catch (err) {
      setToast({ type: 'error', message: 'Bulk update failed: ' + (err.response?.data?.detail || err.message) });
      setBulkStatusModal(true);
    }
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
    <>
      {/* Fixed-position dot menu dropdown — outside page-content to avoid overflow clipping */}
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
          <button
            onClick={() => {
              const candidate = candidates.find(c => c.id === openMenuId);
              setScheduleModal({ candidate });
              setOpenMenuId(null);
              setMenuAnchor(null);
            }}
          >
            Schedule Interview
          </button>
        </div>
      )}

      <div className={`page-content${selectedCandidateDetail ? ' with-panel' : ''}`}>
        {toast && (
          <div className={`toast ${toast.type}`}>
            {toast.message}
          </div>
        )}

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
        <div className="search-row">
          <input
            type="text"
            placeholder="Search candidates..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="filters-row">
          <div className="filters-left">
            <div className="filter-group">
              <label>Status:</label>
              <FilterDropdown
                value={filterStatus}
                onChange={setFilterStatus}
                options={['New','Reviewed','Interview Scheduled','On Hold','Rejected','Hired','Archived']}
                placeholder="All"
                searchable={false}
              />
            </div>
            <div className="filter-group">
              <label>Position:</label>
              <FilterDropdown
                value={filterPosition}
                onChange={setFilterPosition}
                options={uniquePositionTitles}
                placeholder="All"
                searchable={true}
              />
            </div>
            <div className="filter-group">
              <label>Assigned To:</label>
              <FilterDropdown
                value={filterAssignedTo}
                onChange={setFilterAssignedTo}
                options={uniqueAssignedTo}
                placeholder="All"
                searchable={true}
              />
            </div>
          </div>
          <div className="filters-right">
            <span title={selectedCandidates.length > 4 ? 'Select 4 candidates at most to compare' : undefined}>
              <button
                className="btn btn-compare"
                onClick={() => setCompareModal(true)}
                disabled={selectedCandidates.length < 2 || selectedCandidates.length > 4}
              >
                {selectedCandidates.length >= 2 && selectedCandidates.length <= 4
                  ? `Compare (${selectedCandidates.length})`
                  : 'Compare'}
              </button>
            </span>
            <button
              className="btn btn-bulk-status"
              onClick={() => setBulkStatusModal(true)}
              disabled={selectedCandidates.length === 0}
            >
              {selectedCandidates.length > 0 ? `Update Status (${selectedCandidates.length})` : 'Update Status'}
            </button>
            <button className="btn btn-excel" onClick={exportToExcel}>
              ↓ Export to Excel
            </button>
          </div>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}>
                  <input
                    type="checkbox"
                    checked={paginatedCandidates.length > 0 && paginatedCandidates.every(c => selectedCandidates.includes(c.id))}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedCandidates(prev => [...new Set([...prev, ...paginatedCandidates.map(c => c.id)])]);
                      } else {
                        setSelectedCandidates(prev => prev.filter(id => !paginatedCandidates.some(c => c.id === id)));
                      }
                    }}
                  />
                </th>
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
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedCandidates.includes(candidate.id)}
                        onChange={(e) => {
                          e.stopPropagation();
                          setSelectedCandidates(prev =>
                            e.target.checked ? [...prev, candidate.id] : prev.filter(id => id !== candidate.id)
                          );
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
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

        {bulkStatusModal && (
          <BulkStatusModal
            count={selectedCandidates.length}
            onClose={() => setBulkStatusModal(false)}
            onSave={handleBulkStatusUpdate}
          />
        )}

        {compareModal && (
          <CompareModal
            candidates={candidates.filter(c => selectedCandidates.includes(c.id))}
            onClose={() => setCompareModal(false)}
            onViewProfile={(c) => setSelectedCandidateDetail(c)}
            API_BASE={API_BASE}
            token={token}
          />
        )}

        {emailModal && (
          <EmailConfirmModal
            type={emailModal.type}
            candidate={emailModal.candidate}
            candidates={emailModal.candidates}
            status={emailModal.status}
            onClose={() => setEmailModal(null)}
            onSend={(success, msg) => {
              setEmailModal(null);
              if (success) {
                setToast({ type: 'success', message: 'Email sent successfully' });
              } else if (msg) {
                setToast({ type: 'warning', message: msg });
              }
            }}
            API_BASE={API_BASE}
            token={token}
          />
        )}
      </div>

      {selectedCandidateDetail && (
        <div className="candidate-side-panel">
          <CandidateDetailPanel
            candidate={selectedCandidateDetail}
            onClose={() => setSelectedCandidateDetail(null)}
            API_BASE={API_BASE}
            token={token}
            onScheduleInterview={(c) => setScheduleModal({ candidate: c })}
            onCandidateUpdated={() => refreshCandidateDetail(selectedCandidateDetail.id)}
            refreshInterviewsToken={refreshInterviewsToken}
          />
        </div>
      )}

      {scheduleModal && (
        <ScheduleInterviewModal
          candidate={scheduleModal.candidate}
          API_BASE={API_BASE}
          token={token}
          onClose={() => setScheduleModal(null)}
          onScheduled={() => { fetchCandidates(); setRefreshInterviewsToken(t => t + 1); }}
          onGoToSettings={() => {
            setScheduleModal(null);
            // Signal parent to navigate to settings — handled via a custom event
            window.dispatchEvent(new CustomEvent('navigate', { detail: 'settings' }));
          }}
        />
      )}
    </>
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
    'Interview Scheduled',
    'On Hold',
    'Rejected',
    'Hired',
    'Archived',
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
              <p style={{ marginTop: '8px', fontSize: '0.875rem', color: '#475569' }}>
                {file.length} {file.length === 1 ? 'file' : 'files'} selected
              </p>
            )}
          </div>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              Select Position: *
            </label>
            <PositionDropdown
              positions={positions.filter(p => p.status === 'open')}
              value={selectedPosition}
              onChange={setSelectedPosition}
            />
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


function ReEvaluateModal({ candidate, positions, onClose, onEvaluate }) {
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [evaluating, setEvaluating] = useState(false);

  const openPositions = positions.filter(p => p.status === 'open');

  const handleEvaluate = async () => {
    if (!selectedPosition) return;
    setEvaluating(true);
    try {
      await onEvaluate(selectedPosition.id);
    } catch {
      // error toast already shown by parent; keep modal open
    } finally {
      setEvaluating(false);
    }
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
            <PositionDropdown
              positions={openPositions}
              value={selectedPosition}
              onChange={setSelectedPosition}
            />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={evaluating}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={handleEvaluate}
            disabled={!selectedPosition || evaluating}
          >
            {evaluating ? 'Evaluating...' : 'Evaluate'}
          </button>
        </div>
      </div>
    </div>
  );
}

function PositionDropdown({ positions, value, onChange, placeholder = 'Choose a position...' }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [menuStyle, setMenuStyle] = useState({});
  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const searchRef = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    if (isOpen) {
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        setMenuStyle({ position: 'fixed', top: rect.bottom + 4, left: rect.left, width: rect.width, minWidth: 'unset', zIndex: 9999 });
      }
      if (searchRef.current) searchRef.current.focus();
    }
  }, [isOpen]);

  const filtered = positions.filter(p =>
    p.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="filter-dropdown" ref={containerRef} style={{ width: '100%' }}>
      <button
        ref={triggerRef}
        type="button"
        className={`filter-dropdown-trigger${isOpen ? ' open' : ''}`}
        style={{ width: '100%', minWidth: 'unset' }}
        onClick={() => { setIsOpen(prev => !prev); if (!isOpen) setSearchQuery(''); }}
      >
        <span className="filter-dropdown-value" style={{ maxWidth: 'none', flex: 1 }}>
          {value ? value.title : placeholder}
        </span>
        <span className="filter-dropdown-arrow">▾</span>
      </button>

      {isOpen && (
        <div className="filter-dropdown-menu" style={menuStyle}>
          <div className="filter-dropdown-search-wrap">
            <input
              ref={searchRef}
              type="text"
              className="filter-dropdown-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search positions..."
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <div className="filter-dropdown-list">
            {filtered.length === 0 ? (
              <div className="filter-dropdown-empty">No results found</div>
            ) : filtered.map(p => (
              <div
                key={p.id}
                className={`filter-dropdown-option${value?.id === p.id ? ' selected' : ''}`}
                onClick={() => { onChange(p); setIsOpen(false); setSearchQuery(''); }}
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

function FilterDropdown({ value, onChange, options, searchable = false, placeholder = 'All' }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef(null);
  const searchRef = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    if (isOpen && searchable && searchRef.current) {
      searchRef.current.focus();
    }
  }, [isOpen, searchable]);

  const filtered = searchable
    ? options.filter(opt => opt.toLowerCase().includes(searchQuery.toLowerCase()))
    : options;

  return (
    <div className="filter-dropdown" ref={containerRef}>
      <button
        type="button"
        className={`filter-dropdown-trigger${isOpen ? ' open' : ''}`}
        onClick={() => { setIsOpen(prev => !prev); if (!isOpen) setSearchQuery(''); }}
      >
        <span className="filter-dropdown-value">{value === 'All' ? placeholder : value}</span>
        <span className="filter-dropdown-arrow">▾</span>
      </button>

      {isOpen && (
        <div className="filter-dropdown-menu">
          {searchable && (
            <div className="filter-dropdown-search-wrap">
              <input
                ref={searchRef}
                type="text"
                className="filter-dropdown-search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}
          <div className="filter-dropdown-list">
            <div
              className={`filter-dropdown-option${value === 'All' ? ' selected' : ''}`}
              onClick={() => { onChange('All'); setIsOpen(false); setSearchQuery(''); }}
            >
              {placeholder}
            </div>
            {filtered.length === 0 ? (
              <div className="filter-dropdown-empty">No results found</div>
            ) : filtered.map(opt => (
              <div
                key={opt}
                className={`filter-dropdown-option${value === opt ? ' selected' : ''}`}
                onClick={() => { onChange(opt); setIsOpen(false); setSearchQuery(''); }}
              >
                {opt}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function BulkStatusModal({ count, onClose, onSave }) {
  const STATUS_OPTIONS = [
    'New',
    'Reviewed',
    'Interview Scheduled',
    'On Hold',
    'Rejected',
    'Hired',
    'Archived',
  ];
  const [status, setStatus] = useState('Reviewed');
  const [comment, setComment] = useState('');

  return (
    <div className="modal-overlay">
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Update Status — {count} Candidate{count !== 1 ? 's' : ''}</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600' }}>New Status:</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.9rem' }}
            >
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600' }}>Comment (optional):</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add a comment for all selected candidates..."
              rows={4}
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.9rem', resize: 'vertical' }}
            />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onSave(status, comment)}>
            Update {count} Candidate{count !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  );
}

function EmailConfirmModal({ type, candidate, candidates, status, onClose, onSend, API_BASE, token }) {
  const isBulk = type === 'bulk';
  const targets = isBulk ? (candidates || []) : (candidate ? [candidate] : []);
  const recipientCount = targets.length;

  const positionTitle = !isBulk
    ? (candidate?.latest_match?.position_title || 'the position')
    : 'the position';
  const candidateName = !isBulk ? (candidate?.name || 'Candidate') : 'Candidate';

  const defaultSubject = `Application Update — ${positionTitle}`;
  const defaultBody = status === 'Rejected'
    ? `Dear ${candidateName},\n\nThank you for your interest in the ${positionTitle} position and for taking the time to go through our hiring process.\n\nAfter careful consideration, we have decided to move forward with other candidates whose experience more closely matches our current requirements.\n\nWe appreciate your interest in joining our team and wish you the best in your job search.\n\nBest regards,\nHiring Team`
    : `Dear ${candidateName},\n\nThank you for applying for the ${positionTitle} position.\n\nWe wanted to let you know that your application has been archived at this time. This may be due to the position being filled or placed on hold.\n\nWe will keep your profile on file and may reach out if a suitable opportunity arises in the future.\n\nBest regards,\nHiring Team`;

  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState(defaultBody);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');

  const subtitleLabel = isBulk
    ? `${recipientCount} candidate${recipientCount !== 1 ? 's' : ''}`
    : candidate?.name;

  const handleSend = async () => {
    setSending(true);
    setSendError('');
    const bodyHtml = body.replace(/\n/g, '<br>');
    let failed = 0;
    for (const t of targets) {
      try {
        await axios.post(
          `${API_BASE}/candidates/${t.id}/send-email`,
          { subject, body: bodyHtml, to_email: t.email },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      } catch {
        failed++;
      }
    }
    setSending(false);
    if (failed === 0) {
      onSend(true);
    } else if (failed < targets.length) {
      onSend(false, `${targets.length - failed} of ${targets.length} emails sent.`);
    } else {
      setSendError('Failed to send emails. Gmail permission not found. Please reconnect Google in Settings.');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>Send Email Notification?</h2>
            <p style={{ fontSize: '0.875rem', color: '#64748b', marginTop: '4px' }}>
              Notify {subtitleLabel} about their application status
            </p>
          </div>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {isBulk && (
            <div style={{ marginBottom: '16px', padding: '10px 14px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', fontSize: '13px', color: '#1d4ed8' }}>
              This email will be sent to all {recipientCount} {status.toLowerCase()} candidate{recipientCount !== 1 ? 's' : ''}.
            </div>
          )}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '0.875rem' }}>Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.9rem', boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '0.875rem' }}>Email Body</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.875rem', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6, boxSizing: 'border-box' }}
            />
          </div>
          {sendError && (
            <div style={{ marginTop: '12px', padding: '10px 14px', background: '#fee2e2', color: '#991b1b', borderRadius: '6px', fontSize: '0.875rem' }}>
              {sendError}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={sending}>Skip</button>
          <button className="btn btn-primary" onClick={handleSend} disabled={sending || !subject.trim()}>
            {sending
              ? <><span className="spinner"></span> Sending…</>
              : `Send Email${recipientCount > 1 ? ` (${recipientCount})` : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}

function CompareModal({ candidates, onClose, onViewProfile, API_BASE, token }) {
  const [matchDataMap, setMatchDataMap] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      const results = {};
      await Promise.all(
        candidates.map(async (c) => {
          const matchId = c.latest_match?.id;
          if (!matchId) return;
          try {
            const res = await axios.get(`${API_BASE}/match-results/${matchId}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            results[c.id] = res.data;
          } catch {
            results[c.id] = null;
          }
        })
      );
      setMatchDataMap(results);
      setLoading(false);
    };
    fetchAll();
  }, [candidates, API_BASE, token]);

  const positionIds = [...new Set(candidates.map(c => c.latest_match?.position_id).filter(Boolean))];
  const mixedPositions = positionIds.length > 1;

  function scoreColor(score) {
    if (score == null) return '#94a3b8';
    if (score >= 70) return '#16a34a';
    if (score >= 40) return '#f59e0b';
    return '#ef4444';
  }

  function scoreBarColor(score) {
    if (score == null) return '#e5e7eb';
    if (score >= 70) return '#16a34a';
    if (score >= 40) return '#f59e0b';
    return '#ef4444';
  }

  const scoreBreakdownKeys = ['skills_match', 'experience_match', 'education_match', 'cultural_fit'];

  return (
    <div className="cmp-overlay" onClick={onClose}>
      <div className="cmp-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cmp-header">
          <span className="cmp-title">Candidate Comparison</span>
          <button className="cmp-close" onClick={onClose}>×</button>
        </div>

        {mixedPositions && (
          <div className="cmp-warning">
            ⚠ These candidates are matched to different positions. Scores may not be directly comparable.
          </div>
        )}

        {loading ? (
          <div className="cmp-loading">
            <span className="spinner" style={{ borderTopColor: '#2563eb', borderColor: 'rgba(37,99,235,0.2)' }}></span>
            Loading comparison data...
          </div>
        ) : (
          <div className="cmp-body">
            <table className="cmp-table">
              <thead>
                <tr className="cmp-cand-row">
                  <th className="cmp-th-label"></th>
                  {candidates.map(c => (
                    <th key={c.id} className="cmp-th-cand">
                      <div className="cmp-cand-name">{c.name}</div>
                      <div className="cmp-cand-pos">{c.latest_match?.position_title || '—'}</div>
                      <button
                        className="cmp-view-btn"
                        onClick={() => { onClose(); onViewProfile(c); }}
                      >
                        View Profile
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="cmp-sec-row">
                  <td colSpan={candidates.length + 1}>Overall</td>
                </tr>
                <tr className="cmp-odd">
                  <td className="cmp-td-label">Match Score</td>
                  {candidates.map(c => {
                    const score = c.latest_match?.overall_score;
                    return (
                      <td key={c.id} className="cmp-td-data">
                        <span style={{ fontSize: 28, fontWeight: 700, color: scoreColor(score) }}>
                          {score != null ? `${score}%` : '—'}
                        </span>
                      </td>
                    );
                  })}
                </tr>
                <tr className="cmp-even">
                  <td className="cmp-td-label">Status</td>
                  {candidates.map(c => (
                    <td key={c.id} className="cmp-td-data">{c.latest_match?.status || 'New'}</td>
                  ))}
                </tr>
                <tr className="cmp-odd">
                  <td className="cmp-td-label">Experience</td>
                  {candidates.map(c => (
                    <td key={c.id} className="cmp-td-data">
                      {c.total_years_experience != null ? `${c.total_years_experience} yrs` : '—'}
                    </td>
                  ))}
                </tr>

                <tr className="cmp-sec-row">
                  <td colSpan={candidates.length + 1}>Score Breakdown</td>
                </tr>
                {scoreBreakdownKeys.map((key, idx) => (
                  <tr key={key} className={idx % 2 === 0 ? 'cmp-even' : 'cmp-odd'}>
                    <td className="cmp-td-label">{capitalize(key)}</td>
                    {candidates.map(c => {
                      const val = matchDataMap[c.id]?.score_breakdown?.[key];
                      return (
                        <td key={c.id} className="cmp-td-data">
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ flex: 1, height: 6, background: '#e5e7eb', borderRadius: 999, overflow: 'hidden' }}>
                              <div style={{ width: `${Math.min(val ?? 0, 100)}%`, height: '100%', background: scoreBarColor(val), borderRadius: 999 }} />
                            </div>
                            <span style={{ fontSize: 12, fontWeight: 600, color: '#475569', whiteSpace: 'nowrap' }}>
                              {val != null ? `${val}%` : '—'}
                            </span>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}

                <tr className="cmp-sec-row">
                  <td colSpan={candidates.length + 1}>Skills</td>
                </tr>
                <tr className="cmp-odd">
                  <td className="cmp-td-label">Matching</td>
                  {candidates.map(c => {
                    const skills = matchDataMap[c.id]?.matching_skills || [];
                    return (
                      <td key={c.id} className="cmp-td-data">
                        {skills.length > 0 ? skills.join(', ') : <span style={{ color: '#94a3b8' }}>None</span>}
                      </td>
                    );
                  })}
                </tr>
                <tr className="cmp-even">
                  <td className="cmp-td-label">Missing</td>
                  {candidates.map(c => {
                    const skills = matchDataMap[c.id]?.missing_skills || [];
                    return (
                      <td key={c.id} className="cmp-td-data">
                        {skills.length > 0 ? skills.join(', ') : <span style={{ color: '#94a3b8' }}>None</span>}
                      </td>
                    );
                  })}
                </tr>

                <tr className="cmp-sec-row">
                  <td colSpan={candidates.length + 1}>Evaluation</td>
                </tr>
                <tr className="cmp-odd">
                  <td className="cmp-td-label">Strong Points</td>
                  {candidates.map(c => {
                    const points = matchDataMap[c.id]?.strong_points || [];
                    return (
                      <td key={c.id} className="cmp-td-data">
                        {points.length > 0 ? (
                          <ul className="cmp-bullet-list">
                            {points.map((p, i) => <li key={i}>{p}</li>)}
                          </ul>
                        ) : <span style={{ color: '#94a3b8' }}>—</span>}
                      </td>
                    );
                  })}
                </tr>
                <tr className="cmp-even">
                  <td className="cmp-td-label">Red Flags</td>
                  {candidates.map(c => {
                    const flags = matchDataMap[c.id]?.red_flags || [];
                    return (
                      <td key={c.id} className="cmp-td-data">
                        {flags.length > 0 ? (
                          <ul className="cmp-bullet-list">
                            {flags.map((f, i) => <li key={i}>{f}</li>)}
                          </ul>
                        ) : <span style={{ color: '#94a3b8' }}>—</span>}
                      </td>
                    );
                  })}
                </tr>

                <tr className="cmp-sec-row">
                  <td colSpan={candidates.length + 1}>Recommendation</td>
                </tr>
                <tr className="cmp-odd">
                  <td className="cmp-td-label">Decision</td>
                  {candidates.map(c => (
                    <td key={c.id} className="cmp-td-data">
                      {matchDataMap[c.id]?.hire_recommendation || <span style={{ color: '#94a3b8' }}>—</span>}
                    </td>
                  ))}
                </tr>
                <tr className="cmp-even">
                  <td className="cmp-td-label">Reason</td>
                  {candidates.map(c => (
                    <td key={c.id} className="cmp-td-data" style={{ fontSize: 13, color: '#475569', lineHeight: 1.5 }}>
                      {matchDataMap[c.id]?.recommendation_reason || <span style={{ color: '#94a3b8' }}>—</span>}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default ApplicantsPage;
