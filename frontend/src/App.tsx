import { Routes, Route } from 'react-router-dom';
import { ColorModeProvider } from '@/components/ui/color-mode';
import { Layout } from '@/components/layout/Layout';
import { DashboardPage } from '@/pages/Dashboard';
import { TransactionsPage } from '@/pages/Transactions';
import { PlaceholderPage } from '@/pages/PlaceholderPage';

function App() {
  return (
    <ColorModeProvider>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<DashboardPage />} />
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
              <PlaceholderPage title="Reports" subtitle="View financial reports" phase="Phase 10" />
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
      </Routes>
    </ColorModeProvider>
  );
}

export default App;
