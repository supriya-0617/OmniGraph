import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { FilterProvider } from './context/FilterContext';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { LandingPage } from './pages/LandingPage';
import { LoadingSpinner } from './components/common/LoadingSpinner';

// The dashboard pulls in Cytoscape + Recharts; load it only when needed.
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((module) => ({ default: module.DashboardPage })));

const FullScreenLoader: React.FC<{ message: string }> = ({ message }) => (
  <main className="min-h-screen flex items-center justify-center">
    <LoadingSpinner message={message} />
  </main>
);

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <FullScreenLoader message="Restoring analyst session…" />;
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
};

const GuestRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <FullScreenLoader message="Restoring analyst session…" />;
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <>{children}</>;
};

export const AppContent: React.FC = () => (
  <Routes>
    <Route path="/" element={<LandingPage />} />
    <Route path="/login" element={<GuestRoute><LoginPage /></GuestRoute>} />
    <Route path="/register" element={<GuestRoute><RegisterPage /></GuestRoute>} />
    <Route
      path="/dashboard"
      element={
        <ProtectedRoute>
          <FilterProvider>
            <Suspense fallback={<FullScreenLoader message="Opening workspace…" />}>
              <DashboardPage />
            </Suspense>
          </FilterProvider>
        </ProtectedRoute>
      }
    />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);

export const App: React.FC = () => (
  <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  </BrowserRouter>
);

export default App;
