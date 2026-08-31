import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../../style.css';
import { apiFetch } from '../../api';

/* Password change, backed by POST /accounts/me/password.

   The current password is required even though the request already carries a
   token: a phone left unlocked on a jeepney would otherwise be enough to lock
   its owner out of their own account.

   The confirm field is checked here rather than sent. The server has no use
   for it -- it validates the new password itself, against Django's configured
   validators -- and posting it would only widen what travels over the wire. */

function ChangePass() {
  const navigate = useNavigate();

  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  function set(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
    setError('');
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (form.next !== form.confirm) {
      setError('The new passwords do not match.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await apiFetch('/accounts/me/password', {
        method: 'POST',
        body: JSON.stringify({
          current_password: form.current,
          new_password: form.next,
        }),
      });
      setDone(true);
      setForm({ current: '', next: '', confirm: '' });
    } catch (err) {
      // api.js keeps DRF's field names, so a rejected password says whether it
      // was the current one that was wrong or the new one that was too weak.
      setError(err.message || 'Could not change your password.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page">
      <header className="top-bar">
        <h2 className="firetraceheader">CHANGE PASSWORD</h2>
      </header>

      <form className="edit-profile-form" onSubmit={handleSubmit}>
        <p className="PersoName">Current Password</p>
        <input
          type="password"
          id="current-password"
          name="current_password"
          autoComplete="current-password"
          value={form.current}
          onChange={(event) => set('current', event.target.value)}
        />

        <p>New Password</p>
        <input
          type="password"
          id="new-password"
          name="new_password"
          autoComplete="new-password"
          value={form.next}
          onChange={(event) => set('next', event.target.value)}
        />

        <p>Confirm New Password</p>
        <input
          type="password"
          id="confirm-password"
          name="confirm_password"
          autoComplete="new-password"
          value={form.confirm}
          onChange={(event) => set('confirm', event.target.value)}
        />

        <p>At least 8 characters</p>
        <p>Includes letters and numbers</p>
        <p>Not similar to your personal information</p>

        {error && <p className="auth-error">{error}</p>}
        {done && <p className="form-success">Your password has been changed.</p>}

        <button
          type="submit"
          className="UpdatePass-btn"
          disabled={saving || !form.current || !form.next || !form.confirm}
        >
          {saving ? 'UPDATING…' : 'UPDATE PASSWORD'}
        </button>
      </form>

      <button type="button" className="Cancel-btn" onClick={() => navigate(-1)}>
        CANCEL
      </button>
    </div>
  );
}

export default ChangePass;
