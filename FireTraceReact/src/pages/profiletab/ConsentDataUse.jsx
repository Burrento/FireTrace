import '../../style.css';
import CivHeader from '../../components/CivHeader';

/* Also an empty stub before this. It is deliberately not a settings screen
   with toggles: FireTrace has no optional processing to switch off. Everything
   it records is what a fire report is made of, so a toggle would either do
   nothing or break the report. Saying that plainly is more honest than a row
   of switches that all have to stay on.

   The one genuine choice a reporter has is the photograph, which is optional
   in the wizard and stays optional here -- so that is what this page names. */

const POINTS = [
    {
        icon: 'fa-file-signature',
        title: 'What you agree to when you file a report',
        body: 'Filing a report shares its contents — type, description, location, time, and the photograph if you attached one — with BFP Calapan personnel, along with the name and contact details on your account so they can follow up.',
    },
    {
        icon: 'fa-camera',
        title: 'The photograph is optional',
        body: 'A report with no photograph is submitted and reviewed exactly the same way. Attaching one is a choice you make on the third step, and you can remove it before you submit.',
    },
    {
        icon: 'fa-location-crosshairs',
        title: 'Location is required',
        body: 'A fire report without a location cannot be responded to, so this is the one thing that cannot be left out. You choose how it is captured: pin it on the map yourself, or let the app read your device GPS.',
    },
    {
        icon: 'fa-eye-slash',
        title: 'What is never shared publicly',
        body: 'Your name, your contact details, your description and your photograph are for BFP personnel only. The live map other residents see carries the fire — type, barangay, status, time — and nothing that identifies who reported it.',
    },
    {
        icon: 'fa-chart-simple',
        title: 'Use in statistics',
        body: 'Reports are counted in the station’s own figures: how many incidents, where, and how long a response took. These are aggregate counts. No profile is built about you, and nothing about you is sold or passed to advertisers.',
    },
    {
        icon: 'fa-hand',
        title: 'Withdrawing',
        body: 'Because a filed report becomes part of the incident record BFP relies on, it is not deleted on request. You can stop using the app at any time, and ask BFP Calapan to close your account and correct your details.',
    },
];

function ConsentDataUse() {
    return (
        <div className="civilian-dashboard">
            <CivHeader title="Consent & Data Use" back="/profile" />

            <div className="civ-main-content">
                <p className="civ-doc-lead">
                    There are no consent switches here, because FireTrace does not
                    collect anything optional to switch off. What it records is what
                    a fire report is made of — here is exactly what that means.
                </p>

                <div className="civ-guide-list">
                    {POINTS.map((point) => (
                        <article className="civ-guide-card" key={point.title}>
                            <span className="civ-guide-icon"><i className={`fa-solid ${point.icon}`} /></span>
                            <div>
                                <h3>{point.title}</h3>
                                <p>{point.body}</p>
                            </div>
                        </article>
                    ))}
                </div>

                <p className="civ-doc-callout">
                    <i className="fa-solid fa-shield-halved" />
                    The full detail of what is stored and who can read it is in the
                    Privacy Notice.
                </p>
            </div>
        </div>
    );
}

export default ConsentDataUse;
