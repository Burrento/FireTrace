import { Link } from 'react-router-dom';
import '../../style.css';
import { useEffect, useState } from 'react';
import { API_BASE_URL } from '../../api';

function Welcome() {
  const [message, setMessage] = useState('Connecting to backend...');
  useEffect(() => {
    fetch(`${API_BASE_URL}/accounts/ping`)
      .then((res) => res.json())
      .then((data) => setMessage(data.message))
      .catch(() => setMessage('Could not reach'));
  }, []);


  return (
    <center>
      <div className="welcome-header">
        <i className="fa-solid fa-fire-flame-simple fire-icon"></i>
        <h1 className="firetrace1"><b>FIRETRACE</b></h1>
        <p className="geo">Geolocation-based fire incident reporting<br />
        for BFP-Calapan City Fire Station</p>
      </div>
      <button className="started"><Link to="/create">Get started</Link></button><br />
      <button className="account"><Link to="/login">I already have an account</Link></button>
      <p className="sentence1">For life-threatening emergencies, call the BPF hotline directly. This<br />
      app suplements, not replaces, emergency communication</p>
    </center>
  );
}

export default Welcome;
