import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../style.css';
import { API_BASE_URL } from '../api';

function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [latestReport, setLatestReport] = useState(null);

  useEffect(() => {
    const access = localStorage.getItem('access');
    if (!access) {
      navigate('/login');
      return;
    }
    fetch(`${API_BASE_URL}/accounts/me`, {
      headers: { Authorization: 'Bearer ' + access },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Session expired');
        return res.json();
      })
      .then(setUser)
      .catch(() => {
        localStorage.removeItem('access');
        localStorage.removeItem('refresh');
        navigate('/login');
      });

    fetch(`${API_BASE_URL}/incidents/`, {
      headers: { Authorization: 'Bearer ' + access },
    })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setLatestReport(data[0] ?? null))
      .catch(() => setLatestReport(null));
  }, [navigate]);

  function handleLogout() {
    localStorage.removeItem('access');
    localStorage.removeItem('refresh');
    navigate('/login');
  }

  if (!user) {
    return <center><p className="dashboard-text">Loading...</p></center>;
  }

  return (
    <center>
      <header className="top-bar">
        <div className="brand-identity">
          <div className="app-logo"><i className="fa fa-fire" aria-hidden="true">🔥</i><div className="logo-glow"/></div>
          <div className="app-name"><span className="fire-txt">FIRE</span><span className="trace-txt">TRACE</span></div>
          <span className="station-name">{user.user_type === 'bfp' ? 'BFP Personnel' : 'Civilian'}</span>
        </div>
        <button className="LogOut" onClick={handleLogout}>Log Out</button>
      </header>

      <section className="welcome-hero">
        <div className="hero-text">
          <h1 className="main-headline">Welcome, {user.username}</h1>
          <p className="sub-headline">Report incidents quickly and help keep your community safe.</p>
        </div>
      </section>

      <div className="welcome-actions">
        <div className="action-grid">
          <Link to="/report" className="primary-action-card">
            <div className="card-icon">🔥</div>
            <div className="card-text">
              <h3>Start Fire Report</h3>
              <p>Submit a verified incident report.</p>
            </div>
            <div className="arrow-icon">→</div>
          </Link>

          <a href="tel:+639171234567" className="secondary-action-card" style={{textDecoration: 'none'}}>
            <div className="card-icon">📞</div>
            <div className="card-text">
              <h3>Call BFP - CALAPAN</h3>
              <p>Contact the Bureau for immediate assistance.</p>
            </div>
            <div className="arrow-icon">→</div>
          </a>
        </div>

        <div className="emergency-protocol" style={{marginTop: 18}}>
          <div className="protocol-header"><span className="pulse-icon">⚠️</span><span>Emergency Protocol</span></div>
          <div className="protocol-content"><p>If there's an active fire, call local emergency services first and move to safety.</p></div>
        </div>

        <h3 className="report" style={{marginTop:20}}>Latest report</h3>
        {latestReport ? (
          <div className="incident-card" style={{marginTop:8}}>
            <div className="incident-header">
              <span className="reference-number">{latestReport.reference_number}</span>
              <span className="status">{latestReport.status.replace('_', ' ').toUpperCase()}</span>
            </div>
            <div className="incident-info">
              <div>{latestReport.incident_type}</div>
              <div>Barangay {latestReport.barangay}</div>
              <div>{new Date(latestReport.created_at).toLocaleString()}</div>
            </div>
            <button className="view-details-button"><Link to={`/report/${latestReport.id}`}>VIEW DETAILS</Link></button>
          </div>
        ) : (
          <p className="dashboard-text2">No reports submitted yet.</p>
        )}
      </div>

      <nav className="bottom-nav">
        <Link className="bottom-btn-active" to="/dashboard">Home</Link>
        <Link className="bottom-btn" to="/report">Report</Link>
        <Link className="bottom-btn" to="/myreport">My Report</Link>
        <Link className="bottom-btn" to="/">Notifications</Link>
        <Link className="bottom-btn" to="/">Account</Link>
      </nav>
    </center>
  );
}

export default Dashboard;
