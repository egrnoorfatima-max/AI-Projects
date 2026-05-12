import React from 'react';

function Sidebar({ currentPage, setCurrentPage }) {
  return (
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
  );
}

export default Sidebar;