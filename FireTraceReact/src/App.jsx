import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Welcome from './pages/auth/Welcome';
import CreateAccount from './pages/auth/CreateAccount';
import Login from './pages/auth/Login';
import Dashboard from './pages/Dashboard';
import BfpDashboard from './pages/bfp/BfpDashboard';
import BfpReports from './pages/bfp/BfpReports';
import ForgotPasswordRequest from './pages/auth/ForgotPasswordRequest';
import ForgotPasswordReset from './pages/auth/ForgotPasswordReset';
import IncidentDetailsStep from './pages/report-wizard/IncidentDetailsStep';
import LocationStep from './pages/report-wizard/LocationStep';
import PhotoStep from './pages/report-wizard/PhotoStep';
import ConfirmationStep from './pages/report-wizard/ConfirmationStep';
import MyReports from './pages/reports/MyReports';
import Notifications from './pages/Notifications';
import Profile from './pages/profiletab/Profile';
import Personal from './pages/profiletab/Personal';
import ChangePass from './pages/profiletab/ChangePass';
import ContactInfo from './pages/profiletab/ContactInfo';
import PrivacyNotice from './pages/profiletab/PrivacyNotice';
import ConsentDataUse from './pages/profiletab/ConsentDataUse';
import HelpReport from './pages/profiletab/HelpReport';
import OfficialBFP from './pages/profiletab/OfficialBFP';
import ReportDetail from './pages/reports/ReportDetail';
import { ReportDraftProvider } from './context/ReportDraftContext';
import NavLayout from './components/NavLayout';
import { ThemeProvider } from './context/ThemeContext';

function App() {
  return (
    <ThemeProvider>
    <ReportDraftProvider>
      <BrowserRouter>
        <Routes>
          {/* Login is the landing page. /login stays routed because several
              pages redirect there when a session expires. */}
          <Route path="/" element={<Login />} />
          <Route path="/login" element={<Login />} />
          <Route path="/welcome" element={<Welcome />} />
          <Route path="/create" element={<CreateAccount />} />
          <Route path="/forgotpass1" element={<ForgotPasswordRequest />} />
          <Route path="/forgotpass2" element={<ForgotPasswordReset />} />
          <Route element={<NavLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            {/* BFP Administrative Portal. Both this route and its API check the
                user's role, so a civilian reaching it gets nothing. */}
            <Route path="/bfp" element={<BfpDashboard />} />
            <Route path="/bfp/reports" element={<BfpReports />} />
            <Route path="/report" element={<IncidentDetailsStep />} />
            <Route path="/continue2" element={<LocationStep />} />
            <Route path="/continuethird" element={<PhotoStep />} />
            <Route path="/continue4" element={<ConfirmationStep />} />
            <Route path="/myreport" element={<MyReports />} />
            <Route path="/report/:id" element={<ReportDetail />} />
            <Route path="/Notifications" element={<Notifications />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/personal" element={<Personal />} />
            <Route path="/ChangePass" element={<ChangePass />} />
            <Route path="/ContactInfo" element={<ContactInfo />} />
            <Route path="/PrivacyNotice" element={<PrivacyNotice />} />
            <Route path="/ConsentDataUse" element={<ConsentDataUse />} />
            <Route path="/HelpReport" element={<HelpReport />} />
            <Route path="/OfficialBFP" element={<OfficialBFP />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ReportDraftProvider>
    </ThemeProvider>
  );
}

export default App;
