import '../../style.css';
import CivHeader from '../../components/CivHeader';

/* Was an empty page with a Cancel button. The content below describes what
   FireTrace actually stores and who can read it -- each claim is traceable to
   the code: the fields are IncidentReport's columns, the "never deleted" line
   is the design rule that a civilian submission is kept verbatim, and the map
   paragraph is what OngoingFireMapView does and does not return.

   Written from the implementation rather than from a template on purpose: a
   privacy notice that promises something the software does not do is worse
   than none. It still needs a read by whoever signs off for BFP before this is
   presented as the station's own notice. */

const SECTIONS = [
    {
        title: 'What we collect',
        body: [
            'Your account: the name you enter, your email address (which is also your sign-in), and any contact numbers you add.',
            'Each report you file: the incident type, your description, the barangay and address, the coordinates of the pin or your device GPS, and the photograph if you attach one.',
            'How the location was captured — a map pin, device GPS, or a geocoded address — and the accuracy your phone reported. This is what determines whether a report is precise enough to plot.',
        ],
    },
    {
        title: 'Why we collect it',
        body: [
            'So BFP Calapan personnel can assess a fire and respond to it, and so they can contact you if a report needs to be clarified.',
            'So reports describing the same fire can be recognised as related. Reports close together in place and time are flagged for a person to review; nothing is merged or discarded automatically.',
            'So the station can count and review incidents afterwards. These figures are descriptive — counts, trends and observed response times. FireTrace does not score, predict or profile anyone.',
        ],
    },
    {
        title: 'Who can see it',
        body: [
            'Authorised BFP Calapan personnel can see your report in full, including your name and the photograph, because that is what responding to it requires.',
            'Other residents cannot. The public live map shows only fires personnel have verified, and it carries the type, barangay, status and time — never the reporter, the description or the photograph.',
            'Actions personnel take on a report are recorded in an audit log, so it is always possible to see who changed what and when.',
        ],
    },
    {
        title: 'How long it is kept',
        body: [
            'Reports are kept as a permanent record of the incident and are not deleted, including when several turn out to describe the same fire. A duplicate is marked as one, never erased — the account you gave stays exactly as you filed it.',
            'Your account details stay until the account is closed. Ask BFP Calapan to close it, and to correct anything recorded about you that is wrong.',
        ],
    },
    {
        title: 'Your rights',
        body: [
            'Under the Data Privacy Act of 2012 (RA 10173) you may ask what personal data is held about you, have inaccurate details corrected, object to how it is processed, and complain to the National Privacy Commission.',
            'Requests go to BFP Calapan City Fire Station using the contact details on the Official BFP Contacts page.',
        ],
    },
];

function PrivacyNotice() {
    return (
        <div className="civilian-dashboard">
            <CivHeader title="Privacy Notice" back="/profile" />

            <div className="civ-main-content">
                <p className="civ-doc-lead">
                    FireTrace is operated for the Bureau of Fire Protection, Calapan
                    City. This notice explains what the app records when you use it,
                    and who is able to read it.
                </p>

                {SECTIONS.map((section) => (
                    <section className="civ-doc-section" key={section.title}>
                        <h2>{section.title}</h2>
                        {section.body.map((paragraph) => (
                            <p key={paragraph}>{paragraph}</p>
                        ))}
                    </section>
                ))}

                <p className="civ-doc-callout">
                    <i className="fa-solid fa-circle-info" />
                    Questions about your data go to BFP Calapan City Fire Station —
                    see Official BFP Contacts.
                </p>
            </div>
        </div>
    );
}

export default PrivacyNotice;
