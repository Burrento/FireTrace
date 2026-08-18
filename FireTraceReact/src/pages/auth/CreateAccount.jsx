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
    <div className="page">
      <header className="top-bar">
        <button className="back-button"><Link to="/">←</Link></button>
        <h1>Create Account</h1>
      </header>
      <h3 className="h3create">Create Your FireTrace Account</h3>
      <form onSubmit={handleSubmit}>
        <label className="label">Full Name</label><br />
        <input type="text" id="Full-Name" name="Full-Name" value={fullName} onChange={(e) => setFullName(e.target.value)} required /><br /><br />
        <label className="label">Email Address</label><br />
        <input type="email" id="Email" name="Email" value={email} onChange={(e) => setEmail(e.target.value)} required /><br /><br />
        <label className="label">Mobile Number (Registered)</label><br />
        <input type="tel" id="Mobile-Number" name="Mobile-Number" value={mobileNumber} onChange={(e) => setMobileNumber(e.target.value)} required /><br /><br />
        <label className="label">Password</label><br />
        <input type="password" id="Password" name="Password" value={password} onChange={(e) => setPassword(e.target.value)} required /><br />
        <p className="create">
          <input type="checkbox" id="show-password" required />  I agree to the{' '}
          <a className="Privacy" href="#">Privacy Names </a>&
          <a className="Terms" href="#"> Terms of Use </a>
        </p>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <button className="create-button" type="submit" disabled={submitting}>
          {submitting ? 'Creating…' : 'Create Account'}
        </button>
      </form>
      <p className="create">Already have an Account? <Link className="login2" to="/login">Login</Link></p>
    </div>
  );
}

export default CreateAccount;
