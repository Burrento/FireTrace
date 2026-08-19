import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import '../style.css';

function Notifications() {
    return(
        <center>
            <header className="top-bar">
                <h2 className="firetraceheader">NOTIFICATIONS</h2>
                <button className="LogOut"><Link to="/">Log Out</Link></button>
            </header>
        </center>
    );
}

export default Notifications;