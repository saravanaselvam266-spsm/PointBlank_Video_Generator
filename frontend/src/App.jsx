import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AppProvider } from './context/AppContext';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { PublicRoute } from './routes/PublicRoute';
import { AppShell } from './components/layout/AppShell';

import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Doctors } from './pages/Doctors';
import { DoctorProfile } from './pages/DoctorProfile';
import { AILibrary } from './pages/AILibrary';
import { CreateAvatar } from './pages/CreateAvatar';
import { CreateVideo } from './pages/CreateVideo';
import { Videos } from './pages/Videos';
import { VideoDetails } from './pages/VideoDetails';
import { ProfileSettings } from './pages/ProfileSettings';
import { PublicWatchPage } from './components/public/PublicWatchPage';

export default function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <BrowserRouter>
          <Routes>
            {/* Public Login Route */}
            <Route
              path="/login"
              element={
                <PublicRoute>
                  <Login />
                </PublicRoute>
              }
            />

            {/* Unauthenticated Public Watch Page */}
            <Route
              path="/watch/:token"
              element={<PublicWatchPage />}
            />

            {/* Protected Application Shell Routes */}
            <Route
              path="/app"
              element={
                <ProtectedRoute>
                  <AppShell />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/app/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="doctors" element={<Doctors />} />
              <Route path="doctors/:id" element={<DoctorProfile />} />
              <Route path="ai-library" element={<AILibrary />} />
              {/* Legacy Avatar/Voice Library links now redirect into AI Library — doctor-specific
                  avatars/voices moved to Doctor Profile, avoiding two pages managing the same assets. */}
              <Route path="avatars" element={<Navigate to="/app/ai-library" replace />} />
              <Route path="voices" element={<Navigate to="/app/ai-library" replace />} />
              <Route path="create-avatar" element={<CreateAvatar />} />
              <Route path="create-video" element={<CreateVideo />} />
              <Route path="videos" element={<Videos />} />
              <Route path="videos/:id" element={<VideoDetails />} />
              <Route path="settings/profile" element={<ProfileSettings />} />
            </Route>


            {/* Default Redirects */}
            <Route path="/" element={<Navigate to="/app/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/app/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </AppProvider>
    </AuthProvider>
  );
}
