import { Link } from 'react-router-dom';
import '../../style.css';

function ForgotPasswordRequest() {
    return(
        <center>
            <header className="top-bar">
                <h2 className="firetraceheader">FIRETRACE</h2>
                <button className="LogOut"><Link to="/Login">Back</Link></button>
            </header>
            <p className="email">Email Address</p>
            <input type="email" id="Email" name="Email" required /><br />
            <button className="confirmemail"><Link to="/forgotpass2">CONFRIM</Link></button>
        </center>
    );
}

export default ForgotPasswordRequest;