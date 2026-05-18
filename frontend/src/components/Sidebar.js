import React from 'react';

function Sidebar({ currentPage, setCurrentPage }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <img src="/hireiq-logo-dark.svg" alt="HireIQ" height="36" style={{ width: 'auto' }} />        
      </div>
      <nav className="sidebar-nav">
        <button
          className={`nav-item ${currentPage === 'dashboard' ? 'active' : ''}`}
          onClick={() => setCurrentPage('dashboard')}
        >
          <span>Dashboard</span>
        </button>
        <button
          className={`nav-item ${currentPage === 'applicants' ? 'active' : ''}`}
          onClick={() => setCurrentPage('applicants')}
        >
          <span>Applicants</span>
        </button>
        <button
          className={`nav-item ${currentPage === 'positions' ? 'active' : ''}`}
          onClick={() => setCurrentPage('positions')}
        >
          
          <span>Positions</span>
        </button>
        <button className="nav-item disabled" disabled>
         
          <span>Reports</span>
        </button>
        <button
          className={`nav-item ${currentPage === 'settings' ? 'active' : ''}`}
          onClick={() => setCurrentPage('settings')}
        >
          <span>Settings</span>
        </button>
      </nav>
    </aside>
  );
}

export default Sidebar;