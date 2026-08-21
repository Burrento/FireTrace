import { Link } from 'react-router-dom';
import '../../style.css';
import BottomNav from '../../components/BottomNav';

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
            <BottomNav active="report" />
        </center>
    );
}

export default PhotoStep;