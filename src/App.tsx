import { lazy, Suspense } from 'react';
import type { ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { SimulationProvider } from './context/SimulationContext';
import { ToastProvider } from './components/common/Toaster';
import { AppLayout } from './components/layout/AppLayout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Simulation from './pages/Simulation';

// Heavier, less frequently opened pages are code-split.
const Algorithms = lazy(() => import('./pages/Algorithms'));
const Performance = lazy(() => import('./pages/Performance'));
const Scenarios = lazy(() => import('./pages/Scenarios'));
const EventHistory = lazy(() => import('./pages/EventHistory'));
const Theory = lazy(() => import('./pages/Theory'));
const Viva = lazy(() => import('./pages/Viva'));
const About = lazy(() => import('./pages/About'));

function RequireAuth({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

function GuestOnly({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  return user ? <Navigate to="/" replace /> : <>{children}</>;
}

function PageLoader() {
  return (
    <div className="flex h-64 items-center justify-center gap-3 text-sm text-ink-400" role="status">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-hull-600 border-t-signal-cyan" />
      Loading…
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
      <Route path="/register" element={<GuestOnly><Register /></GuestOnly>} />
      <Route
        element={
          <RequireAuth>
            <SimulationProvider>
              <ToastProvider>
                <Suspense fallback={<PageLoader />}>
                  <AppLayout />
                </Suspense>
              </ToastProvider>
            </SimulationProvider>
          </RequireAuth>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="simulation" element={<Simulation />} />
        <Route path="algorithms" element={<Suspense fallback={<PageLoader />}><Algorithms /></Suspense>} />
        <Route path="performance" element={<Suspense fallback={<PageLoader />}><Performance /></Suspense>} />
        <Route path="scenarios" element={<Suspense fallback={<PageLoader />}><Scenarios /></Suspense>} />
        <Route path="events" element={<Suspense fallback={<PageLoader />}><EventHistory /></Suspense>} />
        <Route path="theory" element={<Suspense fallback={<PageLoader />}><Theory /></Suspense>} />
        <Route path="viva" element={<Suspense fallback={<PageLoader />}><Viva /></Suspense>} />
        <Route path="about" element={<Suspense fallback={<PageLoader />}><About /></Suspense>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
