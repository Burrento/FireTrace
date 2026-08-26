import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardMap from '../../components/bfp/DashboardMap';
import ReportsQueue from '../../components/bfp/ReportsQueue';
import BfpShell from './BfpShell';
import { useDashboardPoll, usePolledResource } from './useDashboardData';

/* The archive: every report and incident, at any age, in any status.

   Same map component and same endpoint as the overview, asked for with
   scope=all. Sharing them means the two views can never disagree about what a
   record is or how it is drawn -- only about which records they ask for. */

const REFRESH_MS = 15000;

function BfpReports() {
  const navigate = useNavigate();
  const [accessDenied, setAccessDenied] = useState(false);

  const { tick, lastRefresh, refreshNow, live } = useDashboardPoll(REFRESH_MS);

  const handleAuthError = useCallback(() => {
    setAccessDenied(true);
  }, []);

  useEffect(() => {
    if (accessDenied) navigate('/dashboard');
  }, [accessDenied, navigate]);

  const map = usePolledResource('/api/dashboard/map/?scope=all', tick, {
    onAuthError: handleAuthError,
  });

  return (
    <BfpShell live={live} lastRefresh={lastRefresh} refreshNow={refreshNow}>
      <DashboardMap
        data={map.data}
        loading={map.loading}
        error={map.error}
        title="All Reports Map"
        focusOnNew={false}
      />
      <ReportsQueue
        tick={tick}
        onAuthError={handleAuthError}
        onChanged={refreshNow}
        title="All Reports"
      />
    </BfpShell>
  );
}

export default BfpReports;
