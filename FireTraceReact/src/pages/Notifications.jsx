import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../style.css';
import { apiFetch } from '../api';
import { isLoggedIn } from '../auth';
import CivHeader from '../components/CivHeader';

/* Updates on the reporter's own reports, from /api/reports/notifications/.

   The server writes each message from status values alone, so a note a staff
   member recorded for the station never reaches this screen. Loaded when the
   screen opens: /ws/dashboard is personnel-only, so there is no push here. */

// [css modifier already styled in style.css, glyph]
const ICONS = {
    received: ['thanks', '📨'],
    submitted: ['warning', '⚠️'],
    under_review: ['warning', '⚠️'],
    verified: ['verified', '✓'],
    responding: ['warning', '🚒'],
    resolved: ['resolved', '✓'],
    rejected: ['warning', '✕'],
};

function dayLabel(iso) {
    const day = new Date(iso);
    const daysAgo = (n) => new Date(Date.now() - n * 86400000).toDateString();
    if (day.toDateString() === daysAgo(0)) return 'Today';
    if (day.toDateString() === daysAgo(1)) return 'Yesterday';
    return day.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function Notifications() {
    const navigate = useNavigate();
    const [items, setItems] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!isLoggedIn()) {
            navigate('/login');
            return;
        }
        apiFetch('/api/reports/notifications/')
            .then((data) => setItems(Array.isArray(data) ? data : []))
            .catch(() => setError('Could not load your alerts.'));
    }, [navigate]);

    // Newest first from the server, so days come out in order as they are met.
    const groups = useMemo(() => {
        const byDay = new Map();
        for (const item of items ?? []) {
            const label = dayLabel(item.created_at);
            if (!byDay.has(label)) byDay.set(label, []);
            byDay.get(label).push(item);
        }
        return [...byDay];
    }, [items]);

    return (
        <center>
            <CivHeader title="Alerts" back="/dashboard" />

            <div className="notif-list">
                {error && <p className="notif-sub notif-sub-solo">{error}</p>}
                {!error && items === null && <p className="notif-sub notif-sub-solo">Loading…</p>}
                {items?.length === 0 && (
                    <p className="notif-sub notif-sub-solo">
                        No updates yet. Alerts appear here when BFP acts on your reports.
                    </p>
                )}

                {groups.map(([label, group]) => (
                    <div className="notif-group" key={label}>
                        <p className="notif-group-title">{label.toUpperCase()}</p>

                        {group.map((item) => {
                            const [icon, glyph] = ICONS[item.kind] ?? ICONS.submitted;
                            const time = new Date(item.created_at).toLocaleTimeString('en-US', {
                                hour: 'numeric',
                                minute: '2-digit',
                            });
                            return (
                                <Link
                                    className="notif-item"
                                    key={item.id}
                                    to={`/report/${item.report_id}`}
                                >
                                    <span className={`notif-icon notif-icon-${icon}`}>{glyph}</span>
                                    <div className="notif-content">
                                        <p className="notif-title">{item.reference_number}</p>
                                        <p className="notif-sub">{item.message} {time}</p>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                ))}
            </div>
        </center>
    );
}

export default Notifications;
