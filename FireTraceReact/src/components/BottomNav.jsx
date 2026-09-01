import { Link, useLocation } from 'react-router-dom';

/* Single source of truth for the civilian bottom nav, so every page gets the
   same bar as the home tab. */
const NAV_ITEMS = [
    { key: 'home', label: 'Home', icon: 'fa-house', to: '/dashboard', match: ['/dashboard'] },
    { key: 'livemap', label: 'Live Map', icon: 'fa-fire', to: '/livemap', match: ['/livemap'] },
    { key: 'report', label: 'Report', icon: 'fa-pen', to: '/report', match: ['/report', '/continue2', '/continuethird', '/continue4'] },
    { key: 'myreports', label: 'My Reports', icon: 'fa-file-lines', to: '/myreport', match: ['/myreport'] },
    { key: 'alerts', label: 'Alerts', icon: 'fa-bell', to: '/Notifications', match: ['/Notifications'] },
    { key: 'profile', label: 'Profile', icon: 'fa-circle-user', to: '/profile', match: ['/profile'] },
];

function resolveActive(pathname) {
    const item = NAV_ITEMS.find((nav) => nav.match.includes(pathname));
    if (item) return item.key;
    // /report/:id is a saved report, which belongs to My Reports rather than
    // the report wizard.
    if (/^\/report\/[^/]+$/.test(pathname)) return 'myreports';
    return null;
}

function BottomNav({ active }) {
    const { pathname } = useLocation();
    const activeKey = active ?? resolveActive(pathname);

    return (
        <nav className="civ-bottom-nav">
            {NAV_ITEMS.map((item) => (
                <Link
                    key={item.key}
                    to={item.to}
                    className={item.key === activeKey ? 'civ-nav-item civ-nav-active' : 'civ-nav-item'}
                >
                    <i className={`fa-solid ${item.icon}`}></i>
                    <span>{item.label}</span>
                </Link>
            ))}
        </nav>
    );
}

export default BottomNav;
