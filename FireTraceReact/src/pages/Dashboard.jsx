import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../style.css';
import { apiFetch } from '../api';
import { clearTokens, isLoggedIn } from '../auth';
import CivHeader from '../components/CivHeader';
import { BFP_HOTLINE, BFP_HOTLINE_DISPLAY } from '../lib/contacts';

function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  useEffect(() => {
    if (!isLoggedIn()) {
      navigate('/login');
      return;
    }

    // Fetch user data
    apiFetch('/accounts/me')
      .then((profile) => {
        // A remembered BFP session lands here first; send it to the portal.
        if (profile.user_type === 'bfp') {
          navigate('/bfp', { replace: true });
          return;
        }
        setUser(profile);
      })
      .catch(() => {
        clearTokens();
        navigate('/login');
      });
  }, [navigate]);

  if (!user) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p className="dashboard-text">Loading your dashboard...</p>
      </div>
    );
  }

  const userDisplayName = user.first_name ? user.first_name.split(' ')[0] : user.username;

  return (
    <div className="civilian-dashboard civ-home-page">
      <CivHeader bell />

      {/* Welcome Card */}
      <section className="civ-welcome-section">
        <div className="civ-welcome-card">
          <div className="civ-welcome-top">
            <div className="civ-avatar">
              {user.email ? user.email.charAt(0).toUpperCase() : userDisplayName.charAt(0).toUpperCase()}
            </div>
            <div className="civ-welcome-text">
              <h1 className="civ-greeting">GOOD DAY,<br/>{user.email}</h1>
              <div className="civ-verified-badge">
                <i className="fa-solid fa-shield-halved"></i>
                <span>VERIFIED CIVILIAN</span>
              </div>
            </div>
          </div>
          <div className="civ-welcome-accent"></div>
        </div>
      </section>

      {/* Safety Message */}
      <section className="civ-safety-message">
        <div className="civ-safety-icon">
          <i className="fa-solid fa-shield-exclamation"></i>
        </div>
        <div className="civ-safety-content">
          <h2>YOUR SAFETY MATTERS</h2>
          <p>In case of emergency, help is just a report away.</p>
        </div>
      </section>

      {/* Main Content */}
      <div className="civ-main-content">
        {/* Safety Actions Section */}
        <section className="civ-safety-actions">
          <h2 className="civ-section-title">Safety Actions</h2>
          
          {/* Submit Report Card */}
          <Link to="/report" className="civ-action-card civ-action-primary">
            <div className="civ-action-icon">
              <i className="fa-solid fa-fire"></i>
            </div>
            <div className="civ-action-content">
              <div className="civ-action-main">
                <h3>Submit Fire Report</h3>
                <p>Report an active fire incident</p>
              </div>
              <div className="civ-action-badge">QUICK & SECURE</div>
            </div>
            <i className="fa-solid fa-chevron-right civ-action-arrow"></i>
          </Link>

          {/* Call BFP Card */}
          <a href={`tel:${BFP_HOTLINE}`} className="civ-action-card civ-action-secondary">
            <div className="civ-action-icon">
              <i className="fa-solid fa-phone"></i>
            </div>
            <div className="civ-action-content">
              <div className="civ-action-main">
                <h3>Call BFP Calapan</h3>
                <p>{BFP_HOTLINE_DISPLAY}</p>
              </div>
              <div className="civ-action-badge civ-action-badge-secondary">24/7 AVAILABLE</div>
            </div>
            <i className="fa-solid fa-chevron-right civ-action-arrow"></i>
          </a>
        </section>
      </div>
    </div>
  );
}

export default Dashboard;
