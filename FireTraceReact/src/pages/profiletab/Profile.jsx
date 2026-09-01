import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../../style.css';
import { apiFetch, logout } from '../../api';
import { isLoggedIn } from '../../auth';
import CivHeader from '../../components/CivHeader';

/* The account screen.

   It was a stack of unstyled buttons with an <hr /> between each, on the old
   `.page` shell -- visibly a different application from the Home screen it was
   one tap away from. It is now the same card language as the rest of the
   civilian app, and it leads with who is signed in, because "am I logged in as
   the right person" is the question this screen is actually opened to answer.

   The rows are grouped by what they are for. Account settings change your own
   record; the reference pages do not change anything at all, and burying the
   privacy notice among the editable rows made them look equally consequential. */

const SECTIONS = [
    {
        title: 'Account settings',
        items: [
            { to: '/personal', icon: 'fa-id-card', label: 'Personal Information', hint: 'Your name and sign-in email' },
            { to: '/ContactInfo', icon: 'fa-address-book', label: 'Contact Information', hint: 'Mobile number and address' },
            { to: '/ChangePass', icon: 'fa-key', label: 'Change Password', hint: 'Update your account password' },
        ],
    },
    {
        title: 'Safety & guidance',
        items: [
            { to: '/OfficialBFP', icon: 'fa-building-shield', label: 'Official BFP Contacts', hint: 'Hotlines and station details' },
            { to: '/HelpReport', icon: 'fa-circle-question', label: 'Reporting Guidelines', hint: 'How to report safely' },
        ],
    },
    {
        title: 'Your data',
        items: [
            { to: '/PrivacyNotice', icon: 'fa-shield-halved', label: 'Privacy Notice', hint: 'What we collect and why' },
            { to: '/ConsentDataUse', icon: 'fa-file-signature', label: 'Consent & Data Use', hint: 'How your report is used' },
        ],
    },
];

function Profile() {
    const navigate = useNavigate();
    const [profile, setProfile] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!isLoggedIn()) {
            navigate('/login');
            return undefined;
        }

        let cancelled = false;
        apiFetch('/accounts/me')
            .then((data) => { if (!cancelled) setProfile(data); })
            .catch((err) => {
                if (cancelled) return;
                if (err.status === 401) {
                    navigate('/login');
                    return;
                }
                setError('Could not load your account details.');
            });

        return () => { cancelled = true; };
    }, [navigate]);

    async function handleLogout() {
        await logout();
        navigate('/login');
    }

    const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ');
    const email = profile?.email || profile?.username || '';
    const initial = (name || email || '?').charAt(0).toUpperCase();

    return (
        <div className="civilian-dashboard">
            <CivHeader title="Profile" back="/dashboard" />

            <div className="civ-main-content">
                <section className="civ-profile-card">
                    <div className="civ-profile-avatar">{initial}</div>
                    <div className="civ-profile-identity">
                        {/* The name is the heading only when there is one. A
                            blank heading over an email reads as a failed load;
                            an email as the heading reads as an account. */}
                        <h2>{name || email || 'Your account'}</h2>
                        {name && email && <p className="civ-profile-email">{email}</p>}
                        <span className="civ-profile-badge">
                            <i className="fa-solid fa-shield-halved" /> Verified civilian
                        </span>
                    </div>
                    <Link to="/personal" className="civ-profile-edit" aria-label="Edit personal information">
                        <i className="fa-solid fa-pen" />
                    </Link>
                </section>

                {error && <p className="civ-live-warning">{error}</p>}

                {SECTIONS.map((section) => (
                    <section className="civ-settings-group" key={section.title}>
                        <h3 className="civ-settings-title">{section.title}</h3>
                        <div className="civ-settings-list">
                            {section.items.map((item) => (
                                <Link to={item.to} className="civ-settings-row" key={item.to}>
                                    <span className="civ-settings-icon">
                                        <i className={`fa-solid ${item.icon}`} />
                                    </span>
                                    <span className="civ-settings-text">
                                        <strong>{item.label}</strong>
                                        <small>{item.hint}</small>
                                    </span>
                                    <i className="fa-solid fa-chevron-right civ-settings-arrow" />
                                </Link>
                            ))}
                        </div>
                    </section>
                ))}

                <button type="button" className="civ-logout-btn" onClick={handleLogout}>
                    <i className="fa-solid fa-right-from-bracket" />
                    Log out
                </button>

                <p className="civ-live-footnote">
                    FireTrace · BFP Calapan City
                </p>
            </div>
        </div>
    );
}

export default Profile;
