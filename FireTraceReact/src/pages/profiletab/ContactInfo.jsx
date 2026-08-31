import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../../style.css';
import { apiFetch } from '../../api';

/* Contact numbers, backed by GET/PATCH /accounts/me.

   The design called for an SMS one-time code before a number change. There is
   no SMS provider wired into FireTrace -- the email backend is console-only
   and no gateway is configured -- so a "SEND OTP" button here could only ever
   have pretended to send one. The number saves directly instead, which is what
   the system can actually honour.

   Numbers are stored as typed: local (09xx), international (+639xx) and spaced
   forms are all in use, and rejecting one BFP could still dial would be worse
   than accepting it. */

function ContactInfo() {
  const navigate = useNavigate();

  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;

    apiFetch('/accounts/me')
      .then((profile) => {
        if (cancelled) return;
        setForm({
          phone_number: profile.phone_number || '',
          alternate_phone_number: profile.alternate_phone_number || '',
        });
      })
      .catch((err) => {
        if (cancelled) return;
        if (err.status === 401) {
          navigate('/login');
          return;
        }
        setError(err.message || 'Could not load your contact details.');
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
      setError(err.message || 'Could not save your contact details.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page">
      <header className="top-bar">
        <h2 className="firetraceheader">CONTACT INFO</h2>
      </header>

      <form className="edit-profile-form" onSubmit={handleSave}>
        <p className="PersoName">Mobile Number</p>
        <input
          type="tel"
          id="mobile-number"
          name="phone_number"
          autoComplete="tel"
          placeholder="09XX XXX XXXX"
          disabled={!form}
          value={form?.phone_number ?? ''}
          onChange={(event) => set('phone_number', event.target.value)}
        />

        <p>Alternative Contact Number (Optional)</p>
        <input
          type="tel"
          id="alternate-number"
          name="alternate_phone_number"
          autoComplete="tel"
          placeholder="Another number BFP can reach"
          disabled={!form}
          value={form?.alternate_phone_number ?? ''}
          onChange={(event) => set('alternate_phone_number', event.target.value)}
        />

        <p>
          BFP uses these numbers to follow up on a report you have filed. They
          are not used to sign you in.
        </p>

        {error && <p className="auth-error">{error}</p>}
        {saved && <p className="form-success">Saved.</p>}

        <button type="submit" className="UpdateNumber-btn" disabled={saving || !form}>
          {saving ? 'SAVING…' : 'UPDATE NUMBER'}
        </button>
      </form>

      <button type="button" className="Cancel-btn" onClick={() => navigate(-1)}>
        CANCEL
      </button>
    </div>
  );
}

export default ContactInfo;
