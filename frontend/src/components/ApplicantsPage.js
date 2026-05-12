import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

function ApplicantsPage({ API_BASE, token, onError }) {
  const [candidates, setCandidates] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [uploadFile, setUploadFile] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [positions, setPositions] = useState([]);
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

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
  }, [fetchCandidates]);

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

  const handleUploadResume = async () => {
    if (!uploadFile) {
      onError('Please select a file');
      return;
    }
    if (!selectedPosition) {
      onError('Please select a position');
      return;
    }

    const fileToUpload = uploadFile;
    const jdToMatch = selectedPosition;
    setShowUploadModal(false);
    setUploadFile(null);
    setSelectedPosition(null);
    setProcessing(true);
    setStatusMessage('Processing...');
    setSuccessMessage('');

    try {
      const formData = new FormData();
      formData.append('file', fileToUpload);

      const parseResponse = await axios.post(`${API_BASE}/parse-resume`, formData, {
        headers: { 'Content-Type': 'multipart/form-data', Authorization: `Bearer ${token}` },
      });

      if (!parseResponse?.data?.id) {
        throw new Error('Invalid parse response');
      }

      setStatusMessage('Matching against position...');
      try {
        await axios.post(`${API_BASE}/match-jd`, {
          candidate_id: parseResponse.data.id,
          jd_id: jdToMatch.id,
          resume_data: parseResponse.data,
          jd_text: jdToMatch.description,
        }, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setSuccessMessage('Resume uploaded and matched successfully.');
      } catch (matchError) {
        onError('Resume saved but matching failed');
      }
    } catch (parseError) {
      onError('Failed to parse resume');
    } finally {
      setStatusMessage('Refreshing applicants...');
      await fetchCandidates();
      setProcessing(false);
      setStatusMessage('');
    }
  };

  const filteredCandidates = candidates.filter((c) =>
    c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="content">
      <div className="page">
        <div className="page-header">
          <h1>Applicants</h1>
          <button
            className="btn btn-primary"
            onClick={() => {
              setShowUploadModal(true);
              fetchPositions();
            }}
            disabled={processing}
          >
            Upload New Resume
          </button>
        </div>

        {processing && (
          <div className="status-banner">{statusMessage || 'Processing... Please wait.'}</div>
        )}
        {successMessage && (
          <div className="success-banner">{successMessage}</div>
        )}

        <div className="page-controls">
          <input
            type="text"
            placeholder="Search candidates..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: '40px' }}>
                <input type="checkbox" />
              </th>
              <th style={{ width: '40px' }}>Photo</th>
              <th>Name</th>
              <th>Current Role</th>
              <th>Email</th>
              <th>Location</th>
              <th>Applied</th>
              <th style={{ width: '50px' }}>⋯</th>
            </tr>
          </thead>
          <tbody>
            {candidates.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '20px' }}>
                  No applicants found
                </td>
              </tr>
            ) : (
              filteredCandidates.map((candidate) => (
                <tr key={candidate.id} onClick={() => setSelectedCandidate(candidate)} className="table-row">
                  <td>
                    <input type="checkbox" onClick={(e) => e.stopPropagation()} />
                  </td>
                  <td>
                    <div className="avatar">{candidate.name?.[0]?.toUpperCase()}</div>
                  </td>
                  <td className="font-weight-600">{candidate.name}</td>
                  <td>{candidate.current_role}</td>
                  <td>{candidate.email}</td>
                  <td>{candidate.location}</td>
                  <td>{new Date(candidate.uploaded_at).toLocaleDateString()}</td>
                  <td>⋯</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* MODALS */}
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

      {selectedCandidate && (
        <CandidateDetailsModal
          candidate={selectedCandidate}
          onClose={() => setSelectedCandidate(null)}
        />
      )}
    </div>
  );
}

function UploadResumeModal({ onClose, onUpload, file, setFile, positions, selectedPosition, setSelectedPosition }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Upload Resume</h2>
          <button className="close-btn" onClick={onClose}>
            X
          </button>
        </div>
        <div className="modal-body">
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              Select Resume File:
            </label>
            <input
              type="file"
              accept=".pdf"
              onChange={(e) => setFile(e.target.files[0])}
            />
            {file && <p style={{ marginTop: '5px', color: '#666' }}>Selected: {file.name}</p>}
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
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={onUpload} disabled={!file || !selectedPosition}>
            Save
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
          <button className="close-btn" onClick={onClose}>
            X
          </button>
        </div>
        <div className="modal-body">
          <div className="candidate-details">
            <p>
              <strong>Email:</strong> {candidate.email}
            </p>
            <p>
              <strong>Phone:</strong> {candidate.phone}
            </p>
            <p>
              <strong>Location:</strong> {candidate.location}
            </p>
            <p>
              <strong>Experience:</strong> {candidate.total_years_experience} years
            </p>
            <p>
              <strong>Current Role:</strong> {candidate.current_role}
            </p>
            <p>
              <strong>Company:</strong> {candidate.current_company}
            </p>
            <div>
              <strong>Skills:</strong>
              {candidate.skills?.map((skill) => (
                <span key={skill} className="badge badge-skill">
                  {skill}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ApplicantsPage;