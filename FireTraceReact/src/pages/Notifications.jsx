import { useNavigate } from 'react-router-dom';
import '../style.css';
import { logout } from '../api';

const NOTIFICATION_GROUPS = [
    {
        label: 'Today',
        items: [
            {
                id: 'FT-2026-00124',
                icon: 'warning',
                message: 'is now Under Review.',
                time: '9:10 AM',
            },
            {
                id: 'FT-2026-00110',
                icon: 'verified',
                message: 'has been Verified by BFP.',
                time: '8:05 AM',
            },
            {
                id: null,
                icon: 'thanks',
                message: 'Thank you for helping keep your community safe.',
                time: '7:30 AM',
            },
        ],
    },
    {
        label: 'Yesterday',
        items: [
            {
                id: 'FT-2026-00015',
                icon: 'resolved',
                message: 'has been Resolved.',
                time: '2:45 PM',
            },
        ],
    },
];

const ICONS = {
    warning: '⚠️',
    verified: '✓',
    resolved: '✓',
    thanks: '🛡️',
};

function Notifications() {
    const navigate = useNavigate();

    async function handleLogout() {
        await logout();
        navigate('/login');
    }

    return (
        <center>
            <header className="top-bar">
                <h2 className="firetraceheader">NOTIFICATIONS</h2>
                <button className="LogOut" onClick={handleLogout}>Log Out</button>
            </header>

            <div className="notif-list">
                {NOTIFICATION_GROUPS.map((group) => (
                    <div className="notif-group" key={group.label}>
                        <p className="notif-group-title">{group.label.toUpperCase()}</p>

                        {group.items.map((item, index) => (
                            <div className="notif-item" key={item.id ?? `${group.label}-${index}`}>
                                <span className={`notif-icon notif-icon-${item.icon}`}>
                                    {ICONS[item.icon]}
                                </span>

                                {item.id ? (
                                    <div className="notif-content">
                                        <p className="notif-title">{item.id}</p>
                                        <p className="notif-sub">{item.message} {item.time}</p>
                                    </div>
                                ) : (
                                    <p className="notif-sub notif-sub-solo">{item.message} {item.time}</p>
                                )}
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        </center>
    );
}

export default Notifications;
