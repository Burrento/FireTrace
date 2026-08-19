import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import '../../style.css';

const GUIDE_ITEMS = [
    {
        title: 'How to Report Safely',
        description: 'Report only when it is safe to do so. Do not put yourself in danger.',
    },
    {
        title: 'What to Include',
        description: 'Provide accurate details such as location, incident type, and description.',
    },
    {
        title: 'Supporting Photos',
        description: 'Add photos if available, but never risk your safety to take one.',
    },
    {
        title: 'After You Submit',
        description: "Your report will be reviewed by BFP personnel. You'll be notified of updates.",
    },
];

function HelpReport(){
    const navigate = useNavigate();
    return(
        <div className="page">
            <header className="top-bar">
                <h2 className="firetraceheader">Guidelines</h2>
            </header>

            <div className="help-guide-list">
                {GUIDE_ITEMS.map((item) => (
                    <div className="help-guide-card" key={item.title}>
                        <p className="help-guide-title">{item.title}</p>
                        <p className="help-guide-desc">{item.description}</p>
                    </div>
                ))}
            </div>

            <button className="Cancel-btn" onClick={() => navigate(-1)}>BACK</button>
         </div>
    );
}

export default HelpReport;