import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import '../../style.css';

function ContactInfo(){
    const navigate = useNavigate();
    return(
        <div className="page">
            <header className="top-bar">
                <h2 className="firetraceheader">CONTACT INFO</h2>
            </header>
            <div className="edit-profile-form">
                    <p>Mobile Number (Registered)</p>
                    <input type="tel" id="Mobile-Number" name="Mobile-Number" />
                    <p>New Mobile Number (Registered)</p>
                    <input type="tel" id="Mobile-Number" name="Mobile-Number" />
                    <p>OTP</p>
                    <div className="otp-row">
                        <input type="tel" id="OTP" name="OTP" />
                        <button className="OTP-btn">SEND OTP</button>
                    </div>
                </div>
                <button className="UpdateNumber-btn">UPDATE NUMBER</button>
                <button className="Cancel-btn" onClick={() => navigate(-1)}>CANCEL</button>
        </div>
    );
}

export default ContactInfo;