import { Outlet } from 'react-router-dom';
import SideNav from './SideNav';
import { NavDrawerProvider } from '../context/NavDrawerContext';

/* Wraps every civilian route. The drawer is mounted once here rather than per
   page, so it keeps its state across a navigation and no screen can ship
   without a menu. */
function NavLayout() {
    return (
        <NavDrawerProvider>
            <SideNav />
            <Outlet />
        </NavDrawerProvider>
    );
}

export default NavLayout;
