import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardMap from '../../components/bfp/DashboardMap';
import BfpShell from './BfpShell';
import { useDashboardPoll, usePolledResource } from './useDashboardData';

/* Full-page incident map. Same endpoint and map component as the overview /
   archive, so the three views can never disagree about a record. */

const REFRESH_MS = 15000;

function BfpIncidentMap() {
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
        title="Incident Map"
        focusOnNew={false}
      />
    </BfpShell>
  );
}

export default BfpIncidentMap;
