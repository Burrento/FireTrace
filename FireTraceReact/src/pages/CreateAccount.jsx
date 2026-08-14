import { Link } from 'react-router-dom';
import '../style.css';

function CreateAccount() {
  return (
    <center>
      <header className="top-bar">
        <button className="back-button"><Link to="/">←</Link></button>
        <h1>Create Account</h1>
      </header>
      <h3 className="h3create">Create Your FireTrace Account</h3>
      <label className="label">Full Name</label><br />
      <input type="text" id="Full-Name" name="Full-Name" required /><br /><br />
      <label className="label">Email Address</label><br />
      <input type="email" id="Email" name="Email" required /><br /><br />
      <label className="label">Mobile Number (Registered)</label><br />
      <input type="tel" id="Mobile-Number" name="Mobile-Number" required /><br /><br />
      <label className="label">Password</label><br />
      <input type="password" id="Password" name="Password" required /><br />
      <p className="create">
        <input type="checkbox" id="show-password" />  I agree to the{' '}
        <a className="Privacy" href="#">Privacy Names </a>&
        <a className="Terms" href="#"> Terms of Use </a>
      </p>
      <button className="create-button">Create Account</button>
      <p className="create">Already have an Account? <Link className="login2" to="/login">Login</Link></p>
    </center>
  );
}

export default CreateAccount;
