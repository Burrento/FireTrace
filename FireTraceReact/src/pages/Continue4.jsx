import { Link } from 'react-router-dom';
import '../style.css';

function Continue4() {
    return(
        <center>
            <header className="top-bar">
                <h2 className="firetraceheader">Fire Report Incident</h2>
                <p>4 of 4</p>
            </header>
            <div className="submitted-icon">&#10003;</div>
            <h2 className="submitted-title">REPORT SUBMITTED</h2>
            <p className="submitted-subtitle">Your report was successfully recorded and forwarded for BFP review.</p>

            <div className="incident-card submitted-card">
                <p className="submitted-label">Reference Number</p>
                <p className="submitted-reference">FT-2026-00124</p>

                <p className="submitted-label">Submitted</p>
                <p className="submitted-value">May 20, 2026 - 08:35 AM</p>

                <p className="submitted-label">Current Status</p>
                <span className="submitted-status">SUBMITTED</span>
            </div>

            <button className="view-status-button"><Link to="/myreport">VIEW REPORT STATUS</Link></button><br />
            <button className="contact-bfp-button">&#128222; CONTACT BFP FOR URGENT HELP</button>

            <nav className="bottom-nav">

                <Link className="bottom-btn" to="/dashboard">Home</Link>
                <Link className="bottom-btn-active" to="/report">Report</Link>
                <Link className="bottom-btn" to="/myreport">My Report</Link>
                <Link className="bottom-btn" to="/">Notifications</Link>
                <Link className="bottom-btn" to="/">Profile</Link>

            </nav>
        </center>
    );
}

export default Continue4;
