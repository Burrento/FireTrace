import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import ActivityFeed from '../../components/bfp/ActivityFeed';
import DashboardMap from '../../components/bfp/DashboardMap';
import KpiCards from '../../components/bfp/KpiCards';
import SystemHealth from '../../components/bfp/SystemHealth';
import BfpShell from './BfpShell';
import { useDashboardPoll, usePolledResource } from './useDashboardData';

/* The operations overview: what is happening now.

   The map here is deliberately the *recent* scope only. A wall of months-old
   pins buries the fire that started ten minutes ago, which is the one an
   operator opened this screen to find. The full history lives on
   /bfp/reports. */

const REFRESH_MS = 15000;

function BfpDashboard() {
  const navigate = useNavigate();
  const [accessDenied, setAccessDenied] = useState(false);

  const { tick, lastRefresh, refreshNow, live } = useDashboardPoll(REFRESH_MS);

  // Which slice of time the live map draws. The server clamps this to the
  // windows it offers, so a hand-edited value cannot widen the query.
  const [mapHours, setMapHours] = useState(1);

  const handleAuthError = useCallback(() => {
    setAccessDenied(true);
  }, []);

  useEffect(() => {
    if (accessDenied) navigate('/dashboard');
  }, [accessDenied, navigate]);

  const kpis = usePolledResource('/api/dashboard/kpis/', tick, { onAuthError: handleAuthError });
  const map = usePolledResource(`/api/dashboard/map/?hours=${mapHours}`, tick, { onAuthError: handleAuthError });
  const activity = usePolledResource('/api/dashboard/activity/?limit=25', tick, { onAuthError: handleAuthError });
  const health = usePolledResource('/api/dashboard/health/', tick, { onAuthError: handleAuthError });

  return (
    <BfpShell live={live} lastRefresh={lastRefresh} refreshNow={refreshNow}>
      <KpiCards data={kpis.data} loading={kpis.loading} />
      {kpis.error && <p className="bfp-inline-error">{kpis.error}</p>}

      <div className="bfp-grid">
        <div className="bfp-col-main">
          <DashboardMap
            data={map.data}
            loading={map.loading}
            error={map.error}
            hours={mapHours}
            onHoursChange={setMapHours}
          />
        </div>

        <aside className="bfp-col-side">
          <SystemHealth data={health.data} loading={health.loading} error={health.error} />
          <ActivityFeed data={activity.data} loading={activity.loading} error={activity.error} />
        </aside>
      </div>
    </BfpShell>
  );
}

export default BfpDashboard;
