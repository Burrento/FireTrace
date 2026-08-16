import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../style.css';
import { API_BASE_URL } from '../api';

function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const access = localStorage.getItem('access');
    if (!access) {
      navigate('/login');
      return;
    }
    fetch(`${API_BASE_URL}/accounts/me`, {
      headers: { Authorization: `Bearer ${access}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Session expired');
        return res.json();
      })
      .then(setUser)
      .catch(() => {
        localStorage.removeItem('access');
        localStorage.removeItem('refresh');
        navigate('/login');
      });
  }, [navigate]);

  function handleLogout() {
    localStorage.removeItem('access');
    localStorage.removeItem('refresh');
    navigate('/login');
  }

  if (!user) {
    return <center>{error || 'Loading…'}</center>;
  }

  return (
    <center>
      <div className="welcome-header">
        <i className="fa-solid fa-fire-flame-simple fire-icon"></i>
        <h1 className="firetrace1"><b>FIRETRACE</b></h1>
      </div>
      {user.user_type === 'bfp' ? (
        <h2>You are a BFP personnel</h2>
      ) : (
        <h2>You are a Civilian</h2>
      )}
      <p>Welcome, {user.username}</p>
      <button className="account" onClick={handleLogout}>Log out</button>
    </center>
  );
}

export default Dashboard;
