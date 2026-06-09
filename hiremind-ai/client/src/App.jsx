import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";

import Login from "./pages/Auth/Login.jsx";
import Register from "./pages/Auth/Register.jsx";
import Layout from "./components/Layout.jsx";
import RoleSelect from "./pages/RoleSelect.jsx";
import UploadResume from "./pages/UploadResume.jsx";
import ATSResult from "./pages/ATSResult.jsx";
import Interview from "./pages/Interview/Interview.jsx";
import InterviewComplete from "./pages/Interview/InterviewComplete.jsx";
import BehaviorAssessment from "./pages/BehaviorAssessment/BehaviorAssessment.jsx";
import Dashboard from "./pages/Dashboard/Dashboard.jsx";
import HRDashboard from "./pages/HR/HRDashboard.jsx";
import HRAnalytics from "./pages/HR/HRAnalytics.jsx";
import AdminPanel from "./pages/Admin/AdminPanel.jsx";
import Landing from "./pages/Landing.jsx";

function Private({ children, roles }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return children;
}

function Inner() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login"    element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route element={<Private><Layout /></Private>}>
        <Route path="/dashboard"     element={<Dashboard />} />
        <Route path="/role-select"   element={<RoleSelect />} />
        <Route path="/upload-resume" element={<UploadResume />} />
        <Route path="/ats-result"    element={<ATSResult />} />
        <Route path="/interview"     element={<Interview />} />
        <Route path="/behavior-assessment" element={<BehaviorAssessment />} />
        <Route path="/interview/complete" element={<InterviewComplete />} />

        <Route path="/hr"            element={<Private roles={["hr","admin"]}><HRDashboard /></Private>} />
        <Route path="/hr/analytics"  element={<Private roles={["hr","admin"]}><HRAnalytics /></Private>} />
        <Route path="/admin"         element={<Private roles={["admin"]}><AdminPanel /></Private>} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return <AuthProvider><Inner /></AuthProvider>;
}
