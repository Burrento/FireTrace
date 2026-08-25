import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import '../../style.css';
import { API_BASE_URL, apiFetch } from '../../api';
import { isLoggedIn, saveTokens } from '../../auth';
import PasswordInput from '../../components/PasswordInput';

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  /* Read once on mount: a remembered login leaves a refresh token behind, so
     skip the form and let the dashboard verify it. */
  const [hasSession] = useState(isLoggedIn);

  useEffect(() => {
    if (hasSession) navigate('/dashboard', { replace: true });
  }, [hasSession, navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const tokens = await apiFetch(
        '/accounts/login',
        {
          method: 'POST',
          body: JSON.stringify({
            username: email.trim().toLowerCase(),
            password,
            remember_me: remember,
          }),
        },
        { skipAuth: true },
      );
      saveTokens(tokens, remember);
      // The login response carries user_type so the first screen is the right
      // one, with no intermediate redirect through the civilian dashboard.
      navigate(tokens.user_type === 'bfp' ? '/bfp' : '/dashboard');
    } catch (err) {
      // Only a 401 is actually a bad credential. A dead backend or a host the
      // API rejects used to land here too and read as "wrong password", which
      // sent people hunting for a typo that was never there.
      if (err.status === 401) setError('Invalid username or password');
      else if (!err.status) setError(`Cannot reach the server at ${API_BASE_URL}.`);
      else setError(err.message || 'Sign in failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (hasSession) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
      </div>
    );
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
              <label className="label">Username or Email</label>
              {/* Deliberately type="text", not type="email": the field accepts
                  a plain username too, and the browser's own email validation
                  would reject one before it was ever submitted. */}
              <input type="text" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>

            <div className="input-group">
              <label className="label">Password</label>
              <PasswordInput
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>

            <div className="login-options">
              <label className="remember-me">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                />
                <span>Remember me for 30 days</span>
              </label>
              <Link className="ForgotPass" to="/forgotpass1">Forgot Password?</Link>
            </div>

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
