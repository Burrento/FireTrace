import { useNavigate } from 'react-router-dom';
import '../../style.css';
function OfficialBFP(){
    const navigate = useNavigate();
    return(
        <div className="page">
            <header className="top-bar">
                <h2 className="firetraceheader">Offical BFP Contacts</h2>
            </header>
            <div className="bfp-card">
                <h3 className="bfp-station">BFP – Calapan City Fire Station</h3>
                <div className="bfp-contact">
                    <p className="bfp-label">Emergency Hotline</p>
                    <p className="bfp-value">(043) 288-2430</p>
                </div>
                <div className="bfp-contact">
                    <p className="bfp-label">Hotline 2</p>
                    <p className="bfp-value">(043) 288-2431</p>
                </div>
                <div className="bfp-contact">
                    <p className="bfp-label">Text / SMS</p>
                    <p className="bfp-value">0917-123-4567</p>
                </div>
                <div className="bfp-contact">
                    <p className="bfp-label">Email</p>
                    <p className="bfp-value">bfpcalapan@email.com</p>
                </div>
                <div className="bfp-contact">
                    <p className="bfp-label">Facebook Page</p>
                    <p className="bfp-value">BFP Calapan City Fire Station (Official)</p>
                </div>
                <div className="bfp-notice">
                    For emergencies, always call the official hotline first.
                </div>
            </div>
            <button className="Cancel-btn" onClick={() => navigate(-1)}>BACK</button>
         </div>
    );
}
export default OfficialBFP;