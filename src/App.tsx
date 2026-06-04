import { useEffect, useRef, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import { useInventoryStore } from '@/stores/inventoryStore';
import { useCartStore } from '@/stores/cartStore';
import { Layout } from '@/components/layout/Layout';
import { InitialSync } from '@/components/InitialSync';
import './index.css';

// Lazy load all pages
const Onboarding = lazy(() => import('@/pages/Onboarding').then(m => ({ default: m.Onboarding })));
const Login = lazy(() => import('@/pages/Login').then(m => ({ default: m.Login })));
const AuthCallback = lazy(() => import('@/pages/AuthCallback').then(m => ({ default: m.AuthCallback })));
const Dashboard = lazy(() => import('@/pages/Dashboard').then(m => ({ default: m.Dashboard })));
const POS = lazy(() => import('@/pages/POS').then(m => ({ default: m.POS })));
const Products = lazy(() => import('@/pages/Products').then(m => ({ default: m.Products })));
const ProductForm = lazy(() => import('@/pages/ProductForm').then(m => ({ default: m.ProductForm })));
const Stock = lazy(() => import('@/pages/Stock').then(m => ({ default: m.Stock })));
const Sales = lazy(() => import('@/pages/Sales').then(m => ({ default: m.Sales })));
const Settings = lazy(() => import('@/pages/Settings').then(m => ({ default: m.Settings })));
const AIChat = lazy(() => import('@/pages/AIChat').then(m => ({ default: m.AIChat })));
const Reports = lazy(() => import('@/pages/Reports').then(m => ({ default: m.Reports })));
const Staff = lazy(() => import('@/pages/Staff').then(m => ({ default: m.Staff })));
const StaffDetail = lazy(() => import('@/pages/StaffDetail').then(m => ({ default: m.StaffDetail })));
const Returns = lazy(() => import('@/pages/Returns').then(m => ({ default: m.Returns })));
const Suppliers = lazy(() => import('@/pages/Suppliers').then(m => ({ default: m.Suppliers })));
const Customers = lazy(() => import('@/pages/Customers').then(m => ({ default: m.Customers })));
const MobilePOS = lazy(() => import('@/pages/MobilePOS').then(m => ({ default: m.MobilePOS })));

// Create queryClient outside component to avoid re-creation
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

// Export for clearing on logout
export { queryClient };

// Loading spinner for lazy-loaded pages
function PageLoader() {
  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <div className="w-10 h-10 border-3 border-amber-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

// Full-screen loader for initial app load
function AppLoader() {
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-slate-400">Loading...</p>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, shop } = useAuthStore();

  if (isLoading) {
    return <AppLoader />;
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
  const clearInventory = useInventoryStore(state => state.clearAll);
  const clearCart = useCartStore(state => state.clear);
  const wasAuthenticated = useRef(isAuthenticated);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  // Clear all stores when user logs out
  useEffect(() => {
    if (wasAuthenticated.current && !isAuthenticated) {
      // User just logged out - clear all cached data
      clearInventory();
      clearCart();
      queryClient.clear(); // Clear React Query cache too
      console.log('[App] Cleared all stores and cache on logout');
    }
    wasAuthenticated.current = isAuthenticated;
  }, [isAuthenticated, clearInventory, clearCart]);

  return (
    <Suspense fallback={<AppLoader />}>
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

        {/* YeboID OAuth callback */}
        <Route path="/auth/callback" element={<AuthCallback />} />

        {/* Mobile POS - Full screen without layout */}
        <Route
          path="/pos/mobile"
          element={
            <ProtectedRoute>
              <InitialSync>
                <Suspense fallback={<AppLoader />}><MobilePOS /></Suspense>
              </InitialSync>
            </ProtectedRoute>
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
          <Route index element={<Suspense fallback={<PageLoader />}><Dashboard /></Suspense>} />
          <Route path="pos" element={<Suspense fallback={<PageLoader />}><POS /></Suspense>} />
          <Route path="products" element={<Suspense fallback={<PageLoader />}><Products /></Suspense>} />
          <Route path="products/new" element={<Suspense fallback={<PageLoader />}><ProductForm /></Suspense>} />
          <Route path="products/:id" element={<Suspense fallback={<PageLoader />}><ProductForm /></Suspense>} />
          <Route path="stock" element={<Suspense fallback={<PageLoader />}><Stock /></Suspense>} />
          <Route path="sales" element={<Suspense fallback={<PageLoader />}><Sales /></Suspense>} />
          <Route path="reports" element={<Suspense fallback={<PageLoader />}><Reports /></Suspense>} />
          <Route path="staff" element={<Suspense fallback={<PageLoader />}><Staff /></Suspense>} />
          <Route path="staff/:id" element={<Suspense fallback={<PageLoader />}><StaffDetail /></Suspense>} />
          <Route path="returns" element={<Suspense fallback={<PageLoader />}><Returns /></Suspense>} />
          <Route path="suppliers" element={<Suspense fallback={<PageLoader />}><Suppliers /></Suspense>} />
          <Route path="customers" element={<Suspense fallback={<PageLoader />}><Customers /></Suspense>} />
          <Route path="assistant" element={<Suspense fallback={<PageLoader />}><AIChat /></Suspense>} />
          <Route path="settings" element={<Suspense fallback={<PageLoader />}><Settings /></Suspense>} />
        </Route>

        {/* Catch all - redirect to onboarding */}
        <Route path="*" element={<Navigate to="/onboarding" replace />} />
      </Routes>
    </Suspense>
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
