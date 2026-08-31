import { useNavigate } from 'react-router-dom';
import '../../style.css';
import { logout } from '../../api';

function Profile() {
    const navigate = useNavigate();

    async function handleLogout() {
        await logout();
        navigate('/login');
    }

  return (
    <div className="page">
            <header className="top-bar">
                <h2 className="firetraceheader">MY PROFILE</h2>
            </header>
            <div>

              <button className="Personal" onClick={() => navigate('/personal')}>
                Personal Info<br />
                <span className="profile-subtext">View and edit your information</span>
              </button><hr />

              <button className="Change" onClick={() => navigate('/ChangePass')}>
                Change Password<br />
                <span className="profile-subtext">Update your account password</span>
              </button><hr />

              <button className="ContactInfo" onClick={() => navigate('/ContactInfo')}>
                Contact Information<br />
                <span className="profile-subtext">Manage your contact details</span>
              </button><hr />

              <button className="PrivacyNotice" onClick={() => navigate('/PrivacyNotice')}>
                Privacy Notice<br />
                <span className="profile-subtext">How we collect and protect data</span>
              </button><hr />

              <button className="Consent" onClick={() => navigate('/ConsentDataUse')}>
                Consent & Data Use<br />
                <span className="profile-subtext">Your consent and data choices</span>
              </button><hr />

              <button className="Help" onClick={() => navigate('/HelpReport')}>
                Help & Reporting Guidelines<br />
                <span className="profile-subtext">Learn how to report safely</span>
              </button><hr />

              <button className="OfficialBFP" onClick={() => navigate('/OfficialBFP')}>
                Official BFP Contact Details<br />
                <span className="profile-subtext">Emergency and hotlines</span>
              </button><hr />

              <button className="Logout2" onClick={handleLogout}>
                Log Out<br />
                <span className="profile-subtext">Sign out of your account</span>
              </button>

            </div>
    </div>
  );
}

export default Profile;
