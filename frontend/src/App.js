import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './App.css';

const API_BASE = 'https://ai-projects-jj5i.onrender.com';
//const API_BASE = 'http://localhost:8000';

function App() {
  const [activeTab, setActiveTab] = useState('jobs');
  const [jds, setJds] = useState([]);
  const [jobTitle, setJobTitle] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [selectedJdId, setSelectedJdId] = useState(null);
  const [file, setFile] = useState(null);
  const [parsedData, setParsedData] = useState(null);
  const [candidateId, setCandidateId] = useState(null);
  const [matchResult, setMatchResult] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchJobDescriptions();
    if (activeTab === 'candidates') {
      fetchCandidates();
    }
  }, [activeTab]);

  const fetchJobDescriptions = async () => {
    try {
      const response = await axios.get(`${API_BASE}/job-descriptions`);
      setJds(response.data || []);
    } catch (err) {
      setError('Unable to load job descriptions.');
    }
  };

  const fetchCandidates = async () => {
    try {
      const response = await axios.get(`${API_BASE}/candidates`);
      setCandidates(response.data || []);
    } catch (err) {
      setError('Unable to load candidates.');
    }
  };

  const handleCreateJD = async () => {
    if (!jobTitle.trim() || !jobDescription.trim()) {
      setError('Title and description are required.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await axios.post(`${API_BASE}/job-descriptions`, {
        title: jobTitle,
        description: jobDescription,
      });
      setJds([response.data, ...jds]);
      setJobTitle('');
      setJobDescription('');
      setSelectedJdId(response.data.id);
    } catch (err) {
      setError('Failed to create job description.');
    }

    setLoading(false);
  };

  const handleFileChange = (event) => {
    setFile(event.target.files[0]);
  };

  const handleParseResume = async () => {
    if (!file) {
      setError('Please select a PDF file first.');
      return;
    }

    setLoading(true);
    setError('');
    setMatchResult(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post(`${API_BASE}/parse-resume`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setParsedData(response.data);
      setCandidateId(response.data.id);
      setError('');
    } catch (err) {
      setError('Failed to parse resume: ' + (err.response?.data?.detail || err.message));
    }

    setLoading(false);
  };

  const handleMatchJD = async () => {
    if (!parsedData || !selectedJdId) {
      setError('Please parse a resume and select a job description.');
      return;
    }

    const selectedJD = jds.find((job) => job.id === selectedJdId);
    if (!selectedJD) {
      setError('Selected job description is not available.');
      return;
    }

    setLoading(true);
    setError('');
    setMatchResult(null);

    try {
      const response = await axios.post(`${API_BASE}/match-jd`, {
        candidate_id: candidateId,
        jd_id: selectedJdId,
        resume_data: parsedData,
        jd_text: selectedJD.description,
      });
      setMatchResult(response.data);
    } catch (err) {
      setError('Failed to match JD: ' + (err.response?.data?.detail || err.message));
    }

    setLoading(false);
  };

  const filteredCandidates = candidates.filter((candidate) => {
    const term = searchTerm.toLowerCase();
    return (
      candidate.name?.toLowerCase().includes(term) ||
      candidate.email?.toLowerCase().includes(term)
    );
  });

  const selectedJD = jds.find((job) => job.id === selectedJdId);

  return (
    <div className="app">
      <h1>Resume Parser Dashboard</h1>

      <div className="tabs">
        <button
          className={`tab-button ${activeTab === 'jobs' ? 'active' : ''}`}
          onClick={() => setActiveTab('jobs')}
        >
          Job Descriptions
        </button>
        <button
          className={`tab-button ${activeTab === 'upload' ? 'active' : ''}`}
          onClick={() => setActiveTab('upload')}
        >
          Upload & Match Resume
        </button>
        <button
          className={`tab-button ${activeTab === 'candidates' ? 'active' : ''}`}
          onClick={() => setActiveTab('candidates')}
        >
          All Candidates
        </button>
      </div>

      {activeTab === 'jobs' && (
        <div className="section">
          <h2>Job Descriptions Management</h2>
          <div className="form-grid">
            <input
              type="text"
              placeholder="Job title"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
            />
            <textarea
              placeholder="Job description"
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
            />
            <button onClick={handleCreateJD} disabled={loading}>
              Create Job Description
            </button>
          </div>

          <div className="list-grid">
            {jds.length === 0 ? (
              <p>No active job descriptions available.</p>
            ) : (
              jds.map((job) => (
                <div
                  key={job.id}
                  className={`card jd-card ${selectedJdId === job.id ? 'selected' : ''}`}
                  onClick={() => setSelectedJdId(job.id)}
                >
                  <h3>{job.title}</h3>
                  <p>{job.description.length > 100 ? `${job.description.slice(0, 100)}...` : job.description}</p>
                  <p className="muted">Created: {new Date(job.created_at).toLocaleDateString()}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === 'upload' && (
        <div className="section">
          <h2>Upload & Match Resume</h2>
          <input type="file" accept=".pdf" onChange={handleFileChange} />
          <button onClick={handleParseResume} disabled={!file || loading}>
            Parse Resume
          </button>

          {parsedData && (
            <div className="card parsed-card">
              <h3>{parsedData.name}</h3>
              <p><strong>Email:</strong> {parsedData.email}</p>
              <p><strong>Phone:</strong> {parsedData.phone}</p>
              <p><strong>Location:</strong> {parsedData.location}</p>
              <p><strong>Experience:</strong> {parsedData.total_years_experience} years</p>
              <p><strong>Current Role:</strong> {parsedData.current_role}</p>
              <p><strong>Company:</strong> {parsedData.current_company}</p>
              <div className="skills">
                <strong>Skills:</strong>
                {parsedData.skills?.map((skill) => (
                  <span key={skill} className="badge">{skill}</span>
                ))}
              </div>
            </div>
          )}

          <div className="form-grid">
            <select
              value={selectedJdId || ''}
              onChange={(e) => setSelectedJdId(Number(e.target.value))}
            >
              <option value="">Select a job description</option>
              {jds.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.title}
                </option>
              ))}
            </select>
            <button
              onClick={handleMatchJD}
              disabled={!parsedData || !selectedJdId || loading}
            >
              Match Resume to JD
            </button>
          </div>

          {selectedJD && (
            <div className="card jd-preview">
              <h4>Selected JD</h4>
              <p><strong>{selectedJD.title}</strong></p>
              <p>{selectedJD.description}</p>
            </div>
          )}

          {matchResult && (
            <div className="match-results">
              <div className="overall-score">
                <div className="score-circle">{matchResult.overall_score}</div>
                <p>Overall Score</p>
              </div>

              <div className="score-breakdown">
                <h4>Score Breakdown</h4>
                {['skills_match','experience_match','education_match','seniority_match'].map((key) => (
                  <div className="progress-bar" key={key}>
                    <label>{key.replace('_', ' ')}: {matchResult.score_breakdown?.[key]}%</label>
                    <div className="bar" style={{ width: `${matchResult.score_breakdown?.[key] || 0}%` }} />
                  </div>
                ))}
              </div>

              <div className="skills-section">
                <div>
                  <strong>Matching Skills:</strong>
                  {matchResult.matching_skills?.map((skill) => (
                    <span key={skill} className="badge green">{skill}</span>
                  ))}
                </div>
                <div>
                  <strong>Missing Skills:</strong>
                  {matchResult.missing_skills?.map((skill) => (
                    <span key={skill} className="badge red">{skill}</span>
                  ))}
                </div>
                <div>
                  <strong>Bonus Skills:</strong>
                  {matchResult.bonus_skills?.map((skill) => (
                    <span key={skill} className="badge">{skill}</span>
                  ))}
                </div>
              </div>

              <div className="scorecard">
                <h4>Scorecard</h4>
                <table>
                  <tbody>
                    {matchResult.scorecard && Object.entries(matchResult.scorecard).map(([key, value]) => (
                      <tr key={key}>
                        <td>{key.replace('_', ' ')}</td>
                        <td className={`rating ${value.rating?.toLowerCase()}`}>
                          {value.rating}
                        </td>
                        <td>{value.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="recommendation">
                <div className={`banner ${matchResult.hire_recommendation?.replace(' ', '-').toLowerCase()}`}>
                  {matchResult.hire_recommendation}
                </div>
                <p><strong>Summary:</strong> {matchResult.summary}</p>
                <p><strong>Reason:</strong> {matchResult.recommendation_reason}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'candidates' && (
        <div className="section">
          <h2>All Candidates</h2>
          <input
            type="text"
            placeholder="Search by name or email"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <div className="list-grid">
            {filteredCandidates.length === 0 ? (
              <p>No candidates found.</p>
            ) : (
              filteredCandidates.map((candidate) => (
                <div key={candidate.id} className="card candidate-card">
                  <h3>{candidate.name}</h3>
                  <p><strong>Email:</strong> {candidate.email}</p>
                  <p><strong>Role:</strong> {candidate.current_role}</p>
                  <p><strong>Uploaded:</strong> {new Date(candidate.uploaded_at).toLocaleString()}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {loading && <div className="spinner">Loading...</div>}
      {error && <div className="error">{error}</div>}
    </div>
  );
}

export default App;
