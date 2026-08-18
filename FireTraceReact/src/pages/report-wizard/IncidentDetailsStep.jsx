import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import '../style.css';
import { useReportDraft } from '../context/useReportDraft';

function Report() {

    const { draft, updateDraft } = useReportDraft();
    const [date, setDate] = useState("");
    const [time, setTime] = useState("");

    useEffect(() => {
        const now = new Date();

        setDate(
            now.toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric"
            })
        );

        setTime(
            now.toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit"
            })
        );
    }, []);

    return (
        <center>

            <header className="top-bar">
                <h2 className="firetraceheader">Fire Report Incident</h2>
                <p>1 of 4</p>
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

                <button className="bottom-btn"><Link to="/dashboard">Home</Link></button>
                <button className="bottom-btn-active"><Link to="/report">Report</Link></button>
                <button className="bottom-btn"><Link to="/myreport">My Report</Link></button>
                <button className="bottom-btn"><Link to="/">Notifications</Link></button>
                <button className="bottom-btn"><Link to="/">Profile</Link></button>

            </nav>

        </center>
    );
}

export default Report;