import { Routes, Route, Navigate } from 'react-router-dom';
import { ColorModeProvider } from '@/components/ui/color-mode';
import { AuthProvider } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Layout } from '@/components/layout/Layout';
import { LoginPage } from '@/pages/auth/LoginPage';
import { RegisterPage } from '@/pages/auth/RegisterPage';
import Dashboard from '@/pages/Dashboard';
import { TransactionsPage } from '@/pages/Transactions';
import { PlaceholderPage } from '@/pages/PlaceholderPage';

function App() {
  return (
    <ColorModeProvider>
      <AuthProvider>
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
            <Route
              path="accounts"
              element={
                <PlaceholderPage title="Accounts" subtitle="Manage your accounts" phase="Phase 7" />
              }
            />
            <Route
              path="budgets"
              element={
                <PlaceholderPage title="Budgets" subtitle="Track your budgets" phase="Phase 8" />
              }
            />
            <Route
              path="people"
              element={
                <PlaceholderPage
                  title="People"
                  subtitle="Manage people and split payments"
                  phase="Phase 9"
                />
              }
            />
            <Route
              path="reports"
              element={
                <PlaceholderPage
                  title="Reports"
                  subtitle="View financial reports"
                  phase="Phase 10"
                />
              }
            />
            <Route
              path="settings"
              element={
                <PlaceholderPage
                  title="Settings"
                  subtitle="Configure your preferences"
                  phase="Phase 10"
                />
              }
            />
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
      </AuthProvider>
    </ColorModeProvider>
  );
}

export default App;
