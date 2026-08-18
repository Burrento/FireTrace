import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import '../style.css';

function Continue2() {
    return (
        <center>
            <header className="top-bar">
                <h2 className="firetraceheader">Fire Report Incident</h2>
                <p>2 of 4</p>
            </header>
            <button className="pinpointbtn">USE MY CURRENT LOCATION</button>

            <p className="barangay-text">Barangay</p>
            <div>
                <select id="incident-select" name="incident-select">
                    <option value="">Select Barangay</option>
                    <option value="barangay1">Balingayan</option>
                    <option value="barangay2">Balite</option>
                    <option value="barangay3">Baruyan</option>
                    <option value="barangay4">Batino</option>
                    <option value="barangay5">Bayanan I</option>
                    <option value="barangay6">Bayanan II</option>
                    <option value="barangay7">Biga</option>
                    <option value="barangay8">Bondoc</option>
                    <option value="barangay9">Bucayao</option>
                    <option value="barangay10">Buhuan</option>
                    <option value="barangay11">Bulusan</option>
                    <option value="barangay12">Calero</option>
                    <option value="barangay13">Camansihan</option>
                    <option value="barangay14">Camilmil</option>
                    <option value="barangay15">Canubing I</option>
                    <option value="barangay16">Canubing II</option>
                    <option value="barangay17">Comunal</option>
                    <option value="barangay18">Guinobatan</option>
                    <option value="barangay19">Gulod</option>
                    <option value="barangay20">Gutad</option>
                    <option value="barangay21">Ibaba East</option>
                    <option value="barangay22">Ibaba West</option>
                    <option value="barangay23">Ilaya</option>
                    <option value="barangay24">Lalud</option>
                    <option value="barangay25">Lazareto</option>
                    <option value="barangay26">Libis</option>
                    <option value="barangay27">LumangBayan</option>
                    <option value="barangay28">Mahal Na Pangalan</option>
                    <option value="barangay29">Maidlang</option>
                    <option value="barangay30">Malad</option>
                    <option value="barangay31">Malamig</option>
                    <option value="barangay32">Managpi</option>
                    <option value="barangay33">Masipit</option>
                    <option value="barangay34">Nag-Iba I</option>
                    <option value="barangay35">Nag-Iba II</option>
                    <option value="barangay36">Navotas</option>
                    <option value="barangay37">Pachoca</option>
                    <option value="barangay38">Palhi</option>
                    <option value="barangay39">Panggalan</option>
                    <option value="barangay40">Parang</option>
                    <option value="barangay41">Patas</option>
                    <option value="barangay42">Personas</option>
                    <option value="barangay43">Puting Tubig</option>
                    <option value="barangay44">Salong</option>
                    <option value="barangay45">San Antonio</option>
                    <option value="barangay46">San Vicente Central</option>
                    <option value="barangay47">San Vicente East</option>
                    <option value="barangay48">San Vicente North</option>
                    <option value="barangay49">San Vicente South</option>
                    <option value="barangay50">South Vicente West</option>
                    <option value="barangay51">Sta. Cruz</option>
                    <option value="barangay52">Sto. Niño</option>
                    <option value="barangay53">Sapul</option>
                    <option value="barangay54">Silonay</option>
                    <option value="barangay55">Sta. Maria Village</option>
                    <option value="barangay56">Sta. Rita</option>
                    <option value="barangay57">Suqui</option>
                    <option value="barangay58">Tawagan</option>
                    <option value="barangay59">Tawiran</option>
                    <option value="barangay60">Tibag</option>
                    <option value="barangay61">Wawa</option>
                </select>
            </div>

            <p className="address-text">Address / Landmark</p>
            <div>
                <textarea className="addresstxt"
                    id="description"
                    name="description"
                    placeholder="Enter Address...">
                </textarea>
            </div>
            <p className="latnlng">Lat:&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Lng:</p>
            <label className="checkbox-label">
                <input type="checkbox" />
                <span className = "checkbox-txt">I confirm this pin identifies the reported location.</span>
            </label>

            <div className="backcontinue2-container">
            <button className="backbtn2"><Link to="/report">Back</Link></button>
            <button className="continuebtn2"><Link to="/continuethird">Continue</Link></button>
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