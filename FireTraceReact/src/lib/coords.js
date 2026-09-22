/* The coordinate columns are DecimalField(max_digits=9, decimal_places=6) and
   a raw Google Maps coordinate carries a dozen decimals, so anything headed
   for the API is rounded first. Getting this wrong is not a rounding error: it
   is a "no more than 9 digits in total" validation failure naming neither
   latitude nor longitude, and no map-pinned report can be filed at all.

   Six decimal places is ~0.1 m at this latitude: far finer than any fix the
   phone or the map pin can actually justify.

   Here rather than in a component file so the reporter's draft and the
   station's intake form round identically. */

const COORD_DECIMALS = 6;

export function roundCoord(value) {
  // Guarded before Number(), which turns '' and null into 0 -- a real
  // coordinate off the coast of Africa.
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(COORD_DECIMALS)) : null;
}
