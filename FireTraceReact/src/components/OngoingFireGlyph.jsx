import { useState } from 'react';

/* The marker artwork for a fire that is still burning.

   The PNG is served from `public/` and referenced by URL rather than imported.
   An import of a missing file is a build error, which would mean the whole app
   stops working until the artwork is dropped in; a missing URL is one broken
   image, which this component catches and answers with the drawn pin the map
   used before. Replace `public/ongoing-fire.png` and it appears everywhere. */
const ONGOING_FIRE_ICON = '/ongoing-fire.png';

function OngoingFireGlyph({ size = 40, alt = 'Ongoing fire', fallback = null }) {
  const [failed, setFailed] = useState(false);

  if (failed) return fallback;

  return (
    <img
      className="fire-glyph"
      src={ONGOING_FIRE_ICON}
      alt={alt}
      width={size}
      height={size}
      draggable={false}
      onError={() => setFailed(true)}
    />
  );
}

export default OngoingFireGlyph;
