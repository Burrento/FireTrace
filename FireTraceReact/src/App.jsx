import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Welcome from './pages/auth/Welcome';
import CreateAccount from './pages/auth/CreateAccount';
import Login from './pages/auth/Login';
import Dashboard from './pages/Dashboard';
import ForgotPasswordRequest from './pages/auth/ForgotPasswordRequest';
import ForgotPasswordReset from './pages/auth/ForgotPasswordReset';
import IncidentDetailsStep from './pages/report-wizard/IncidentDetailsStep';
import LocationStep from './pages/report-wizard/LocationStep';
import PhotoStep from './pages/report-wizard/PhotoStep';
import ConfirmationStep from './pages/report-wizard/ConfirmationStep';
import MyReports from './pages/reports/MyReports';
import ReportDetail from './pages/reports/ReportDetail';
import { ReportDraftProvider } from './context/ReportDraftContext';
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
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/forgotpass1" element={<ForgotPasswordRequest />} />
          <Route path="/forgotpass2" element={<ForgotPasswordReset />} />
          <Route path="/report" element={<IncidentDetailsStep />} />
          <Route path="/continue2" element={<LocationStep />} />
          <Route path="/continuethird" element={<PhotoStep />} />
          <Route path="/continue4" element={<ConfirmationStep />} />
          <Route path="/myreport" element={<MyReports />} />
          <Route path="/report/:id" element={<ReportDetail />} />
        </Routes>
      </BrowserRouter>
    </ReportDraftProvider>
    </ThemeProvider>
  );
}

export default App;
