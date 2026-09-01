import '../../style.css';
import CivHeader from '../../components/CivHeader';
import { BFP_STATION } from '../../lib/contacts';

/* Station contact details.

   The rows that can be acted on are actionable: a hotline is a tel: link and
   the address is a mailto:, because reading a number off a screen and typing
   it into the dialer during a fire is exactly the friction this page exists to
   remove. Everything comes from lib/contacts.js, so this page and the Home
   screen's call button can never list different numbers. */
function OfficialBFP() {
    return (
        <div className="civilian-dashboard">
            <CivHeader title="Official BFP Contacts" back="/profile" />

            <div className="civ-main-content">
                <section className="civ-station-card">
                    <div className="civ-station-head">
                        <span className="civ-station-icon"><i className="fa-solid fa-building-shield" /></span>
                        <h2>{BFP_STATION.name}</h2>
                    </div>

                    <div className="civ-station-rows">
                        {BFP_STATION.contacts.map((contact) => {
                            const href = contact.tel ? `tel:${contact.tel}`
                                : contact.sms ? `sms:${contact.sms}`
                                : contact.mail ? `mailto:${contact.mail}`
                                : null;
                            const icon = contact.tel ? 'fa-phone'
                                : contact.sms ? 'fa-comment-sms'
                                : contact.mail ? 'fa-envelope'
                                : 'fa-hashtag';

                            const body = (
                                <>
                                    <span className="civ-station-icon-sm"><i className={`fa-solid ${icon}`} /></span>
                                    <span className="civ-station-text">
                                        <small>{contact.label}</small>
                                        <strong>{contact.value}</strong>
                                    </span>
                                    {href && <i className="fa-solid fa-chevron-right civ-settings-arrow" />}
                                </>
                            );

                            return href ? (
                                <a className="civ-station-row is-actionable" key={contact.label} href={href}>
                                    {body}
                                </a>
                            ) : (
                                <div className="civ-station-row" key={contact.label}>{body}</div>
                            );
                        })}
                    </div>

                    <p className="civ-station-notice">
                        <i className="fa-solid fa-triangle-exclamation" />
                        For emergencies, always call the official hotline first. Filing a
                        report in this app does not replace that call.
                    </p>
                </section>
            </div>
        </div>
    );
}

export default OfficialBFP;
