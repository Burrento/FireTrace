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
    <center className="auth-page">
      <div className="auth-form-container">
        <header className="auth-header">
          <Link to="/" className="auth-back-link">
            <span className="back-arrow">←</span>
            <span className="auth-header-title">Sign In</span>
          </Link>
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
    </center>
  );
}

export default Login;
