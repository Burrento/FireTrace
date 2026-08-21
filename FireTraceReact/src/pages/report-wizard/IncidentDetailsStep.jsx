import { Link } from 'react-router-dom';
import { useMemo } from 'react';
import '../../style.css';
import { useReportDraft } from '../../context/useReportDraft';

function IncidentDetailsStep() {

    const { draft, updateDraft } = useReportDraft();

    // Captured once when the step opens, rather than in an effect that
    // sets state synchronously on mount.
    const now = useMemo(() => new Date(), []);

    const date = now.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric"
    });

    const time = now.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit"
    });

    return (
        <center>
            <header className="top-bar">
                <Link to="/dashboard" className="back-btn">
                    <i className="fa-solid fa-arrow-left"></i>
                </Link>
                <div className="brand-identity">
                    <div className="app-name">
                        <span className="fire-txt">STEP</span>
                        <span className="trace-txt">1 OF 4</span>
                    </div>
                </div>
                <div style={{width: 48}}></div>
            </header>

            <p className="incident-text">Incident Type:</p>

            <div>
                <select
                    id="incident-select"
                    name="incident-select"
                    value={draft.incident_type}
                    onChange={(e) => updateDraft({ incident_type: e.target.value })}
                >
                    <option value="">Select Incident Type</option>
                    <option value="fire">Residential Fire</option>
                    <option value="vehicle">Vehicle Fire</option>
                    <option value="electrical">Electrical Fire</option>
                    <option value="other">Other</option>
                </select>
            </div>

            <p className="description-text">Description</p>

            <div>
                <textarea
                    id="description"
                    name="description"
                    placeholder="Enter incident description..."
                    value={draft.description}
                    onChange={(e) => updateDraft({ description: e.target.value })}
                ></textarea>
            </div>

            <p className="description-text">Date & Time</p>

            <div className="date-time-container">

                <input
                    type="text"
                    id="date"
                    value={date}
                    readOnly
                />

                <input
                    type="text"
                    id="time"
                    value={time}
                    readOnly
                />

            </div>
            <div className="backcontinue-container">
                <button className="backbtn"><Link to="/dashboard">Back</Link></button>
                <button className="continuebtn"><Link to="/continue2">Continue</Link></button>
            </div>
            <nav className="bottom-nav">
                <Link className="bottom-btn" to="/dashboard">
                    <i className="fa-solid fa-house"></i>
                    <span>Home</span>
                </Link>
                <Link className="bottom-btn-active" to="/report">
                    <i className="fa-solid fa-bullhorn"></i>
                    <span>Report</span>
                </Link>
                <Link className="bottom-btn" to="/myreport">
                    <i className="fa-solid fa-list-check"></i>
                    <span>My Reports</span>
                </Link>
                <Link className="bottom-btn" to="/dashboard">
                    <i className="fa-solid fa-bell"></i>
                    <span>Alerts</span>
                </Link>
                <Link className="bottom-btn" to="/dashboard">
                    <i className="fa-solid fa-user-gear"></i>
                    <span>Profile</span>
                </Link>
            </nav>
        </center>
    );
}

export default IncidentDetailsStep;