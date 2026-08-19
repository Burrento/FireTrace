import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Welcome from './pages/Welcome';
import CreateAccount from './pages/CreateAccount';
import Login from './pages/Login';
import Forgotpass1 from './pages/forgotpass1';
import Forgotpass2 from './pages/forgotpass2';
import Dashboard from './pages/dashboard';
import Report from './pages/report';
import Continue2 from './pages/continue2';
import ContinueThird from './pages/continuethird';
import Continue4 from './pages/continue4';
import MyReport from './pages/myreport';
import NavLayout from './components/NavLayout';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Welcome />} />
        <Route path="/create" element={<CreateAccount />} />
        <Route path="/login" element={<Login />} />
        <Route path="/forgotpass1" element={<Forgotpass1 />} />
        <Route path="/forgotpass2" element={<Forgotpass2 />} />
        <Route element={<NavLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/report" element={<Report />} />
          <Route path="/continue2" element={<Continue2 />} />
          <Route path="/continuethird" element={<ContinueThird />} />
          <Route path="/continue4" element={<Continue4 />} />
          <Route path="/myreport" element={<MyReport />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
