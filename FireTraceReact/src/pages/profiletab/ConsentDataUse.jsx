import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import '../../style.css';

function ConsentDataUse(){
    const navigate = useNavigate();
    return(
        <div className="page">
            <header className="top-bar">
                <h2 className="firetraceheader">Consent and Data Use</h2>
            </header>
            <button className="Cancel-btn" onClick={() => navigate(-1)}>CANCEL</button>
         </div>
    );
}

export default ConsentDataUse;