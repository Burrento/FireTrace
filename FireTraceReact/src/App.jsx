import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Welcome from './pages/Welcome';
import CreateAccount from './pages/CreateAccount';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Forgotpass1 from './pages/Forgotpass1';
import Forgotpass2 from './pages/Forgotpass2';
import Report from './pages/Report';
import Continue2 from './pages/Continue2';
import ContinueThird from './pages/ContinueThird';
import Continue4 from './pages/Continue4';
import MyReport from './pages/MyReport';
import ReportDetail from './pages/ReportDetail';
import { ReportDraftProvider } from './context/ReportDraftContext';

function App() {
  return (
    <ReportDraftProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Welcome />} />
          <Route path="/create" element={<CreateAccount />} />
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/forgotpass1" element={<Forgotpass1 />} />
          <Route path="/forgotpass2" element={<Forgotpass2 />} />
          <Route path="/report" element={<Report />} />
          <Route path="/continue2" element={<Continue2 />} />
          <Route path="/continuethird" element={<ContinueThird />} />
          <Route path="/continue4" element={<Continue4 />} />
          <Route path="/myreport" element={<MyReport />} />
          <Route path="/report/:id" element={<ReportDetail />} />
        </Routes>
      </BrowserRouter>
    </ReportDraftProvider>
  );
}

export default App;
