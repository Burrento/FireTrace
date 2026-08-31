import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import '../style.css';

const NAV_ITEMS = [
    { key: 'home', to: '/dashboard', label: 'Home' },
    { key: 'report', to: '/report', label: 'Report' },
    { key: 'myreport', to: '/myreport', label: 'My Report' },
    { key: 'notifications', to: '/Notifications', label: 'Notifications' },
    { key: 'profile', to: '/profile', label: 'Profile' },
];

const REPORT_FLOW_PATHS = ['/report', '/continue2', '/continuethird', '/continue4'];

function activeKeyFor(pathname) {
    const lower = pathname.toLowerCase();
    if (lower === '/dashboard') return 'home';
    if (lower === '/myreport') return 'myreport';
    if (lower === '/notifications') return 'notifications';
    if (lower === '/profile') return 'profile';
    if (REPORT_FLOW_PATHS.includes(lower)) return 'report';
    return null;
}

function SideNav() {
    const [open, setOpen] = useState(false);
    const { pathname } = useLocation();
    const active = activeKeyFor(pathname);

    return (
        <>
            <button
                className="hamburger-btn"
                onClick={() => setOpen(true)}
                aria-label="Open menu"
            >
                <span></span>
                <span></span>
                <span></span>
            </button>

            <div
                className={`side-nav-overlay ${open ? 'side-nav-overlay-open' : ''}`}
                onClick={() => setOpen(false)}
            />

            <nav className={`side-nav ${open ? 'side-nav-open' : ''}`}>
                <button
                    className="side-nav-close"
                    onClick={() => setOpen(false)}
                    aria-label="Close menu"
                >
                    &times;
                </button>

                {NAV_ITEMS.map((item) => (
                    <Link
                        key={item.key}
                        className={`side-nav-btn ${active === item.key ? 'side-nav-btn-active' : ''}`}
                        to={item.to}
                    >
                        {item.label}
                    </Link>
                ))}
            </nav>
        </>
    );
}

export default SideNav;
