import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import '../../style.css';
import { apiFetch } from '../../api';

function CreateAccount() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await apiFetch('/accounts/register', {
        method: 'POST',
        body: JSON.stringify({
          username: email,
          email,
          password,
          first_name: fullName,
        }),
      });
      navigate('/login');
    } catch (err) {
      setError(err.message);
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
            <span className="auth-header-title">Create Account</span>
          </Link>
        </header>

        <div className="auth-description">
          <p>Provide your details below to set up your profile.</p>
        </div>
        
        <form onSubmit={handleSubmit} className="auth-form compact-form">
          <div className="input-group" style={{ marginBottom: '24px' }}>
            <label className="label">Full Name</label>
            <input type="text" placeholder="e.g. Juan Dela Cruz" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </div>

          <div className="input-group" style={{ marginBottom: '24px' }}>
            <label className="label">Email Address</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>

          <div className="input-group" style={{ marginBottom: '24px' }}>
            <label className="label">Mobile Number</label>
            <input type="tel" value={mobileNumber} onChange={(e) => setMobileNumber(e.target.value)} required />
          </div>

          <div className="input-group" style={{ marginBottom: '24px' }}>
            <label className="label">Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>

          <div className="terms-container">
            <input type="checkbox" id="terms" required />
            <label htmlFor="terms" className="checkbox-txt">
              I agree to the <a className="Privacy" href="#">Privacy Policy</a> & 
              <a className="Terms" href="#"> Terms of Service</a>
            </label>
          </div>

          {error && <p className="auth-error">{error}</p>}

          <button className="create-button" type="submit" disabled={submitting}>
            {submitting ? 'Processing…' : 'Create Account'}
          </button>
        </form>
        
        <p className="auth-footer">Already have an account? <Link className="auth-footer-link" to="/login">Sign In</Link></p>
      </div>
    </center>
  );
}

export default CreateAccount;
