import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ReportsQueue from '../../components/bfp/ReportsQueue';
import BfpShell from './BfpShell';
import { useDashboardPoll } from './useDashboardData';

const REFRESH_MS = 15000;

function BfpAnalyticReport() {
  const navigate = useNavigate();
  const [accessDenied, setAccessDenied] = useState(false);

  const { tick, lastRefresh, refreshNow, live } = useDashboardPoll(REFRESH_MS);

  const handleAuthError = useCallback(() => {
    setAccessDenied(true);
  }, []);

  useEffect(() => {
    if (accessDenied) navigate('/dashboard');
  }, [accessDenied, navigate]);

  return (
    <BfpShell live={live} lastRefresh={lastRefresh} refreshNow={refreshNow}>
      <ReportsQueue
        tick={tick}
        onAuthError={handleAuthError}
        onChanged={refreshNow}
        title="All Reports"
      />
    </BfpShell>
  );
}

export default BfpAnalyticReport;
