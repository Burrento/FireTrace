import { Link } from 'react-router-dom';
import '../style.css';

function Login() {
  return (
    <center>
      <i className="fa-solid fa-fire-flame-simple fire-icon2"></i>
      <h3 className="h3create">Welcome back</h3>
      <p className="logintext">Log in to submit and track fire incident reports.</p>
      <label className="label">Email Address</label><br />
      <input type="email" id="Email" name="Email" required /><br /><br />
      <label className="label">Password</label><br />
      <input type="password" id="Password" name="Password" required /><br />
      <p className="forgot"><a className="ForgotPass"><Link to="/forgotpass1">Forgot Password?</Link></a></p><br />
      <button className="create-button"><Link to="/dashboard">Login</Link></button>
      <p className="register">Don't have an Account? <Link className="login2" to="/create">Register</Link></p><br />

      <div className="emergency-alert">
        <i className="fa-solid fa-triangle-exclamation emergency-icon"></i>
        <p>In an active emergency, call the BFP<br />
          hotline or 911<br />
          immediately. Do not wait for this app.
        </p>
      </div>
    </center>
  );
}

export default Login;
