import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import '../../style.css';

function Personal(){
        const navigate = useNavigate();
        return(
            <div className="page">
                <header className="top-bar">
                <h2 className="firetraceheader">EDIT PROFILE</h2>
            </header>
                <div className="edit-profile-form">
                    <p className="PersoName">Full Name</p>
                    <input type="text" id="Full-Name" name="Full-Name" />
                    <p>Email</p>
                    <input type="text" id="Email" name="Email" />
                    <p>Mobile Number (Registered)</p>
                    <input type="tel" id="Mobile-Number" name="Mobile-Number" />
                    <p>Alternative Contact Number (Optional)</p>
                    <input type="tel" id="Mobile-Number" name="Mobile-Number" />
                    <p>Your registered contact number is used for verification and updates about your reports</p>
                </div>
                <button className="SaveChanges-btn">SAVE CHANGES</button>
                <button className="Cancel-btn" onClick={() => navigate(-1)}>CANCEL</button>
            </div>
        );
}

export default Personal;