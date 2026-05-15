import React, { useState } from 'react';

function Header({ adminEmail, onLogout }) {
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  return (
    <header className="header">
      <div className="header-left">
        <input type="text" className="header-search" placeholder="Search..." />
      </div>
      <div className="header-right">
        <button className="notification-icon">🔔</button>
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
              <button onClick={onLogout}>Logout</button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default Header;