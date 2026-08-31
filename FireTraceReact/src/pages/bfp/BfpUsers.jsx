import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../api';
import BfpShell from './BfpShell';
import { useBfpPage, usePolledResource } from './useDashboardData';

/* Users, from /accounts/users.

   This is the one screen that shows one person's account details to another,
   which is why the endpoint behind it is the only place outside the reporter's
   own views where a civilian record is readable.

   Promotion to BFP happens here and nowhere else. Public registration always
   creates a civilian and `user_type` is read-only on both the registration and
   the profile serializers, so this list is the single deliberate route into
   personnel access. The server refuses to let an operator change their own
   role or deactivate themselves; the controls are disabled here too so the
   refusal is not a surprise. */

const REFRESH_MS = 30000;

const ROLE_LABEL = {
  bfp: 'BFP Personnel',
  civilian: 'Civilian',
};

function useDebounced(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function fmtDate(iso) {
  if (!iso) return 'Never';
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
}

function BfpUsers() {
  const { tick, lastRefresh, refreshNow, live, onAuthError } = useBfpPage(REFRESH_MS);

  const [query, setQuery] = useState('');
  const [role, setRole] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [message, setMessage] = useState('');

  const debouncedQuery = useDebounced(query);

  const path = useMemo(() => {
    const search = new URLSearchParams();
    if (debouncedQuery.trim()) search.set('q', debouncedQuery.trim());
    if (role) search.set('user_type', role);
    if (activeFilter) search.set('is_active', activeFilter);
    const suffix = search.toString();
    return suffix ? `/accounts/users?${suffix}` : '/accounts/users';
  }, [debouncedQuery, role, activeFilter]);

  const { data, loading, error } = usePolledResource(path, tick, { onAuthError });
  const me = usePolledResource('/accounts/me', tick, { onAuthError });

  const users = data ?? [];
  const myId = me.data?.id;

  async function update(user, patch, describe) {
    setBusyId(user.id);
    setMessage('');
    try {
      await apiFetch(`/accounts/users/${user.id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      setMessage(`${user.username}: ${describe}`);
      // Refetch rather than patching local state: the row also carries a report
      // count and a last-login the server owns.
      refreshNow();
    } catch (err) {
      setMessage(err.message || 'Update failed.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <BfpShell live={live} lastRefresh={lastRefresh} refreshNow={refreshNow}>
      <h1 className="bfp-page-title">Users</h1>

      <section className="bfp-panel">
        <div className="bfp-panel-head">
          <h2 className="bfp-panel-title">Accounts</h2>
          <span className="bfp-panel-sub">
            {loading && !data ? 'Loading…' : `${users.length} shown`}
          </span>
        </div>

        <div className="bfp-filters">
          <input
            className="bfp-filter-input"
            placeholder="Search name, email…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <select
            className="bfp-filter-select"
            value={role}
            onChange={(event) => setRole(event.target.value)}
          >
            <option value="">All roles</option>
            <option value="bfp">BFP Personnel</option>
            <option value="civilian">Civilian</option>
          </select>
          <select
            className="bfp-filter-select"
            value={activeFilter}
            onChange={(event) => setActiveFilter(event.target.value)}
          >
            <option value="">Active and suspended</option>
            <option value="true">Active only</option>
            <option value="false">Suspended only</option>
          </select>
        </div>

        {error && <p className="bfp-inline-error">{error}</p>}
        {message && <p className="bfp-settings-saved">{message}</p>}

        <div className="bfp-table-wrap">
          <table className="bfp-table">
            <thead>
              <tr>
                <th>Account</th>
                <th>Name</th>
                <th>Role</th>
                <th>Status</th>
                <th>Reports</th>
                <th>Joined</th>
                <th>Last seen</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const isSelf = user.id === myId;
                const locked = isSelf || busyId === user.id;

                return (
                  <tr key={user.id}>
                    <td className="bfp-ref">
                      {user.username}
                      {isSelf && <span className="bfp-panel-sub"> · you</span>}
                    </td>
                    <td>{user.full_name || '—'}</td>
                    <td>
                      <select
                        className="bfp-status-select"
                        value={user.user_type}
                        disabled={locked}
                        title={
                          isSelf
                            ? 'You cannot change your own role. Ask another BFP account.'
                            : undefined
                        }
                        onChange={(event) =>
                          update(
                            user,
                            { user_type: event.target.value },
                            `role set to ${ROLE_LABEL[event.target.value]}`,
                          )
                        }
                      >
                        <option value="civilian">Civilian</option>
                        <option value="bfp">BFP Personnel</option>
                      </select>
                    </td>
                    <td>
                      <span
                        className={`bfp-badge ${
                          user.is_active ? 'bfp-badge-resolved' : 'bfp-badge-not-flagged'
                        }`}
                      >
                        {user.is_active ? 'Active' : 'Suspended'}
                      </span>
                    </td>
                    <td>{user.report_count}</td>
                    <td>{fmtDate(user.date_joined)}</td>
                    <td>{fmtDate(user.last_login)}</td>
                    <td>
                      <button
                        type="button"
                        className={
                          user.is_active ? 'bfp-mini-btn bfp-mini-btn-danger' : 'bfp-mini-btn'
                        }
                        disabled={locked}
                        title={
                          isSelf ? 'You cannot suspend your own account.' : undefined
                        }
                        onClick={() =>
                          update(
                            user,
                            { is_active: !user.is_active },
                            user.is_active ? 'suspended' : 'reactivated',
                          )
                        }
                      >
                        {user.is_active ? 'Suspend' : 'Reactivate'}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {users.length === 0 && (
                <tr>
                  <td colSpan={8} className="bfp-table-empty">
                    {loading ? 'Loading…' : 'No accounts match the filter.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <p className="bfp-panel-foot">
          Suspending an account blocks sign-in. Reports already filed are kept:
          nothing here deletes a submission.
        </p>
      </section>
    </BfpShell>
  );
}

export default BfpUsers;
