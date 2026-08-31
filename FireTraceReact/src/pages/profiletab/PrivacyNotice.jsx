import { useNavigate } from 'react-router-dom';
import '../../style.css';
function PrivacyNotice(){
    const navigate = useNavigate();
    return(
        <div className="page">
            <header className="top-bar">
                <h2 className="firetraceheader">Privacy</h2>
            </header>
            <button className="Cancel-btn" onClick={() => navigate(-1)}>CANCEL</button>
         </div>
    );
}
export default PrivacyNotice;