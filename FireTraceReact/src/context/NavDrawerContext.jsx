import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { NavDrawerContext } from './navDrawerContextObject';

/* Open/closed state for the one civilian menu.

   It lives in a context because the button and the drawer are deliberately in
   different places: the button belongs to whatever header the current screen
   renders, while the drawer is mounted once by NavLayout and outlives every
   page under it. Passing the state down as props would mean every civilian
   page having to thread it through, which is exactly how a screen ends up
   shipping without a way to navigate. */
export function NavDrawerProvider({ children }) {
    const [open, setOpen] = useState(false);
    const { pathname } = useLocation();
    const [lastPath, setLastPath] = useState(pathname);

    const close = useCallback(() => setOpen(false), []);
    const toggle = useCallback(() => setOpen((current) => !current), []);

    /* Following a link inside the drawer navigates *and* dismisses it. Done
       here rather than in each link's handler so that going back, being
       redirected, or any other route change closes it too -- and during render
       rather than in an effect, so the menu is already gone in the same paint
       that shows the new screen instead of flashing over it for a frame. */
    if (lastPath !== pathname) {
        setLastPath(pathname);
        if (open) setOpen(false);
    }

    // Escape is what people reach for before hunting the close button.
    useEffect(() => {
        if (!open) return undefined;
        const onKeyDown = (event) => {
            if (event.key === 'Escape') setOpen(false);
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [open]);

    // The page behind an open drawer must not scroll -- on a phone a drag
    // meant for the menu otherwise scrolls the page underneath it.
    useEffect(() => {
        if (!open) return undefined;
        const previous = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = previous; };
    }, [open]);

    const value = useMemo(() => ({ open, setOpen, close, toggle }), [open, close, toggle]);

    return <NavDrawerContext.Provider value={value}>{children}</NavDrawerContext.Provider>;
}
