import { Link, useNavigate } from 'react-router-dom';
import { useMemo } from 'react';
import '../../style.css';
import { useReportDraft } from '../../context/useReportDraft';
import BottomNav from '../../components/BottomNav';

function IncidentDetailsStep() {

    const navigate = useNavigate();
    const { draft, updateDraft } = useReportDraft();

    // Both are required by the server. Gating here, the same way step 2 gates on
    // its pin, means a missing one is caught on the step that owns the field --
    // not three screens later as an anonymous "may not be blank" at submit.
    const canContinue = Boolean(draft.incident_type) && draft.description.trim() !== '';

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
                        <span className="trace-txt">1 OF 3</span>
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
                {/* onClick rather than a nested <Link>: an anchor inside a
                    button is invalid markup, and only the text itself was
                    clickable -- the rest of the button was a dead zone. */}
                <button className="continuebtn" disabled={!canContinue} onClick={() => navigate('/continue2')}>
                    Continue
                </button>
            </div>
            <BottomNav active="report" />
        </center>
    );
}

export default IncidentDetailsStep;