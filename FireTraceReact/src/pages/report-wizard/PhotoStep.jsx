import { Link } from 'react-router-dom';
import '../../style.css';

function PhotoStep() {
    return(
        <center>
            <header className="top-bar">
                <h2 className="firetraceheader">Fire Report Incident</h2>
                <p>3 of 4</p>
            </header>
            <p className="addphoto">Add Supporting Photograph (Optional)</p>
            <div className="photo-warning">
                <span className="photo-warning-icon">⚠️</span>
                <p>Do not approach the fire or place yourself in danger to capture a photograph.</p>
            </div>
            <button className = "takephoto">TAKE SAFE PHOTO</button><br />
            <button className = "selectphoto">SELECT FROM GALLERY</button>

            <div className="backcontinue-container">
            <button className="backbtn"><Link to="/continue2">Back</Link></button>
            <button className="continuebtn"><Link to="/continue4">Continue</Link></button>
            </div>
            <nav className="bottom-nav">

                <Link className="bottom-btn" to="/dashboard">Home</Link>
                <Link className="bottom-btn-active" to="/report">Report</Link>
                <Link className="bottom-btn" to="/myreport">My Report</Link>
                <Link className="bottom-btn" to="/">Notifications</Link>
                <Link className="bottom-btn" to="/">Account</Link>

            </nav>
        </center>
    );
}

export default PhotoStep;