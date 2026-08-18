import { Link } from 'react-router-dom';
import '../style.css';
import { useReportDraft } from '../context/useReportDraft';
import LocationPickerMap from '../components/LocationPickerMap';

function Continue2() {
    const { draft, updateDraft } = useReportDraft();
    const hasPin = draft.latitude != null && draft.longitude != null;
    const canContinue = Boolean(draft.barangay) && hasPin && draft.location_confirmed;

    function handleUseCurrentLocation() {
        if (!navigator.geolocation) {
            alert('Geolocation is not supported by this browser.');
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (position) => {
                updateDraft({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                });
            },
            () => {
                alert('Could not get your current location. Please pin it on the map instead.');
            }
        );
    }

    return (
        <center>
            <header className="top-bar">
                <h2 className="firetraceheader">Fire Report Incident</h2>
                <p>2 of 4</p>
            </header>
            <button className="pinpointbtn" onClick={handleUseCurrentLocation} type="button">
                USE MY CURRENT LOCATION
            </button>

            <div style={{ width: '90%', margin: '12px 0' }}>
                <LocationPickerMap
                    latitude={draft.latitude}
                    longitude={draft.longitude}
                    onChange={(lat, lng) => updateDraft({ latitude: lat, longitude: lng })}
                />
            </div>

            <p className="barangay-text">Barangay</p>
            <div>
                <select
                    id="incident-select"
                    name="incident-select"
                    value={draft.barangay}
                    onChange={(e) => updateDraft({ barangay: e.target.value })}
                >
                    <option value="">Select Barangay</option>
                    <option value="Balingayan">Balingayan</option>
                    <option value="Balite">Balite</option>
                    <option value="Baruyan">Baruyan</option>
                    <option value="Batino">Batino</option>
                    <option value="Bayanan I">Bayanan I</option>
                    <option value="Bayanan II">Bayanan II</option>
                    <option value="Biga">Biga</option>
                    <option value="Bondoc">Bondoc</option>
                    <option value="Bucayao">Bucayao</option>
                    <option value="Buhuan">Buhuan</option>
                    <option value="Bulusan">Bulusan</option>
                    <option value="Calero">Calero</option>
                    <option value="Camansihan">Camansihan</option>
                    <option value="Camilmil">Camilmil</option>
                    <option value="Canubing I">Canubing I</option>
                    <option value="Canubing II">Canubing II</option>
                    <option value="Comunal">Comunal</option>
                    <option value="Guinobatan">Guinobatan</option>
                    <option value="Gulod">Gulod</option>
                    <option value="Gutad">Gutad</option>
                    <option value="Ibaba East">Ibaba East</option>
                    <option value="Ibaba West">Ibaba West</option>
                    <option value="Ilaya">Ilaya</option>
                    <option value="Lalud">Lalud</option>
                    <option value="Lazareto">Lazareto</option>
                    <option value="Libis">Libis</option>
                    <option value="LumangBayan">LumangBayan</option>
                    <option value="Mahal Na Pangalan">Mahal Na Pangalan</option>
                    <option value="Maidlang">Maidlang</option>
                    <option value="Malad">Malad</option>
                    <option value="Malamig">Malamig</option>
                    <option value="Managpi">Managpi</option>
                    <option value="Masipit">Masipit</option>
                    <option value="Nag-Iba I">Nag-Iba I</option>
                    <option value="Nag-Iba II">Nag-Iba II</option>
                    <option value="Navotas">Navotas</option>
                    <option value="Pachoca">Pachoca</option>
                    <option value="Palhi">Palhi</option>
                    <option value="Panggalan">Panggalan</option>
                    <option value="Parang">Parang</option>
                    <option value="Patas">Patas</option>
                    <option value="Personas">Personas</option>
                    <option value="Puting Tubig">Puting Tubig</option>
                    <option value="Salong">Salong</option>
                    <option value="San Antonio">San Antonio</option>
                    <option value="San Vicente Central">San Vicente Central</option>
                    <option value="San Vicente East">San Vicente East</option>
                    <option value="San Vicente North">San Vicente North</option>
                    <option value="San Vicente South">San Vicente South</option>
                    <option value="South Vicente West">South Vicente West</option>
                    <option value="Sta. Cruz">Sta. Cruz</option>
                    <option value="Sto. Niño">Sto. Niño</option>
                    <option value="Sapul">Sapul</option>
                    <option value="Silonay">Silonay</option>
                    <option value="Sta. Maria Village">Sta. Maria Village</option>
                    <option value="Sta. Rita">Sta. Rita</option>
                    <option value="Suqui">Suqui</option>
                    <option value="Tawagan">Tawagan</option>
                    <option value="Tawiran">Tawiran</option>
                    <option value="Tibag">Tibag</option>
                    <option value="Wawa">Wawa</option>
                </select>
            </div>

            <p className="address-text">Address / Landmark</p>
            <div>
                <textarea className="addresstxt"
                    id="description"
                    name="description"
                    placeholder="Enter Address..."
                    value={draft.address}
                    onChange={(e) => updateDraft({ address: e.target.value })}>
                </textarea>
            </div>
            <p className="latnlng">
                Lat: {hasPin ? draft.latitude.toFixed(6) : '—'} &nbsp;&nbsp;&nbsp;&nbsp;
                Lng: {hasPin ? draft.longitude.toFixed(6) : '—'}
            </p>
            <label className="checkbox-label">
                <input
                    type="checkbox"
                    checked={draft.location_confirmed}
                    disabled={!hasPin}
                    onChange={(e) => updateDraft({ location_confirmed: e.target.checked })}
                />
                <span className="checkbox-txt">I confirm this pin identifies the reported location.</span>
            </label>

            <div className="backcontinue2-container">
            <button className="backbtn2"><Link to="/report">Back</Link></button>
            <button className="continuebtn2" disabled={!canContinue}>
                {canContinue ? <Link to="/continuethird">Continue</Link> : 'Continue'}
            </button>
            </div>
            <nav className="bottom-nav">

                <Link className="bottom-btn" to="/dashboard">Home</Link>
                <Link className="bottom-btn-active" to="/report">Report</Link>
                <Link className="bottom-btn" to="/myreport">My Report</Link>
                <Link className="bottom-btn" to="/">Notifications</Link>
                <Link className="bottom-btn" to="/">Profile</Link>

            </nav>
        </center>
    );
}

export default Continue2;
