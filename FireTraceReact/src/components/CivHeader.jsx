import { Link } from 'react-router-dom';
import ThemeToggle from './ThemeToggle';
import { useNavDrawer } from '../context/useNavDrawer';

/* The one civilian header.

   Every screen used to draw its own: some had a floating red hamburger over
   the logo, some a header menu button that went straight to /profile, some
   only a title. That is how the phone ended up showing two hamburgers and a
   gear at once. One component means the menu button is in the same place on
   every screen, and a new page gets it by construction.

   `back` turns the left slot into a back control for a screen that is part of
   a flow (a wizard step, a report someone opened); `title` replaces the
   wordmark for a screen that is a place rather than the app itself. */
function CivHeader({ title, subtitle, back, onBack, bell = false }) {
    const { toggle } = useNavDrawer();

    return (
        <header className="civ-header">
            <div className="civ-header-left">
                {back ? (
                    typeof back === 'string' ? (
                        <Link to={back} className="civ-back-btn" aria-label="Go back">
                            <i className="fa-solid fa-arrow-left" />
                        </Link>
                    ) : (
                        <button type="button" className="civ-back-btn" onClick={onBack} aria-label="Go back">
                            <i className="fa-solid fa-arrow-left" />
                        </button>
                    )
                ) : null}

                {title ? (
                    <div className="civ-header-titles">
                        <h1 className="civ-header-title">{title}</h1>
                        {subtitle && <p className="civ-header-subtitle">{subtitle}</p>}
                    </div>
                ) : (
                    <div className="civ-logo-container">
                        <i className="fa-solid fa-fire-flame-curved civ-logo-icon" />
                        <div className="civ-brand">
                            <span className="civ-brand-fire">FIRE</span>
                            <span className="civ-brand-trace">TRACE</span>
                        </div>
                    </div>
                )}
            </div>

            <div className="civ-header-right">
                <ThemeToggle />
                {bell && (
                    <Link to="/Notifications" className="civ-notification-icon" aria-label="Alerts">
                        <i className="fa-solid fa-bell" />
                        <span className="civ-notification-badge" />
                    </Link>
                )}
                <button
                    type="button"
                    className="civ-menu-btn"
                    onClick={toggle}
                    aria-label="Open menu"
                >
                    <i className="fa-solid fa-bars" />
                </button>
            </div>
        </header>
    );
}

export default CivHeader;
