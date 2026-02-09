import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import { Layout } from '@/components/layout/Layout';
import { InitialSync } from '@/components/InitialSync';
import { Onboarding } from '@/pages/Onboarding';
import { Login } from '@/pages/Login';
import { Dashboard } from '@/pages/Dashboard';
import { POS } from '@/pages/POS';
import { Products } from '@/pages/Products';
import { ProductForm } from '@/pages/ProductForm';
import { Stock } from '@/pages/Stock';
import { Sales } from '@/pages/Sales';
import { Settings } from '@/pages/Settings';
import { AIChat } from '@/pages/AIChat';
import { Reports } from '@/pages/Reports';
import { Staff } from '@/pages/Staff';
import { StaffDetail } from '@/pages/StaffDetail';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, shop } = useAuthStore();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!shop) {
    return <Navigate to="/onboarding" replace />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  const { loadUser, shop, isAuthenticated } = useAuthStore();

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  return (
    <Routes>
      {/* Onboarding - entry point for new users */}
      <Route
        path="/onboarding"
        element={
          isAuthenticated && shop ? <Navigate to="/" replace /> : <Onboarding />
        }
      />
      
      {/* Login - for returning users */}
      <Route
        path="/login"
        element={
          isAuthenticated && shop ? <Navigate to="/" replace /> : <Login />
        }
      />
      
      {/* Protected routes */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <InitialSync>
              <Layout />
            </InitialSync>
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="pos" element={<POS />} />
        <Route path="products" element={<Products />} />
        <Route path="products/new" element={<ProductForm />} />
        <Route path="products/:id" element={<ProductForm />} />
        <Route path="stock" element={<Stock />} />
        <Route path="sales" element={<Sales />} />
        <Route path="reports" element={<Reports />} />
        <Route path="staff" element={<Staff />} />
        <Route path="staff/:id" element={<StaffDetail />} />
        <Route path="assistant" element={<AIChat />} />
        <Route path="settings" element={<Settings />} />
      </Route>

      {/* Catch all - redirect to onboarding */}
      <Route path="*" element={<Navigate to="/onboarding" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
