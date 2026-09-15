import { BFP_HOTLINE, BFP_HOTLINE_DISPLAY } from '../lib/contacts';

/* The official hotline and the supplementary-use warning. The study requires
   both on registration, login, reporting and failure screens, so an account or
   system problem never stands between someone and the station. `children`
   leads the sentence when a screen has something to add ("Report not sent."). */
function EmergencyNotice({ children }) {
  return (
    <div className="login-emergency-alert" role="note">
      <i className="fa-solid fa-triangle-exclamation"></i>
      <p>
        {children ? <strong>{children} </strong> : null}
        FireTrace does not dispatch firefighters. For immediate help call the BFP
        Hotline <a href={`tel:${BFP_HOTLINE.trim()}`}>{BFP_HOTLINE_DISPLAY}</a> or 911.
      </p>
    </div>
  );
}

export default EmergencyNotice;
