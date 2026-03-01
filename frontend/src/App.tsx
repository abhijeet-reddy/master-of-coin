import { Routes, Route, Navigate } from 'react-router-dom';
import { ColorModeProvider } from '@/components/ui/color-mode';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Layout } from '@/components/layout/Layout';
import { LoginPage } from '@/pages/auth/LoginPage';
import { RegisterPage } from '@/pages/auth/RegisterPage';
import Dashboard from '@/pages/Dashboard';
import { TransactionsPage } from '@/pages/Transactions';
import { TransactionDetailPage } from '@/pages/TransactionDetail';
import { Accounts } from '@/pages/Accounts';
import { AccountDetailPage } from '@/pages/AccountDetail';
import { Budgets } from '@/pages/Budgets';
import { Categories } from '@/pages/Categories';
import { People } from '@/pages/People';
import Reports from '@/pages/Reports';
import { Settings } from '@/pages/Settings';
import { JobsPage } from '@/pages/Jobs';
import { JobDetailPage } from '@/pages/JobDetail';
import { SchedulesPage } from '@/pages/Schedules';
import { ScheduleDetailPage } from '@/pages/ScheduleDetail';
import { PlaceholderPage } from '@/pages/PlaceholderPage';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';

function App() {
  return (
    <ColorModeProvider>
      <AuthProvider>
        <ErrorBoundary>
          <Toaster />
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            {/* Protected routes */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="transactions" element={<TransactionsPage />} />
              <Route path="transactions/:id" element={<TransactionDetailPage />} />
              <Route path="accounts" element={<Accounts />} />
              <Route path="accounts/:id" element={<AccountDetailPage />} />
              <Route path="budgets" element={<Budgets />} />
              <Route path="categories" element={<Categories />} />
              <Route path="people" element={<People />} />
              <Route path="reports" element={<Reports />} />
              <Route path="jobs" element={<JobsPage />} />
              <Route path="jobs/:type/:id" element={<JobDetailPage />} />
              <Route path="schedules" element={<SchedulesPage />} />
              <Route path="schedules/:id" element={<ScheduleDetailPage />} />
              <Route path="settings" element={<Settings />} />
            </Route>

            {/* 404 Not Found */}
            <Route
              path="*"
              element={
                <PlaceholderPage
                  title="404 - Page Not Found"
                  subtitle="The page you're looking for doesn't exist"
                  phase=""
                />
              }
            />
          </Routes>
        </ErrorBoundary>
      </AuthProvider>
    </ColorModeProvider>
  );
}

export default App;
