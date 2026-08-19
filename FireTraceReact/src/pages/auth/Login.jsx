import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import '../../style.css';
import { apiFetch, getAccessToken, setTokens } from '../../api';

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const tokens = await apiFetch('/accounts/login', {
        method: 'POST',
        body: JSON.stringify({ username: email, password, remember_me: remember }),
      });
      setTokens(tokens, remember);
      navigate('/dashboard');
    } catch {
      setError('Invalid email or password');
    } finally {
      setSubmitting(false);
    }
  }

  // Placed after the hooks so their order stays stable between renders.
  // If the session turns out to be dead, the dashboard clears the tokens and
  // sends the user back here — by then this guard no longer matches.
  if (getAccessToken()) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="page">
      <i className="fa-solid fa-fire-flame-simple fire-icon2"></i>
      <h3 className="h3create">Welcome back</h3>
      <p className="logintext">Log in to submit and track fire incident reports.</p>
      <form onSubmit={handleSubmit}>
        <label className="label">Email Address</label><br />
        <input type="email" id="Email" name="Email" value={email} onChange={(e) => setEmail(e.target.value)} required /><br /><br />
        <label className="label">Password</label><br />
        <input type="password" id="Password" name="Password" value={password} onChange={(e) => setPassword(e.target.value)} required /><br />
        <p className="forgot"><Link className="ForgotPass" to="/forgotpass1">Forgot Password?</Link></p>
        <label className="remember-row">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
          />
          <span>Keep me signed in for 30 days</span>
        </label>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <button className="create-button" type="submit" disabled={submitting}>
          {submitting ? 'Logging in…' : 'Login'}
        </button>
      </form>
      <p className="register">Don't have an Account? <Link className="login2" to="/create">Register</Link></p><br />

      <div className="emergency-alert">
        <i className="fa-solid fa-triangle-exclamation emergency-icon"></i>
        <p>In an active emergency, call the BFP<br />
          hotline or 911<br />
          immediately. Do not wait for this app.
        </p>
      </div>
    </div>
  );
}

export default Login;
