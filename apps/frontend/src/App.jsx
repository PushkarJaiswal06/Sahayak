import React, { Suspense } from 'react';
import { Navigate, Outlet, Route, Routes, Link, useNavigate } from 'react-router-dom';
import AgentContextProvider from './contexts/AgentContext';
import VoiceOrb from './components/VoiceOrb';
import ErrorBoundary from './components/ErrorBoundary';
import { LoadingOverlay } from './components/Loading';
import ConnectionBanner from './components/ConnectionStatus';
import useAuthStore from './stores/authStore';

// Lazy load feature pages for code splitting
const Login = React.lazy(() => import('./features/Login'));
const Dashboard = React.lazy(() => import('./features/Dashboard'));
const Transfers = React.lazy(() => import('./features/Transfers'));
const Bills = React.lazy(() => import('./features/Bills'));
const Profile = React.lazy(() => import('./features/Profile'));

function Shell() {
  const { isAuthenticated, logout } = useAuthStore();
  const navigate = useNavigate();

  return (
    <div style={{ display: 'grid', minHeight: '100vh', gridTemplateRows: 'auto 1fr' }}>
      <header style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div style={{ fontWeight: 700 }}>Sahayak</div>
        {isAuthenticated && (
          <nav style={{ display: 'flex', gap: '0.75rem' }}>
            <Link to="/dashboard">Dashboard</Link>
            <Link to="/transfers">Transfers</Link>
            <Link to="/bills">Bills</Link>
            <Link to="/profile">Profile</Link>
          </nav>
        )}
        <div style={{ marginLeft: 'auto' }}>
          {isAuthenticated ? (
            <button
              onClick={() => {
                logout();
                navigate('/login');
              }}
              style={{
                padding: '0.55rem 0.9rem',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: 'white',
                cursor: 'pointer',
              }}
            >
              Logout
            </button>
          ) : (
            <Link to="/login">Login</Link>
          )}
        </div>
      </header>
      <main style={{ padding: '1.5rem', fontFamily: 'system-ui, sans-serif' }}>
        <Outlet />
      </main>
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuthStore();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function App() {
  return (
    <ErrorBoundary>
      <AgentContextProvider>
        <ConnectionBanner />
        <Suspense fallback={<LoadingOverlay message="Loading Sahayak..." />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              element={
                <ProtectedRoute>
                  <Shell />
                </ProtectedRoute>
              }
            >
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/transfers" element={<Transfers />} />
              <Route path="/bills" element={<Bills />} />
              <Route path="/profile" element={<Profile />} />
            </Route>
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Suspense>
        <VoiceOrb />
      </AgentContextProvider>
    </ErrorBoundary>
  );
}

export default App;
