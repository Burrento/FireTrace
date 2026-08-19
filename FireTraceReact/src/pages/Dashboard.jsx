import { Link } from 'react-router-dom';
import '../style.css';

function Dashboard() {
  return (
    <center>
        <header className="top-bar">
            <h2 className="firetraceheader">DASHBOARD</h2>
            <button className="LogOut"><Link to="/">Log Out</Link></button>
        </header>
        <p className="dashboard-text">Here you can submit and track fire incident reports.</p>
        <button className="CallBFP"><Link to="/report">CALL BFP - CALAPAN</Link></button>
        <p className="report">REPORT A FIRE INCIDENT</p>
        <p className="dashboard-text2">Help keep your community safe by reporting fire incidents.</p>
        <button className="FireReport"><Link to="/track-report">START FIRE REPORT</Link></button>
        <p className="report2">LATEST REPORT</p>
        
        <div className="incident-card">
            <div className="incident-header">
                <span className="reference-number">FT-2026-00124</span>
                <span className="status">UNDER REVIEW</span>
            </div>

            <div className="incident-info">
                <div>Residential Fire</div>
                <div>Barangay San Vicente North</div>
                <div>May 20, 2026 - 08:35 AM</div>
            </div>

            <button className="view-details-button"><Link to="#">VIEW DETAILS</Link></button>
        </div>

    </center>

  );
}

export default Dashboard;