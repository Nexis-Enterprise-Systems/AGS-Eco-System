import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Login } from "./pages/Login";
import { Signup } from "./pages/Signup";
import { MfaSetup } from "./pages/MfaSetup";
import { MfaChallenge } from "./pages/MfaChallenge";
import { Account } from "./pages/Account";
import { Profile } from "./pages/Profile";
import { Team } from "./pages/Team";
import { Dashboard } from "./pages/Dashboard";
import { MyWorkspace } from "./pages/MyWorkspace";
import { Roadmap } from "./pages/Roadmap";
import { People } from "./pages/People";
import { PersonDetail } from "./pages/PersonDetail";
import { Suppliers } from "./pages/Suppliers";
import { Clients } from "./pages/Clients";
import { ClientDetail } from "./pages/ClientDetail";
import { Projects } from "./pages/Projects";
import { ProjectDetail } from "./pages/ProjectDetail";
import { SettingsHome } from "./pages/SystemSettings";
import { CompanyProfile } from "./pages/settings/CompanyProfile";
import { CompanyBranding } from "./pages/settings/CompanyBranding";
import { Integrations } from "./pages/settings/Integrations";
import { Onboard } from "./pages/Onboard";
import { PeopleHrSettings } from "./pages/settings/PeopleHrSettings";
import { BusinessUnits } from "./pages/settings/BusinessUnits";
import { BusinessUnitDetail } from "./pages/settings/BusinessUnitDetail";
import { UserManagement } from "./pages/settings/UserManagement";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/mfa-setup" element={<MfaSetup />} />
      <Route path="/mfa-challenge" element={<MfaChallenge />} />
      <Route path="/onboard/:token" element={<Onboard />} />

      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/workspace" element={<MyWorkspace />} />
        <Route
          path="/people"
          element={
            <ProtectedRoute allow={["admin"]}>
              <People />
            </ProtectedRoute>
          }
        />
        <Route
          path="/people/:id"
          element={
            <ProtectedRoute allow={["admin"]}>
              <PersonDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/suppliers"
          element={
            <ProtectedRoute allow={["admin"]}>
              <Suppliers />
            </ProtectedRoute>
          }
        />
        <Route
          path="/roadmap"
          element={
            <ProtectedRoute allow={["admin"]}>
              <Roadmap />
            </ProtectedRoute>
          }
        />
        <Route path="/account" element={<Account />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/team" element={<Team />} />

        <Route
          path="/clients"
          element={
            <ProtectedRoute allow={["admin", "staff"]}>
              <Clients />
            </ProtectedRoute>
          }
        />
        <Route
          path="/clients/:id"
          element={
            <ProtectedRoute allow={["admin", "staff"]}>
              <ClientDetail />
            </ProtectedRoute>
          }
        />

        <Route path="/projects" element={<Projects />} />
        <Route path="/projects/:id" element={<ProjectDetail />} />

        {/* Sub-contractors now live in People -> Sub-contractors. */}
        <Route path="/subcontractors" element={<Navigate to="/people" replace />} />

        {/* Invited Users now lives under System Settings -> User
            Management (its "Invites" tab) — this old route stays as a
            redirect so any existing bookmark still works, same
            pattern as /settings/profile and /settings/branding
            below. */}
        <Route path="/invited-users" element={<Navigate to="/settings/user-management" replace />} />

        <Route
          path="/settings"
          element={
            <ProtectedRoute allow={["admin"]}>
              <SettingsHome />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/profile"
          element={
            <ProtectedRoute allow={["admin"]}>
              <CompanyProfile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/branding"
          element={
            <ProtectedRoute allow={["admin"]}>
              <CompanyBranding />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/business-units"
          element={
            <ProtectedRoute allow={["admin"]}>
              <BusinessUnits />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/business-units/:id"
          element={
            <ProtectedRoute allow={["admin"]}>
              <BusinessUnitDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/user-management"
          element={
            <ProtectedRoute allow={["admin"]}>
              <UserManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/people-hr"
          element={
            <ProtectedRoute allow={["admin"]}>
              <PeopleHrSettings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/integrations"
          element={
            <ProtectedRoute allow={["admin"]}>
              <Integrations />
            </ProtectedRoute>
          }
        />
      </Route>
    </Routes>
  );
}
