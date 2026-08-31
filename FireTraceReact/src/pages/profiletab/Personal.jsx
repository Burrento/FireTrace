import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../../style.css';
import { apiFetch } from '../../api';

/* Personal info, backed by GET/PATCH /accounts/me.

   Email is shown but not editable. The username *is* the email address here,
   and login resolves either one back to the stored username -- letting them
   drift apart through this form would leave someone changing their address and
   then finding they still have to sign in with the old one. The server refuses
   the edit too; this input is disabled so the refusal is not a surprise. */

function Personal() {
  const navigate = useNavigate();

  const [form, setForm] = useState(null);
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;

    apiFetch('/accounts/me')
      .then((profile) => {
        if (cancelled) return;
        setEmail(profile.email || profile.username || '');
        setForm({
          first_name: profile.first_name || '',
          last_name: profile.last_name || '',
        });
      })
      .catch((err) => {
        if (cancelled) return;
        if (err.status === 401) {
          navigate('/login');
          return;
        }
        setError(err.message || 'Could not load your profile.');
      });

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  function set(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
    setSaved(false);
  }

  async function handleSave(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await apiFetch('/accounts/me', {
        method: 'PATCH',
        body: JSON.stringify(form),
      });
      setSaved(true);
    } catch (err) {
      setError(err.message || 'Could not save your changes.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page">
      <header className="top-bar">
        <h2 className="firetraceheader">EDIT PROFILE</h2>
      </header>

      <form className="edit-profile-form" onSubmit={handleSave}>
        <p className="PersoName">First Name</p>
        <input
          type="text"
          id="first-name"
          name="first_name"
          autoComplete="given-name"
          disabled={!form}
          value={form?.first_name ?? ''}
          onChange={(event) => set('first_name', event.target.value)}
        />

        <p>Last Name</p>
        <input
          type="text"
          id="last-name"
          name="last_name"
          autoComplete="family-name"
          disabled={!form}
          value={form?.last_name ?? ''}
          onChange={(event) => set('last_name', event.target.value)}
        />

        <p>Email</p>
        <input type="email" id="email" name="email" value={email} disabled readOnly />
        <p>
          Your email address is also how you sign in, so it cannot be changed
          here. Contact BFP if it needs to be updated.
        </p>

        {error && <p className="auth-error">{error}</p>}
        {saved && <p className="form-success">Saved.</p>}

        <button type="submit" className="SaveChanges-btn" disabled={saving || !form}>
          {saving ? 'SAVING…' : 'SAVE CHANGES'}
        </button>
      </form>

      <button type="button" className="Cancel-btn" onClick={() => navigate(-1)}>
        CANCEL
      </button>
    </div>
  );
}

export default Personal;
