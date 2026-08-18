import { Link, Navigate } from 'react-router-dom';
import '../../style.css';
import { getAccessToken } from '../../api';

function Welcome() {
  // A returning user with a live session skips the intro and goes straight to
  // reporting. First-time visitors still get the full welcome screen.
  if (getAccessToken()) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="page">
      <div className="welcome-header">
        <i className="fa-solid fa-fire-flame-simple fire-icon"></i>
        <h1 className="firetrace1"><b>FIRETRACE</b></h1>
        <p className="geo">Geolocation-based fire incident reporting<br />
        for BFP-Calapan City Fire Station</p>
      </div>
      <button className="started"><Link to="/create">Get started</Link></button><br />
      <button className="account"><Link to="/login">I already have an account</Link></button>
      <p className="sentence1">For life-threatening emergencies, call the BPF hotline directly. This<br />
      app suplements, not replaces, emergency communication</p>
    </div>
  );
}

export default Welcome;
