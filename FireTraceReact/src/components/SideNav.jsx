import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import '../style.css';
import { apiFetch, logout } from '../api';
import { isLoggedIn } from '../auth';
import { useNavDrawer } from '../context/useNavDrawer';
import { BFP_HOTLINE, BFP_HOTLINE_DISPLAY } from '../lib/contacts';

/* The civilian menu: every destination in the app, in one drawer.

   It replaced a bottom tab bar, a floating hamburger and a header menu button
   that each knew about a different subset of the app -- which is how the Live
   Map ended up in the tab bar while Privacy Notice was reachable only by
   guessing a URL. One list means adding a screen is one line here, and no
   screen can quietly become unreachable.

   Grouped rather than flat, and ordered by urgency: the two things somebody
   opens this app to do are report a fire and call the fire station, so they
   are first and stay above the fold on a small phone. */

const NAV_GROUPS = [
    {
        title: 'Emergency',
        items: [
            { to: '/report', label: 'Submit Fire Report', icon: 'fa-fire', accent: true, match: ['/report', '/continue2', '/continuethird', '/continue4'] },
            { to: '/livemap', label: 'Live Fire Map', icon: 'fa-map-location-dot' },
        ],
    },
    {
        title: 'My activity',
        items: [
            { to: '/dashboard', label: 'Home', icon: 'fa-house' },
            { to: '/myreport', label: 'My Reports', icon: 'fa-file-lines', match: ['/myreport'], prefix: '/report/' },
            { to: '/Notifications', label: 'Alerts', icon: 'fa-bell' },
        ],
    },
    {
        title: 'Account',
        items: [
            { to: '/profile', label: 'Profile', icon: 'fa-circle-user' },
            { to: '/personal', label: 'Personal Information', icon: 'fa-id-card' },
            { to: '/ContactInfo', label: 'Contact Information', icon: 'fa-address-book' },
            { to: '/ChangePass', label: 'Change Password', icon: 'fa-key' },
        ],
    },
    {
        title: 'Information',
        items: [
            { to: '/OfficialBFP', label: 'Official BFP Contacts', icon: 'fa-building-shield' },
            { to: '/HelpReport', label: 'Reporting Guidelines', icon: 'fa-circle-question' },
            { to: '/PrivacyNotice', label: 'Privacy Notice', icon: 'fa-shield-halved' },
            { to: '/ConsentDataUse', label: 'Consent & Data Use', icon: 'fa-file-signature' },
        ],
    },
];

/* Which entry to mark as where you are.

   `match` overrides the plain path comparison for the multi-step wizard, whose
   four routes are all one destination; `prefix` covers a saved report at
   /report/:id, which belongs to My Reports rather than to the wizard that
   happens to share the word. */
function isCurrent(item, pathname) {
    const lower = pathname.toLowerCase();
    if (item.match) return item.match.includes(lower);
    if (item.prefix && lower.startsWith(item.prefix)) return true;
    return lower === item.to.toLowerCase();
}

function SideNav() {
    const { open, close } = useNavDrawer();
    const { pathname } = useLocation();
    const navigate = useNavigate();
    const [profile, setProfile] = useState(null);

    /* Loaded the first time the menu is opened, not on mount: the drawer is
       mounted behind every civilian screen, and fetching there would add a
       request to a page that may already be loading the same profile. */
    useEffect(() => {
        if (!open || profile || !isLoggedIn()) return undefined;

        let cancelled = false;
        apiFetch('/accounts/me')
            .then((data) => { if (!cancelled) setProfile(data); })
            .catch(() => { /* The menu still navigates without a name on it. */ });

        return () => { cancelled = true; };
    }, [open, profile]);

    async function handleLogout() {
        close();
        await logout();
        navigate('/login');
    }

    const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ');
    const email = profile?.email || profile?.username || '';
    const initial = (name || email || '?').charAt(0).toUpperCase();

    return (
        <>
            <div
                className={`nav-drawer-scrim ${open ? 'is-open' : ''}`}
                onClick={close}
                aria-hidden="true"
            />

            {/* aria-hidden while closed so a screen reader does not walk a menu
                that is off-screen; inert would be tidier but is not safe on the
                browser versions this is demoed on. */}
            <nav
                className={`nav-drawer ${open ? 'is-open' : ''}`}
                aria-label="Main menu"
                aria-hidden={!open}
            >
                <header className="nav-drawer-head">
                    <div className="nav-drawer-brand">
                        <i className="fa-solid fa-fire-flame-curved" />
                        <span>
                            <span className="civ-brand-fire">FIRE</span>
                            <span className="civ-brand-trace">TRACE</span>
                        </span>
                    </div>
                    <button
                        type="button"
                        className="nav-drawer-close"
                        onClick={close}
                        aria-label="Close menu"
                    >
                        <i className="fa-solid fa-xmark" />
                    </button>
                </header>

                <Link to="/profile" className="nav-drawer-identity">
                    <span className="nav-drawer-avatar">{initial}</span>
                    <span className="nav-drawer-identity-text">
                        <strong>{name || email || 'Your account'}</strong>
                        <small>{name && email ? email : 'Verified civilian'}</small>
                    </span>
                    <i className="fa-solid fa-chevron-right" />
                </Link>

                <div className="nav-drawer-scroll">
                    {NAV_GROUPS.map((group) => (
                        <div className="nav-drawer-group" key={group.title}>
                            <p className="nav-drawer-group-title">{group.title}</p>
                            {group.items.map((item) => (
                                <Link
                                    key={item.to}
                                    to={item.to}
                                    className={[
                                        'nav-drawer-link',
                                        item.accent ? 'is-accent' : '',
                                        isCurrent(item, pathname) ? 'is-current' : '',
                                    ].filter(Boolean).join(' ')}
                                    aria-current={isCurrent(item, pathname) ? 'page' : undefined}
                                >
                                    <i className={`fa-solid ${item.icon}`} />
                                    <span>{item.label}</span>
                                </Link>
                            ))}
                        </div>
                    ))}

                    {/* The hotline is a destination like any other, so it sits
                        in the same list -- but it leaves the app, so it is an
                        <a> and is styled to say so. */}
                    <div className="nav-drawer-group">
                        <p className="nav-drawer-group-title">Emergency line</p>
                        <a className="nav-drawer-link is-call" href={`tel:${BFP_HOTLINE}`}>
                            <i className="fa-solid fa-phone" />
                            <span>
                                Call BFP Calapan
                                <small>{BFP_HOTLINE_DISPLAY}</small>
                            </span>
                        </a>
                    </div>
                </div>

                <button type="button" className="nav-drawer-logout" onClick={handleLogout}>
                    <i className="fa-solid fa-right-from-bracket" />
                    Log out
                </button>
            </nav>
        </>
    );
}

export default SideNav;
