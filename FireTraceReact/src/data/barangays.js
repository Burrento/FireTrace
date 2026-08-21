/* Barangays of Calapan City. Kept in one place so the <select> options and the
   reverse-geocoding matcher can never drift apart. */
export const CALAPAN_BARANGAYS = [
    'Balingayan',
    'Balite',
    'Baruyan',
    'Batino',
    'Bayanan I',
    'Bayanan II',
    'Biga',
    'Bondoc',
    'Bucayao',
    'Buhuan',
    'Bulusan',
    'Calero',
    'Camansihan',
    'Camilmil',
    'Canubing I',
    'Canubing II',
    'Comunal',
    'Guinobatan',
    'Gulod',
    'Gutad',
    'Ibaba East',
    'Ibaba West',
    'Ilaya',
    'Lalud',
    'Lazareto',
    'Libis',
    'LumangBayan',
    'Mahal Na Pangalan',
    'Maidlang',
    'Malad',
    'Malamig',
    'Managpi',
    'Masipit',
    'Nag-Iba I',
    'Nag-Iba II',
    'Navotas',
    'Pachoca',
    'Palhi',
    'Panggalan',
    'Parang',
    'Patas',
    'Personas',
    'Puting Tubig',
    'Salong',
    'San Antonio',
    'San Vicente Central',
    'San Vicente East',
    'San Vicente North',
    'San Vicente South',
    'South Vicente West',
    'Sta. Cruz',
    'Sto. Niño',
    'Sapul',
    'Silonay',
    'Sta. Maria Village',
    'Sta. Rita',
    'Suqui',
    'Tawagan',
    'Tawiran',
    'Tibag',
    'Wawa',
];

/* Google returns names like "Barangay Santo Niño" where the list says
   "Sto. Niño", so both sides are reduced to a comparable form first:
   accents dropped, prefixes removed, Sto./Sta. spelled out, punctuation
   flattened to single spaces. */
function normalize(value) {
    return String(value)
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/^(barangay|brgy\.?|bgy\.?|bo\.?)\s+/, '')
        .replace(/\bsto\.?\b/g, 'santo')
        .replace(/\bsta\.?\b/g, 'santa')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

const LOOKUP = CALAPAN_BARANGAYS.reduce((acc, name) => {
    const key = normalize(name);
    acc.spaced[key] = name;
    // "LumangBayan" in the list vs "Lumang Bayan" from Google — comparing with
    // spaces stripped catches those.
    acc.tight[key.replace(/\s/g, '')] = name;
    return acc;
}, { spaced: {}, tight: {} });

/**
 * Finds the first candidate string that corresponds to a Calapan barangay.
 * Returns the canonical name from CALAPAN_BARANGAYS, or null.
 */
export function matchBarangay(candidates) {
    for (const candidate of candidates) {
        if (!candidate) continue;
        const key = normalize(candidate);
        if (!key) continue;
        const hit = LOOKUP.spaced[key] || LOOKUP.tight[key.replace(/\s/g, '')];
        if (hit) return hit;
    }
    return null;
}
