import { Routes, Route, Navigate } from 'react-router-dom';
import { ColorModeProvider } from '@/components/ui/color-mode';
import { AuthProvider } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Layout } from '@/components/layout/Layout';
import { LoginPage } from '@/pages/auth/LoginPage';
import { RegisterPage } from '@/pages/auth/RegisterPage';
import Dashboard from '@/pages/Dashboard';
import { TransactionsPage } from '@/pages/Transactions';
import { Accounts } from '@/pages/Accounts';
import { Budgets } from '@/pages/Budgets';
import { People } from '@/pages/People';
import Reports from '@/pages/Reports';
import { Settings } from '@/pages/Settings';
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
            <Route path="accounts" element={<Accounts />} />
            <Route path="budgets" element={<Budgets />} />
            <Route path="people" element={<People />} />
            <Route path="reports" element={<Reports />} />
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
      </AuthProvider>
    </ColorModeProvider>
  );
}

export default App;
