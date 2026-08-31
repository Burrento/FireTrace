import BfpShell from './BfpShell';

const DEMO_USERS = [
  {
    id: 1,
    name: 'Ricardo Bautista',
    username: 'rbautista@bfp.gov.ph',
    role: 'bfp',
    status: 'active',
    joined: '2025-11-04',
  },
  {
    id: 2,
    name: 'Maria Santos',
    username: 'msantos@bfp.gov.ph',
    role: 'bfp',
    status: 'active',
    joined: '2026-01-18',
  },
  {
    id: 3,
    name: 'Juan Dela Cruz',
    username: 'juandc@gmail.com',
    role: 'civilian',
    status: 'active',
    joined: '2026-02-02',
  },
  {
    id: 4,
    name: 'Ana Reyes',
    username: 'ana.reyes@yahoo.com',
    role: 'civilian',
    status: 'suspended',
    joined: '2026-03-27',
  },
  {
    id: 5,
    name: 'Paolo Mendoza',
    username: 'pmendoza@bfp.gov.ph',
    role: 'bfp',
    status: 'active',
    joined: '2026-05-12',
  },
];

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function BfpUsers() {
  return (
    <BfpShell>
      <h1 className="bfp-page-title">Users</h1>

      <section className="bfp-panel">
        <div className="bfp-panel-head">
          <h2 className="bfp-panel-title">All users</h2>
          <span className="bfp-panel-sub">{DEMO_USERS.length} users · demo data</span>
        </div>

        <div className="bfp-table-wrap">
          <table className="bfp-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Username / email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {DEMO_USERS.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.username}</td>
                  <td>
                    <span className={`bfp-badge ${u.role === 'bfp' ? 'bfp-badge-verified' : 'bfp-badge-not-flagged'}`}>
                      {u.role === 'bfp' ? 'BFP Personnel' : 'Civilian'}
                    </span>
                  </td>
                  <td>
                    <span className={`bfp-badge ${u.status === 'active' ? 'bfp-badge-resolved' : 'bfp-badge-confirmed-duplicate'}`}>
                      {u.status === 'active' ? 'Active' : 'Suspended'}
                    </span>
                  </td>
                  <td>{formatDate(u.joined)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </BfpShell>
  );
}

export default BfpUsers;
