import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import '../../style.css';

function ChangePass() {
    const navigate = useNavigate();
    return(
        <div className="page">
            <header className="top-bar">
                <h2 className="firetraceheader">CHANGE PASSWORD</h2>
            </header>
            <div className="edit-profile-form">
                    <p className="PersoName">Current Password</p>
                    <input type="password" id="Password" name="Password" />
                    <p>New Password</p>
                    <input type="password" id="Password" name="Password" />
                    <p>Confirm New Password</p>
                    <input type="password" id="Password" name="Password" />
                    <p>At least 8 characters</p>
                    <p>Includes letter and numbers</p>
                    <p>Not similiar to your personal information</p>
                </div>
                <button className="UpdatePass-btn">UPDATE PASSWORD</button>
                <button className="Cancel-btn" onClick={() => navigate(-1)}>CANCEL</button>
        </div>
    );
}

export default ChangePass;