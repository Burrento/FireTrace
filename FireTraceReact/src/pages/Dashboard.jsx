import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../style.css';
import { API_BASE_URL } from '../api';

function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [error, setError] = useState('');
  const [latestReport, setLatestReport] = useState(null);

  useEffect(() => {
    const access = localStorage.getItem('access');
    if (!access) {
      navigate('/login');
      return;
    }
    fetch(`${API_BASE_URL}/accounts/me`, {
      headers: { Authorization: `Bearer ${access}` },
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
      headers: { Authorization: `Bearer ${access}` },
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
    return <center>{error || 'Loading…'}</center>;
  }

  return (
    <center>
      <header className="top-bar">
        <h2 className="firetraceheader">FIRETRACE</h2>
        <button className="LogOut" onClick={handleLogout}>Log Out</button>
      </header>
      <p className="dashboard-text">
        {user.user_type === 'bfp' ? 'You are a BFP personnel' : 'You are a Civilian'} — Welcome, {user.username}
      </p>
      <button className="CallBFP"><Link to="/report">CALL BFP - CALAPAN</Link></button>
      <p className="report">REPORT A FIRE INCIDENT</p>
      <p className="dashboard-text2">Help keep your community safe by reporting fire incidents.</p>
      <button className="FireReport"><Link to="/report">START FIRE REPORT</Link></button>
      <p className="report2">LATEST REPORT</p>

      {latestReport ? (
        <div className="incident-card">
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

      <nav className="bottom-nav">
        <button className="bottom-btn-active"><Link to="/dashboard">Home</Link></button>
        <button className="bottom-btn"><Link to="/report">Report</Link></button>
        <button className="bottom-btn"><Link to="/myreport">My Report</Link></button>
        <button className="bottom-btn"><Link to="/">Notifications</Link></button>
        <button className="bottom-btn"><Link to="/">Profile</Link></button>
      </nav>
    </center>
  );
}

export default Dashboard;
