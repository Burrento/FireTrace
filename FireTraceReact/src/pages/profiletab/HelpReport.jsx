import '../../style.css';
import CivHeader from '../../components/CivHeader';

const GUIDE_ITEMS = [
    {
        icon: 'fa-person-running',
        title: 'How to report safely',
        description: 'Get yourself out first. Report only when you are at a safe distance — never from inside a burning building.',
    },
    {
        icon: 'fa-location-dot',
        title: 'What to include',
        description: 'Pin the location as precisely as you can, pick the right incident type, and describe what you can actually see.',
    },
    {
        icon: 'fa-camera',
        title: 'Supporting photos',
        description: 'A photograph helps personnel judge the size of a fire before they arrive, but it is optional. Never go back for one.',
    },
    {
        icon: 'fa-clipboard-check',
        title: 'After you submit',
        description: 'Your report goes to BFP personnel for review. You can follow its status under My Reports, and once it is verified it appears on the live map.',
    },
    {
        icon: 'fa-copy',
        title: 'If someone already reported it',
        description: 'File it anyway. Reports near each other in place and time are flagged for review — personnel decide, and a second account often adds detail.',
    },
];

/* Reporting guidance. Ordered the way an emergency actually unfolds: get safe,
   file it, then what happens next -- rather than as a list of app features. */
function HelpReport() {
    return (
        <div className="civilian-dashboard">
            <CivHeader title="Reporting Guidelines" back="/profile" />

            <div className="civ-main-content">
                <p className="civ-doc-lead">
                    FireTrace sends what you file straight to BFP Calapan. These
                    are the things worth knowing before you use it.
                </p>

                <div className="civ-guide-list">
                    {GUIDE_ITEMS.map((item) => (
                        <article className="civ-guide-card" key={item.title}>
                            <span className="civ-guide-icon"><i className={`fa-solid ${item.icon}`} /></span>
                            <div>
                                <h3>{item.title}</h3>
                                <p>{item.description}</p>
                            </div>
                        </article>
                    ))}
                </div>

                <p className="civ-doc-callout">
                    <i className="fa-solid fa-phone" />
                    In a life-threatening emergency, call BFP Calapan first. This
                    app is a report, not a dispatch line.
                </p>
            </div>
        </div>
    );
}

export default HelpReport;
