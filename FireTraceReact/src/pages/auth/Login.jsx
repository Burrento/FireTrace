import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import '../../style.css';
import { apiFetch } from '../../api';

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const tokens = await apiFetch('/accounts/login', {
        method: 'POST',
        body: JSON.stringify({ username: email, password }),
      });
      localStorage.setItem('access', tokens.access);
      localStorage.setItem('refresh', tokens.refresh);
      navigate('/dashboard');
    } catch {
      setError('Invalid email or password');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    /* auth-page-split lifts the phone-width cap on #root, so this page can use
       the full screen from 900px up. Below that it stays the phone layout and
       the brand panel is hidden. */
    <div className="auth-page auth-page-split">
      <aside className="auth-brand-panel">
        <div className="auth-brand-inner">
          <div className="auth-brand-mark">
            <i className="fa-solid fa-fire-flame-curved"></i>
            <div className="auth-brand-name">
              <span className="auth-brand-fire">FIRE</span>
              <span className="auth-brand-trace">TRACE</span>
            </div>
          </div>

          <h1 className="auth-brand-headline">
            Fire incident reporting for Calapan City
          </h1>
          <p className="auth-brand-sub">
            Report a fire in seconds and track the response from submission to resolution.
          </p>

          <ul className="auth-brand-points">
            <li>
              <i className="fa-solid fa-bolt"></i>
              <div>
                <strong>Report in seconds</strong>
                <span>Pin the exact location on the map.</span>
              </div>
            </li>
            <li>
              <i className="fa-solid fa-tower-broadcast"></i>
              <div>
                <strong>Reaches BFP directly</strong>
                <span>Reports go straight to the response team.</span>
              </div>
            </li>
            <li>
              <i className="fa-solid fa-list-check"></i>
              <div>
                <strong>Track every update</strong>
                <span>Follow your report through each status.</span>
              </div>
            </li>
          </ul>
        </div>
      </aside>

      <div className="auth-form-side">
        <div className="auth-form-container">
          {/* No back arrow: this is the entry point, so there is nowhere to
              go back to. */}
          <header className="auth-header">
            <span className="auth-header-title">Sign In</span>
          </header>

          <div className="login-logo-section">
            <i className="fa-solid fa-fire-flame-simple"></i>
          </div>

          <div className="auth-description">
            <h2 className="auth-welcome-text">Welcome back</h2>
            <p>Sign in to your account to continue</p>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="input-group">
              <label className="label">Email Address</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>

            <div className="input-group">
              <label className="label">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>

            <p className="forgot"><Link className="ForgotPass" to="/forgotpass1">Forgot Password?</Link></p>

            {error && <p className="auth-error">{error}</p>}

            <button className="create-button" type="submit" disabled={submitting}>
              {submitting ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <p className="auth-footer">Don't have an account? <Link className="auth-footer-link" to="/create">Register</Link></p>

          <div className="login-emergency-alert">
            <i className="fa-solid fa-triangle-exclamation"></i>
            <p>For immediate emergency response, contact the official BFP Hotline or 911. Dispatchers are available 24/7.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
