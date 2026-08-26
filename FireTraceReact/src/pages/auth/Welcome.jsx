import { Link, Navigate } from 'react-router-dom';
import '../../style.css';
import { getAccessToken } from '../../auth';

function Welcome() {
  // A returning user with a live session skips the intro and goes straight to
  // reporting. First-time visitors still get the full welcome screen.
  if (getAccessToken()) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="welcome-container">
      <header className="welcome-hero">
        <div className="hero-background-overlay"></div>
        <div className="hero-content">
          <div className="brand-identity">
            <div className="app-logo">
              <i className="fa-solid fa-fire-flame-simple"></i>
              <div className="logo-glow"></div>
            </div>
            <h1 className="app-name">
              <span className="fire-txt">FIRE</span>
              <span className="trace-txt">TRACE</span>
            </h1>
          </div>
          
          <div className="hero-text">
            <h2 className="main-headline">Incident Reporting Portal</h2>
            <p className="sub-headline">
              The official mobile platform for the 
              <span className="station-name">BFP - Calapan City Fire Station</span>
            </p>
          </div>
        </div>
      </header>

      <main className="welcome-actions">
        <div className="action-grid">
          <Link to="/create" className="primary-action-card">
            <div className="card-icon">
              <i className="fa-solid fa-user-plus"></i>
            </div>
            <div className="card-text">
              <h3>Create Account</h3>
              <p>Register to submit verified fire reports</p>
            </div>
            <i className="fa-solid fa-chevron-right arrow-icon"></i>
          </Link>

          <Link to="/login" className="secondary-action-card">
            <div className="card-icon">
              <i className="fa-solid fa-circle-user"></i>
            </div>
            <div className="card-text">
              <h3>Sign In</h3>
              <p>Access your dashboard and report history</p>
            </div>
            <i className="fa-solid fa-chevron-right arrow-icon"></i>
          </Link>
        </div>

        <section className="emergency-protocol">
          <div className="protocol-header">
            <i className="fa-solid fa-phone-volume pulse-icon"></i>
            <span>Emergency Hotline</span>
          </div>
          <div className="protocol-content">
            <p>
              For immediate fire response and life-threatening emergencies, 
              please contact the official BFP Hotline. Professional dispatchers 
              are available 24/7 for rapid coordination and deployment.
            </p>
          </div>
        </section>
      </main>

      <footer className="welcome-footer">
        <p>&copy; 2024 FIRETRACE PLATFORM</p>
        <p>Bureau of Fire Protection | Calapan City</p>
      </footer>
    </div>
  );
}

export default Welcome;
