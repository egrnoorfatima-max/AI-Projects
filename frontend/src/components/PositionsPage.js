import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

function PositionsPage({ API_BASE, token, onError }) {
  const [jobDescriptions, setJobDescriptions] = useState([]);
  const [positionTab, setPositionTab] = useState('all');
  const [showPositionModal, setShowPositionModal] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [positionForm, setPositionForm] = useState({
    title: '',
    description: '',
    team: '',
    manager: '',
    assigned_to: '',
    start_date: '',
    status: 'open',
  });
  const [loading, setLoading] = useState(false);

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

  useEffect(() => {
    fetchPositions();
  }, [fetchPositions]);

  const handleCreatePosition = async () => {
    if (!positionForm.title.trim() || !positionForm.description.trim()) {
      onError('Title and description are required');
      return;
    }
    setLoading(true);
    try {
      const payload = {
        ...positionForm,
        start_date: positionForm.start_date || null,
      };
      await axios.post(`${API_BASE}/job-descriptions`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setShowPositionModal(false);
      setPositionForm({
        title: '',
        description: '',
        team: '',
        manager: '',
        assigned_to: '',
        start_date: '',
        status: 'open',
      });
      fetchPositions();
    } catch (err) {
      onError('Failed to create position: ' + (err.response?.data?.detail || err.message));
    }
    setLoading(false);
  };

  const filteredPositions =
    positionTab === 'all'
      ? jobDescriptions
      : jobDescriptions.filter((jd) => jd.status === positionTab);

  return (
    <div className="content">
      <div className="page">
        <div className="page-header">
          <h1>Positions</h1>
          <button className="btn btn-primary" onClick={() => setShowPositionModal(true)}>
            Add New Position
          </button>
        </div>

        <div className="tabs">
          <button
            className={`tab ${positionTab === 'all' ? 'active' : ''}`}
            onClick={() => setPositionTab('all')}
          >
            All ({jobDescriptions.length})
          </button>
          <button
            className={`tab ${positionTab === 'open' ? 'active' : ''}`}
            onClick={() => setPositionTab('open')}
          >
            Open ({jobDescriptions.filter((p) => p.status === 'open').length})
          </button>
          <button
            className={`tab ${positionTab === 'on_hold' ? 'active' : ''}`}
            onClick={() => setPositionTab('on_hold')}
          >
            On Hold ({jobDescriptions.filter((p) => p.status === 'on_hold').length})
          </button>
          <button
            className={`tab ${positionTab === 'closed' ? 'active' : ''}`}
            onClick={() => setPositionTab('closed')}
          >
            Closed ({jobDescriptions.filter((p) => p.status === 'closed').length})
          </button>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: '40px' }}>
                <input type="checkbox" />
              </th>
              <th>Title</th>
              <th>Team</th>
              <th>Manager</th>
              <th>Assigned To</th>
              <th>Status</th>
              <th>Start Date</th>
              <th>Age (days)</th>
              <th style={{ width: '50px' }}>⋯</th>
            </tr>
          </thead>
          <tbody>
            {filteredPositions.length === 0 ? (
              <tr>
                <td colSpan="9" style={{ textAlign: 'center', padding: '20px' }}>
                  No positions found
                </td>
              </tr>
            ) : (
              filteredPositions.map((position) => (
                <tr
                  key={position.id}
                  onClick={() => setSelectedPosition(position)}
                  className="table-row"
                >
                  <td>
                    <input type="checkbox" onClick={(e) => e.stopPropagation()} />
                  </td>
                  <td className="font-weight-600">{position.title}</td>
                  <td>{position.team || '-'}</td>
                  <td>{position.manager || '-'}</td>
                  <td>{position.assigned_to || '-'}</td>
                  <td>
                    <span
                      className={`badge badge-${position.status}`}
                    >
                      {position.status}
                    </span>
                  </td>
                  <td>
                    {position.start_date
                      ? new Date(position.start_date).toLocaleDateString()
                      : '-'}
                  </td>
                  <td>{position.age_days ?? '-'}</td>
                  <td>⋯</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* MODALS */}
      {showPositionModal && (
        <PositionModal
          onClose={() => setShowPositionModal(false)}
          onSave={handleCreatePosition}
          form={positionForm}
          setForm={setPositionForm}
          loading={loading}
        />
      )}

      {selectedPosition && (
        <PositionDetailsModal
          position={selectedPosition}
          onClose={() => setSelectedPosition(null)}
        />
      )}
    </div>
  );
}

function PositionModal({ onClose, onSave, form, setForm, loading }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add Position</h2>
          <button className="close-btn" onClick={onClose}>
            X
          </button>
        </div>
        <div className="modal-body">
          <label>
            Title *
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </label>
          <label>
            Description *
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </label>
          <label>
            Team
            <input
              type="text"
              value={form.team}
              onChange={(e) => setForm({ ...form, team: e.target.value })}
            />
          </label>
          <label>
            Manager
            <input
              type="text"
              value={form.manager}
              onChange={(e) => setForm({ ...form, manager: e.target.value })}
            />
          </label>
          <label>
            Assigned To
            <input
              type="text"
              value={form.assigned_to}
              onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}
            />
          </label>
          <label>
            Start Date
            <input
              type="date"
              value={form.start_date}
              onChange={(e) => setForm({ ...form, start_date: e.target.value })}
            />
          </label>
          <label>
            Status
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              <option value="open">Open</option>
              <option value="on_hold">On Hold</option>
              <option value="closed">Closed</option>
            </select>
          </label>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={onSave} disabled={loading}>
            {loading ? 'Saving...' : 'Save Position'}
          </button>
        </div>
      </div>
    </div>
  );
}

function PositionDetailsModal({ position, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{position.title}</h2>
          <button className="close-btn" onClick={onClose}>
            X
          </button>
        </div>
        <div className="modal-body">
          <div className="position-details">
            <p>
              <strong>Description:</strong> {position.description}
            </p>
            <p>
              <strong>Team:</strong> {position.team || '-'}
            </p>
            <p>
              <strong>Manager:</strong> {position.manager || '-'}
            </p>
            <p>
              <strong>Assigned To:</strong> {position.assigned_to || '-'}
            </p>
            <p>
              <strong>Status:</strong>{' '}
              <span className={`badge badge-${position.status}`}>
                {position.status}
              </span>
            </p>
            <p>
              <strong>Start Date:</strong>{' '}
              {position.start_date
                ? new Date(position.start_date).toLocaleDateString()
                : '-'}
            </p>
            <p>
              <strong>Age:</strong> {position.age_days ?? 0} days
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PositionsPage;