import { Outlet } from 'react-router-dom';
import SideNav from './SideNav';

function NavLayout() {
    return (
        <>
            <SideNav />
            <Outlet />
        </>
    );
}

export default NavLayout;
