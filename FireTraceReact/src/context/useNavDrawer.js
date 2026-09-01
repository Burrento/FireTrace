import { useContext } from 'react';
import { NavDrawerContext } from './navDrawerContextObject';

/* Deliberately does not throw when there is no provider, unlike useTheme.

   A header rendered outside NavLayout -- the BFP portal reuses a few civilian
   components -- has no drawer to open, and a crash there would be a worse
   answer than a button that does nothing. */
const CLOSED = { open: false, setOpen: () => {}, close: () => {}, toggle: () => {} };

export function useNavDrawer() {
    return useContext(NavDrawerContext) ?? CLOSED;
}
