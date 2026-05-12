import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './App.css';

const API_BASE = 'http://localhost:8000';

function App() {
  const [currentPage, setCurrentPage] = useState('applicants');
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem('token'));
  const [adminEmail, setAdminEmail] = useState(localStorage.getItem('adminEmail'));
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [candidates, setCandidates] = useState([]);
  const [jobDescriptions, setJobDescriptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Modal states
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showPositionModal, setShowPositionModal] = useState(false);
  const [showCandidateModal, setShowCandidateModal] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  
  // Data states
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [uploadFile, setUploadFile] = useState(null);
  const [positionTab, setPositionTab] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [positionForm, setPositionForm] = useState({
    title: '',
    description: '',
    team: '',
    manager: '',
    assigned_to: '',
    start_date: '',
    status: 'open',
  });

  useEffect(() => {
    if (!token) {
      return;
    }
    fetchData();
  }, [token, currentPage]);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      if (currentPage === 'applicants') {
        const response = await axios.get(`${API_BASE}/candidates`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setCandidates(response.data || []);
      } else if (currentPage === 'positions') {
        const response = await axios.get(`${API_BASE}/job-descriptions`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setJobDescriptions(response.data || []);
      }
    } catch (err) {
      setError('Failed to load data: ' + (err.response?.data?.detail || err.message));
    }
    setLoading(false);
  };

  const handleUploadResume = async () => {
    if (!uploadFile) {
      setError('Please select a file');
      return;
    }
    setLoading(true);
    const formData = new FormData();
    formData.append('file', uploadFile);
    try {
      await axios.post(`${API_BASE}/parse-resume`, formData, {
        headers: { 'Content-Type': 'multipart/form-data', Authorization: `Bearer ${token}` },
      });
      setShowUploadModal(false);
      setUploadFile(null);
      fetchData();
    } catch (err) {
      setError('Upload failed: ' + (err.response?.data?.detail || err.message));
    }
    setLoading(false);
  };

  const handleCreatePosition = async () => {
    if (!positionForm.title.trim() || !positionForm.description.trim()) {
      setError('Title and description are required');
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
      fetchData();
    } catch (err) {
      setError('Failed to create position: ' + (err.response?.data?.detail || err.message));
    }
    setLoading(false);
  };

  const resetAppState = () => {
    setCurrentPage('applicants');
    setCandidates([]);
    setJobDescriptions([]);
    setShowUploadModal(false);
    setShowPositionModal(false);
    setShowCandidateModal(false);
    setShowProfileMenu(false);
    setSelectedCandidate(null);
    setSelectedPosition(null);
    setUploadFile(null);
    setPositionTab('all');
    setSearchTerm('');
    setPositionForm({
      title: '',
      description: '',
      team: '',
      manager: '',
      assigned_to: '',
      start_date: '',
      status: 'open',
    });
    setError('');
  };

  const handleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await axios.post(
        `${API_BASE}/login`,
        new URLSearchParams({
          username: loginEmail,
          password: loginPassword,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      const accessToken = response.data?.access_token;
      if (!accessToken) {
        throw new Error('Login failed, no token returned');
      }

      localStorage.setItem('token', accessToken);
      localStorage.setItem('adminEmail', loginEmail);
      setToken(accessToken);
      setAdminEmail(loginEmail);
      setIsLoggedIn(true);
      setCurrentPage('applicants');
      setLoginPassword('');
      setLoading(false);
    } catch (err) {
      setError('Login failed: ' + (err.response?.data?.detail || err.message));
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('adminEmail');
    setToken(null);
    setAdminEmail(null);
    setIsLoggedIn(false);
    resetAppState();
  };

  const filteredCandidates = candidates.filter((c) =>
    c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredPositions =
    positionTab === 'all'
      ? jobDescriptions
      : jobDescriptions.filter((jd) => jd.status === positionTab);

  if (!isLoggedIn) {
    return (
      <LoginPage
        email={loginEmail}
        password={loginPassword}
        setEmail={setLoginEmail}
        setPassword={setLoginPassword}
        onLogin={handleLogin}
        loading={loading}
        error={error}
      />
    );
  }

  return (
    <div className="app-container">
      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-icon">RP</div>
          <span>Resume Parser</span>
        </div>
        <nav className="sidebar-nav">
          <button className="nav-item disabled" disabled>
            <span className="nav-icon">⬜⬜</span>
            <span>Dashboard</span>
          </button>
          <button
            className={`nav-item ${currentPage === 'applicants' ? 'active' : ''}`}
            onClick={() => setCurrentPage('applicants')}
          >
            <span className="nav-icon">👥</span>
            <span>Applicants</span>
          </button>
          <button
            className={`nav-item ${currentPage === 'positions' ? 'active' : ''}`}
            onClick={() => setCurrentPage('positions')}
          >
            <span className="nav-icon">💼</span>
            <span>Positions</span>
          </button>
          <button className="nav-item disabled" disabled>
            <span className="nav-icon">📊</span>
            <span>Reports</span>
          </button>
          <button className="nav-item disabled" disabled>
            <span className="nav-icon">⚙️</span>
            <span>Settings</span>
          </button>
        </nav>
      </aside>

      {/* MAIN CONTENT */}
      <div className="main-content">
        {/* HEADER */}
        <header className="header">
          <div className="header-search">
            <input type="text" placeholder="Search..." readOnly />
          </div>
          <div className="header-right">
            <button className="header-icon">🔔</button>
            <div className="profile-section">
              <button
                className="profile-button"
                onClick={() => setShowProfileMenu(!showProfileMenu)}
              >
                <span className="profile-avatar">
                  {adminEmail?.[0]?.toUpperCase() || 'A'}
                </span>
                <span className="profile-email">{adminEmail || 'Admin'}</span>
              </button>
              {showProfileMenu && (
                <div className="profile-menu">
                  <button onClick={handleLogout}>Logout</button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* CONTENT AREA */}
        <div className="content">
          {currentPage === 'applicants' && (
            <ApplicantsPage
              candidates={filteredCandidates}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              onUploadClick={() => setShowUploadModal(true)}
              onRowClick={(candidate) => {
                setSelectedCandidate(candidate);
                setShowCandidateModal(true);
              }}
            />
          )}

          {currentPage === 'positions' && (
            <PositionsPage
              positions={filteredPositions}
              tab={positionTab}
              setTab={setPositionTab}
              onAddClick={() => setShowPositionModal(true)}
              onRowClick={(position) => {
                setSelectedPosition(position);
                setShowCandidateModal(true);
              }}
              allPositions={jobDescriptions}
            />
          )}

          {error && <div className="error-banner">{error}</div>}
        </div>
      </div>

      {/* MODALS */}
      {showUploadModal && (
        <UploadResumeModal
          onClose={() => setShowUploadModal(false)}
          onUpload={handleUploadResume}
          file={uploadFile}
          setFile={setUploadFile}
          loading={loading}
        />
      )}

      {showPositionModal && (
        <PositionModal
          onClose={() => setShowPositionModal(false)}
          onSave={handleCreatePosition}
          form={positionForm}
          setForm={setPositionForm}
          loading={loading}
        />
      )}

      {showCandidateModal && selectedCandidate && (
        <CandidateDetailsModal
          candidate={selectedCandidate}
          onClose={() => {
            setShowCandidateModal(false);
            setSelectedCandidate(null);
          }}
        />
      )}

      {showCandidateModal && selectedPosition && (
        <PositionDetailsModal
          position={selectedPosition}
          onClose={() => {
            setShowCandidateModal(false);
            setSelectedPosition(null);
          }}
        />
      )}
    </div>
  );
}

// PAGES
function ApplicantsPage({ candidates, searchTerm, setSearchTerm, onUploadClick, onRowClick }) {
  return (
    <div className="page">
      <div className="page-header">
        <h1>Applicants</h1>
        <button className="btn btn-primary" onClick={onUploadClick}>
          Upload New Resume
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
            candidates.map((candidate) => (
              <tr key={candidate.id} onClick={() => onRowClick(candidate)} className="table-row">
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
  );
}

function PositionsPage({ positions, tab, setTab, onAddClick, onRowClick, allPositions }) {
  return (
    <div className="page">
      <div className="page-header">
        <h1>Positions</h1>
        <button className="btn btn-primary" onClick={onAddClick}>
          Add New Position
        </button>
      </div>

      <div className="tabs">
        <button
          className={`tab ${tab === 'all' ? 'active' : ''}`}
          onClick={() => setTab('all')}
        >
          All ({allPositions.length})
        </button>
        <button
          className={`tab ${tab === 'open' ? 'active' : ''}`}
          onClick={() => setTab('open')}
        >
          Open ({allPositions.filter((p) => p.status === 'open').length})
        </button>
        <button
          className={`tab ${tab === 'on_hold' ? 'active' : ''}`}
          onClick={() => setTab('on_hold')}
        >
          On Hold ({allPositions.filter((p) => p.status === 'on_hold').length})
        </button>
        <button
          className={`tab ${tab === 'closed' ? 'active' : ''}`}
          onClick={() => setTab('closed')}
        >
          Closed ({allPositions.filter((p) => p.status === 'closed').length})
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
          {positions.length === 0 ? (
            <tr>
              <td colSpan="9" style={{ textAlign: 'center', padding: '20px' }}>
                No positions found
              </td>
            </tr>
          ) : (
            positions.map((position) => (
              <tr
                key={position.id}
                onClick={() => onRowClick(position)}
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
  );
}

// MODALS
function UploadResumeModal({ onClose, onUpload, file, setFile, loading }) {
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
          <input
            type="file"
            accept=".pdf"
            onChange={(e) => setFile(e.target.files[0])}
          />
          {file && <p>Selected: {file.name}</p>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={onUpload} disabled={!file || loading}>
            {loading ? 'Uploading...' : 'Upload'}
          </button>
        </div>
      </div>
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

function LoginPage({ email, password, setEmail, setPassword, onLogin, loading, error }) {
  return (
    <div className="login-page">
      <div className="login-card">
        <h2>Recruiter Login</h2>
        {error && <div className="login-error">{error}</div>}
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
          />
        </label>
        <button className="btn btn-primary" onClick={onLogin} disabled={loading || !email || !password}>
          {loading ? 'Signing in...' : 'Login'}
        </button>
      </div>
    </div>
  );
}

export default App;
