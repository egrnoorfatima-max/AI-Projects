import React, { useState } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  const [file, setFile] = useState(null);
  const [parsedData, setParsedData] = useState(null);
  const [jdText, setJdText] = useState('');
  const [matchResult, setMatchResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleParseResume = async () => {
    if (!file) return;
    setLoading(true);
    setError('');
    const formData = new FormData();
    formData.append('file', file);
    try {
      const response = await axios.post('http://localhost:8000/parse-resume', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setParsedData(response.data);
    } catch (err) {
      setError('Failed to parse resume: ' + err.message);
    }
    setLoading(false);
  };

  const handleMatchJD = async () => {
    if (!parsedData || !jdText) return;
    setLoading(true);
    setError('');
    try {
      const response = await axios.post('http://localhost:8000/match-jd', {
        resume_data: parsedData,
        jd_text: jdText
      });
      setMatchResult(response.data);
    } catch (err) {
      setError('Failed to match JD: ' + err.message);
    }
    setLoading(false);
  };

  return (
    <div className="app">
      <h1>Resume Parser</h1>
      
      <div className="section">
        <h2>Resume Upload</h2>
        <input type="file" accept=".pdf" onChange={handleFileChange} />
        <button onClick={handleParseResume} disabled={!file || loading}>Parse Resume</button>
        
        {parsedData && (
          <div className="parsed-data">
            <div className="card">
              <h3>{parsedData.name}</h3>
              <p><strong>Email:</strong> {parsedData.email}</p>
              <p><strong>Phone:</strong> {parsedData.phone}</p>
              <p><strong>Location:</strong> {parsedData.location}</p>
              <p><strong>Experience:</strong> {parsedData.total_years_experience} years</p>
              <p><strong>Current Role:</strong> {parsedData.current_role}</p>
              <p><strong>Current Company:</strong> {parsedData.current_company}</p>
              <div className="skills">
                <strong>Skills:</strong>
                {parsedData.skills.map(skill => <span key={skill} className="badge">{skill}</span>)}
              </div>
              <div className="education">
                <strong>Education:</strong>
                {parsedData.education.map((edu, idx) => (
                  <div key={idx}>{edu.degree} from {edu.institution} ({edu.year})</div>
                ))}
              </div>
              <div className="employment">
                <strong>Employment History:</strong>
                {parsedData.employment_history.map((job, idx) => (
                  <div key={idx}>{job.role} at {job.company} ({job.duration}) - {job.type}</div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
      
      <div className="section">
        <h2>JD Matching</h2>
        <textarea 
          placeholder="Paste job description here..." 
          value={jdText} 
          onChange={(e) => setJdText(e.target.value)} 
        />
        <button onClick={handleMatchJD} disabled={!parsedData || !jdText || loading}>Match JD</button>
        
        {matchResult && (
          <div className="match-results">
            <div className="overall-score">
              <div className="score-circle">{matchResult.overall_score}</div>
              <p>Overall Score</p>
            </div>
            
            <div className="score-breakdown">
              <h4>Score Breakdown</h4>
              <div className="progress-bar">
                <label>Skills: {matchResult.score_breakdown.skills_match}%</label>
                <div className="bar" style={{width: `${matchResult.score_breakdown.skills_match}%`}}></div>
              </div>
              <div className="progress-bar">
                <label>Experience: {matchResult.score_breakdown.experience_match}%</label>
                <div className="bar" style={{width: `${matchResult.score_breakdown.experience_match}%`}}></div>
              </div>
              <div className="progress-bar">
                <label>Education: {matchResult.score_breakdown.education_match}%</label>
                <div className="bar" style={{width: `${matchResult.score_breakdown.education_match}%`}}></div>
              </div>
              <div className="progress-bar">
                <label>Seniority: {matchResult.score_breakdown.seniority_match}%</label>
                <div className="bar" style={{width: `${matchResult.score_breakdown.seniority_match}%`}}></div>
              </div>
            </div>
            
            <div className="skills-section">
              <div className="matching-skills">
                <strong>Matching Skills:</strong>
                {matchResult.matching_skills.map(skill => <span key={skill} className="badge green">{skill}</span>)}
              </div>
              <div className="missing-skills">
                <strong>Missing Skills:</strong>
                {matchResult.missing_skills.map(skill => <span key={skill} className="badge red">{skill}</span>)}
              </div>
            </div>
            
            <div className="scorecard">
              <h4>Scorecard</h4>
              <table>
                <tbody>
                  {Object.entries(matchResult.scorecard).map(([key, value]) => (
                    <tr key={key}>
                      <td>{key.replace('_', ' ')}</td>
                      <td className={`rating ${value.rating.toLowerCase()}`}>{value.rating}</td>
                      <td>{value.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="recommendation">
              <div className={`banner ${matchResult.hire_recommendation.replace(' ', '-').toLowerCase()}`}>
                {matchResult.hire_recommendation}
              </div>
              <p><strong>Summary:</strong> {matchResult.summary}</p>
              <p><strong>Reason:</strong> {matchResult.recommendation_reason}</p>
            </div>
          </div>
        )}
      </div>
      
      {loading && <div className="spinner">Loading...</div>}
      {error && <div className="error">{error}</div>}
    </div>
  );
}

export default App;