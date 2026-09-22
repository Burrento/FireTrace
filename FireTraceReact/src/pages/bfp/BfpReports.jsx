import DashboardMap from '../../components/bfp/DashboardMap';
import ReportsQueue from '../../components/bfp/ReportsQueue';
import BfpShell from './BfpShell';
import { useBfpPage, usePolledResource } from './useDashboardData';

/* The archive: every report and incident, at any age, in any status.

   Same map component and same endpoint as the overview, asked for with
   scope=all. Sharing them means the two views can never disagree about what a
   record is or how it is drawn -- only about which records they ask for.

   `map` and `queue` are what the Incident Map and the Analytics Reports routes
   are: this page with one half turned off. They were three files that differed
   by a prop's worth of markup, which is three places to fix a change to the
   archive and two of them easy to miss. */

const REFRESH_MS = 15000;

function BfpReports({ map = true, queue = true, title = 'All Reports', mapTitle }) {
  const { tick, lastRefresh, refreshNow, live, onAuthError } = useBfpPage(REFRESH_MS);

  // Only fetched for the views that draw it.
  const mapData = usePolledResource(
    map ? '/api/dashboard/map/?scope=all' : null,
    tick,
    { onAuthError },
  );

  return (
    <BfpShell live={live} lastRefresh={lastRefresh} refreshNow={refreshNow}>
      {map && (
        <DashboardMap
          data={mapData.data}
          loading={mapData.loading}
          error={mapData.error}
          onChanged={refreshNow}
          title={mapTitle ?? `${title} Map`}
          focusOnNew={false}
        />
      )}
      {queue && (
        <ReportsQueue
          tick={tick}
          onAuthError={onAuthError}
          onChanged={refreshNow}
          title={title}
        />
      )}
    </BfpShell>
  );
}

export default BfpReports;
