import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const EMPTY_FORM = {
  title: '', description: '', team: '', manager: '', assigned_to: '', start_date: '', status: 'open',
};

function formatStatus(status) {
  const labels = { open: 'Open', closed: 'Closed', on_hold: 'On Hold', in_progress: 'In Progress' };
  return labels[status] || status;
}

function PositionsPage({ API_BASE, token, onError }) {
  const [jobDescriptions, setJobDescriptions] = useState([]);
  const [positionTab, setPositionTab] = useState('all');
  const [showPositionModal, setShowPositionModal] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [positionForm, setPositionForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [editModal, setEditModal] = useState(null);
  const [statusModal, setStatusModal] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const fetchPositions = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE}/job-descriptions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setJobDescriptions(response.data || []);
    } catch (err) {
      onError('Failed to load positions: ' + (err.response?.data?.detail || err.message));
    }
    setLoading(false);
  }, [API_BASE, token, onError]);

  useEffect(() => { fetchPositions(); }, [fetchPositions]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const close = () => { setOpenMenuId(null); setMenuAnchor(null); };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  const handleCreatePosition = async () => {
    if (!positionForm.title.trim() || !positionForm.description.trim()) {
      setToast({ type: 'error', message: 'Title and description are required' });
      return;
    }
    setLoading(true);
    try {
      await axios.post(
        `${API_BASE}/job-descriptions`,
        { ...positionForm, start_date: positionForm.start_date || null },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setToast({ type: 'success', message: 'Position created successfully' });
      setShowPositionModal(false);
      setPositionForm(EMPTY_FORM);
      fetchPositions();
    } catch (err) {
      setToast({ type: 'error', message: 'Failed to create position: ' + (err.response?.data?.detail || err.message) });
    }
    setLoading(false);
  };

  const handleEditPosition = async () => {
    const { position, form } = editModal;
    if (!form.title.trim() || !form.description.trim()) {
      setToast({ type: 'error', message: 'Title and description are required' });
      return;
    }
    try {
      await axios.patch(
        `${API_BASE}/job-descriptions/${position.id}`,
        {
          title: form.title,
          description: form.description,
          team: form.team,
          manager: form.manager,
          assigned_to: form.assigned_to,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setToast({ type: 'success', message: 'Position updated successfully' });
      setEditModal(null);
      fetchPositions();
    } catch (err) {
      setToast({ type: 'error', message: 'Failed to update position: ' + (err.response?.data?.detail || err.message) });
    }
  };

  const handleStatusUpdate = async (status, hiredName, hiredEmail, comment) => {
    const position = statusModal.position;
    setStatusModal(null);
    try {
      await axios.patch(
        `${API_BASE}/job-descriptions/${position.id}/status`,
        {
          status,
          hired_candidate_name: hiredName || null,
          hired_candidate_email: hiredEmail || null,
          comment: comment || null,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setToast({ type: 'success', message: 'Position status updated successfully' });
      fetchPositions();
    } catch (err) {
      setToast({ type: 'error', message: 'Failed to update status: ' + (err.response?.data?.detail || err.message) });
    }
  };

  const handleMenuOpen = (e, positionId) => {
    e.stopPropagation();
    if (openMenuId === positionId) {
      setOpenMenuId(null);
      setMenuAnchor(null);
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      setOpenMenuId(positionId);
      setMenuAnchor({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    }
  };

  const filteredPositions = positionTab === 'all'
    ? jobDescriptions
    : jobDescriptions.filter((jd) => jd.status === positionTab);

  useEffect(() => { setCurrentPage(1); }, [positionTab, itemsPerPage]);

  const totalPages = Math.ceil(filteredPositions.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedPositions = filteredPositions.slice(startIndex, startIndex + itemsPerPage);

  return (
    <div className="content">
      {toast && <div className={`toast ${toast.type}`}>{toast.message}</div>}

      {openMenuId && menuAnchor && (
        <div className="dot-menu-dropdown" style={{ top: menuAnchor.top, right: menuAnchor.right }}>
          <button onClick={() => {
            const pos = jobDescriptions.find(p => p.id === openMenuId);
            setSelectedPosition(pos);
            setOpenMenuId(null); setMenuAnchor(null);
          }}>View Details</button>
          <button onClick={() => {
            const pos = jobDescriptions.find(p => p.id === openMenuId);
            setEditModal({
              position: pos,
              form: {
                title: pos.title,
                description: pos.description,
                team: pos.team || '',
                manager: pos.manager || '',
                assigned_to: pos.assigned_to || '',
                start_date: pos.start_date
                  ? new Date(pos.start_date).toISOString().split('T')[0]
                  : '',
                status: pos.status,
              },
            });
            setOpenMenuId(null); setMenuAnchor(null);
          }}>Edit Position</button>
          <button onClick={() => {
            const pos = jobDescriptions.find(p => p.id === openMenuId);
            setStatusModal({ position: pos });
            setOpenMenuId(null); setMenuAnchor(null);
          }}>Change Status</button>
        </div>
      )}

      <div className="page">
        <div className="page-header">
          <h1>Positions ({filteredPositions.length})</h1>
          <button className="btn btn-primary" onClick={() => setShowPositionModal(true)}>
            Add New Position
          </button>
        </div>

        <div className="tabs">
          <button className={`tab ${positionTab === 'all' ? 'active' : ''}`} onClick={() => setPositionTab('all')}>
            All ({jobDescriptions.length})
          </button>
          <button className={`tab ${positionTab === 'open' ? 'active' : ''}`} onClick={() => setPositionTab('open')}>
            Open ({jobDescriptions.filter(p => p.status === 'open').length})
          </button>
          <button className={`tab ${positionTab === 'on_hold' ? 'active' : ''}`} onClick={() => setPositionTab('on_hold')}>
            On Hold ({jobDescriptions.filter(p => p.status === 'on_hold').length})
          </button>
          <button className={`tab ${positionTab === 'closed' ? 'active' : ''}`} onClick={() => setPositionTab('closed')}>
            Closed ({jobDescriptions.filter(p => p.status === 'closed').length})
          </button>
        </div>

        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}><input type="checkbox" /></th>
                <th>Title</th>
                <th>Team</th>
                <th>Manager</th>
                <th>Assigned To</th>
                <th>Status</th>
                <th>Start Date</th>
                <th>Age (days)</th>
                <th style={{ width: '50px' }}></th>
              </tr>
            </thead>
            <tbody>
              {paginatedPositions.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', padding: '20px' }}>
                    No positions found
                  </td>
                </tr>
              ) : (
                paginatedPositions.map((position) => (
                  <tr key={position.id} onClick={() => setSelectedPosition(position)} className="table-row">
                    <td><input type="checkbox" onClick={(e) => e.stopPropagation()} /></td>
                    <td className="font-weight-600">{position.title}</td>
                    <td>{position.team || '-'}</td>
                    <td>{position.manager || '-'}</td>
                    <td>{position.assigned_to || '-'}</td>
                    <td>
                      <span className={`badge badge-${position.status}`}>
                        {formatStatus(position.status)}
                      </span>
                    </td>
                    <td>{position.start_date ? new Date(position.start_date).toLocaleDateString() : '-'}</td>
                    <td>{position.age_days ?? '-'}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <button className="dot-menu-btn" onClick={(e) => handleMenuOpen(e, position.id)}>⋯</button>
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
              Showing {filteredPositions.length === 0 ? 0 : startIndex + 1}–{Math.min(startIndex + itemsPerPage, filteredPositions.length)} of {filteredPositions.length}
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
              <button className="btn-page" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>‹</button>
              {totalPages > 0 && getPageNumbers(currentPage, totalPages).map((p, i) =>
                p === '...'
                  ? <span key={`dots-${i}`} className="pagination-dots">…</span>
                  : <button key={p} className={`btn-page${currentPage === p ? ' active' : ''}`} onClick={() => setCurrentPage(p)}>{p}</button>
              )}
              <button className="btn-page" disabled={currentPage === totalPages || totalPages === 0} onClick={() => setCurrentPage(p => p + 1)}>›</button>
            </div>
          </div>
        </div>
      </div>

      {showPositionModal && (
        <PositionFormModal
          title="Add Position"
          onClose={() => { setShowPositionModal(false); setPositionForm(EMPTY_FORM); }}
          onSave={handleCreatePosition}
          form={positionForm}
          setForm={setPositionForm}
          loading={loading}
        />
      )}

      {editModal && (
        <PositionFormModal
          title="Edit Position"
          onClose={() => setEditModal(null)}
          onSave={handleEditPosition}
          form={editModal.form}
          setForm={(form) => setEditModal(prev => ({ ...prev, form }))}
          loading={false}
          isEdit={true}
        />
      )}

      {selectedPosition && (
        <PositionDetailsModal position={selectedPosition} onClose={() => setSelectedPosition(null)} />
      )}

      {statusModal && (
        <PositionStatusModal
          position={statusModal.position}
          onClose={() => setStatusModal(null)}
          onSave={handleStatusUpdate}
          setToast={setToast}
        />
      )}
    </div>
  );
}

function getPageNumbers(currentPage, totalPages) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const pages = new Set([1, totalPages]);
  for (let i = Math.max(2, currentPage - 2); i <= Math.min(totalPages - 1, currentPage + 2); i++) pages.add(i);
  const sorted = Array.from(pages).sort((a, b) => a - b);
  const result = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) result.push('...');
    result.push(sorted[i]);
  }
  return result;
}

function PositionFormModal({ title, onClose, onSave, form, setForm, loading, isEdit = false }) {
  return (
    <div className="modal-overlay">
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <label>
            Title *
            <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </label>
          <label>
            Description *
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </label>
          <label>
            Team
            <input type="text" value={form.team} onChange={(e) => setForm({ ...form, team: e.target.value })} />
          </label>
          <label>
            Manager
            <input type="text" value={form.manager} onChange={(e) => setForm({ ...form, manager: e.target.value })} />
          </label>
          <label>
            Assigned To
            <input type="text" value={form.assigned_to} onChange={(e) => setForm({ ...form, assigned_to: e.target.value })} />
          </label>
          <label>
            Start Date
            <input
              type="date"
              value={form.start_date}
              disabled={isEdit}
              style={isEdit ? { background: '#f3f4f6', cursor: 'not-allowed' } : {}}
              onChange={isEdit ? undefined : (e) => setForm({ ...form, start_date: e.target.value })}
            />
          </label>
          {!isEdit && (
            <label>
              Status
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="on_hold">On Hold</option>
                <option value="closed">Closed</option>
              </select>
            </label>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={onSave} disabled={loading}>
            {loading ? 'Saving...' : 'Save Position'}
          </button>
        </div>
      </div>
    </div>
  );
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function PositionStatusModal({ position, onClose, onSave, setToast }) {
  const [status, setStatus] = useState(position.status || 'open');
  // Pre-fill existing hired-candidate data when position is already closed
  const [hiredName, setHiredName] = useState(position.hired_candidate_name || '');
  const [hiredEmail, setHiredEmail] = useState(position.hired_candidate_email || '');
  const [comment, setComment] = useState(position.status_comment || '');

  const isClosing = status === 'closed';

  const handleStatusChange = (newStatus) => {
    setStatus(newStatus);
    // Switching away from closed — clear the conditional fields
    if (newStatus !== 'closed') {
      setHiredName('');
      setHiredEmail('');
    }
  };

  const handleSave = () => {
    if (isClosing) {
      if (!hiredName.trim()) {
        setToast({ type: 'error', message: 'Hired candidate name is required when closing a position' });
        return;
      }
      if (!hiredEmail.trim()) {
        setToast({ type: 'error', message: 'Hired candidate email is required when closing a position' });
        return;
      }
      if (!EMAIL_PATTERN.test(hiredEmail.trim())) {
        setToast({ type: 'error', message: 'Please enter a valid email address' });
        return;
      }
    }
    onSave(status, hiredName, hiredEmail, comment);
  };

  const fieldStyle = {
    width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1',
    borderRadius: '6px', fontSize: '0.9rem',
  };

  return (
    <div className="modal-overlay">
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Update Position Status — {position.title}</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600' }}>Status:</label>
            <select value={status} onChange={(e) => handleStatusChange(e.target.value)} style={fieldStyle}>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="on_hold">On Hold</option>
              <option value="closed">Closed</option>
            </select>
          </div>

          {isClosing && (
            <>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600' }}>
                  Hired Candidate Name *
                </label>
                <input
                  type="text"
                  value={hiredName}
                  onChange={(e) => setHiredName(e.target.value)}
                  placeholder="Enter hired candidate name"
                  style={fieldStyle}
                />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600' }}>
                  Hired Candidate Email *
                </label>
                <input
                  type="email"
                  value={hiredEmail}
                  onChange={(e) => setHiredEmail(e.target.value)}
                  placeholder="Enter hired candidate email"
                  style={fieldStyle}
                />
              </div>
            </>
          )}

          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600' }}>Comments:</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add comments about this position status change..."
              rows={3}
              style={{ ...fieldStyle, resize: 'vertical' }}
            />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function PositionDetailsModal({ position, onClose }) {
  return (
    <div className="modal-overlay">
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{position.title}</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="position-details">
            <p><strong>Description:</strong> {position.description}</p>
            <p><strong>Team:</strong> {position.team || '-'}</p>
            <p><strong>Manager:</strong> {position.manager || '-'}</p>
            <p><strong>Assigned To:</strong> {position.assigned_to || '-'}</p>
            <p>
              <strong>Status:</strong>{' '}
              <span className={`badge badge-${position.status}`}>{formatStatus(position.status)}</span>
            </p>
            <p>
              <strong>Start Date:</strong>{' '}
              {position.start_date ? new Date(position.start_date).toLocaleDateString() : '-'}
            </p>
            <p><strong>Age:</strong> {position.age_days ?? 0} days</p>
            {position.hired_candidate_name && (
              <p>
                <strong>Hired Candidate:</strong> {position.hired_candidate_name}
                {position.hired_candidate_email && ` (${position.hired_candidate_email})`}
              </p>
            )}
            {position.status_comment && (
              <p><strong>Comments:</strong> {position.status_comment}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default PositionsPage;
