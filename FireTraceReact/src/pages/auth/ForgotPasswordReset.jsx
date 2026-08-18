import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import '../../style.css';

function ForgotPasswordReset() {
    return(
        <div className="page">
            <header className="top-bar">
                <h2 className="firetraceheader2">FIRETRACE</h2>
            </header>
            <p className="newpass">New Password</p>
            <input type="password" id="Password" name="Password" required /><br />
            <p className="newpass2">Confirm New Password</p>
            <input type="password" id="Password" name="Password" required /><br />
            <button className="confirmemail"><Link to="/Login">CONFIRM</Link></button>
        </div>
    );
}

export default ForgotPasswordReset;