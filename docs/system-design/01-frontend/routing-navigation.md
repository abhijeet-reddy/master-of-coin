# Routing & Navigation

## Overview

This document defines the routing structure and navigation patterns for Master of Coin using React Router v6.

## Route Structure

```typescript
// App.tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

function App() {
  return (
    <ChakraProvider theme={theme}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              {/* Public Routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              
              {/* Protected Routes */}
              <Route element={<ProtectedRoute />}>
                <Route element={<Layout />}>
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/transactions" element={<TransactionsPage />} />
                  <Route path="/transactions/:id" element={<TransactionDetailPage />} />
                  <Route path="/accounts" element={<AccountsPage />} />
                  <Route path="/accounts/:id" element={<AccountDetailPage />} />
                  <Route path="/budgets" element={<BudgetsPage />} />
                  <Route path="/budgets/:id" element={<BudgetDetailPage />} />
                  <Route path="/people" element={<PeoplePage />} />
                  <Route path="/people/:id" element={<PersonDetailPage />} />
                  <Route path="/reports" element={<ReportsPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                </Route>
              </Route>
              
              {/* 404 */}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </QueryClientProvider>
    </ChakraProvider>
  );
}
```

## Route Definitions

| Path | Component | Description | Auth Required |
|------|-----------|-------------|---------------|
| `/` | Redirect to `/dashboard` | Root redirect | Yes |
| `/login` | LoginPage | User login | No |
| `/register` | RegisterPage | User registration | No |
| `/dashboard` | DashboardPage | Main dashboard | Yes |
| `/transactions` | TransactionsPage | Transaction list | Yes |
| `/transactions/:id` | TransactionDetailPage | Transaction details | Yes |
| `/accounts` | AccountsPage | Account list | Yes |
| `/accounts/:id` | AccountDetailPage | Account details | Yes |
| `/budgets` | BudgetsPage | Budget list | Yes |
| `/budgets/:id` | BudgetDetailPage | Budget details | Yes |
| `/people` | PeoplePage | People & debts | Yes |
| `/people/:id` | PersonDetailPage | Person details | Yes |
| `/reports` | ReportsPage | Financial reports | Yes |
| `/settings` | SettingsPage | User settings | Yes |

## Protected Routes

```typescript
// ProtectedRoute.tsx
function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();
  
  if (isLoading) {
    return <LoadingSpinner />;
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  
  return <Outlet />;
}
```

## Navigation Component

```typescript
// Sidebar.tsx
function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  
  const navItems = [
    { path: '/dashboard', icon: MdDashboard, label: 'Dashboard' },
    { path: '/transactions', icon: MdSwapHoriz, label: 'Transactions' },
    { path: '/accounts', icon: MdAccountBalance, label: 'Accounts' },
    { path: '/budgets', icon: MdPieChart, label: 'Budgets' },
    { path: '/people', icon: MdPeople, label: 'People' },
    { path: '/reports', icon: MdAssessment, label: 'Reports' },
  ];
  
  return (
    <VStack align="stretch" spacing={1}>
      {navItems.map(item => (
        <Button
          key={item.path}
          leftIcon={<Icon as={item.icon} />}
          variant={location.pathname === item.path ? 'solid' : 'ghost'}
          justifyContent="flex-start"
          onClick={() => navigate(item.path)}
        >
          {item.label}
        </Button>
      ))}
    </VStack>
  );
}
```

## Navigation Hooks

```typescript
// useNavigation.ts
function useNavigation() {
  const navigate = useNavigate();
  
  return {
    goToDashboard: () => navigate('/dashboard'),
    goToTransactions: () => navigate('/transactions'),
    goToTransaction: (id: string) => navigate(`/transactions/${id}`),
    goToAccounts: () => navigate('/accounts'),
    goToAccount: (id: string) => navigate(`/accounts/${id}`),
    goToBudgets: () => navigate('/budgets'),
    goToBudget: (id: string) => navigate(`/budgets/${id}`),
    goToPeople: () => navigate('/people'),
    goToPerson: (id: string) => navigate(`/people/${id}`),
    goToReports: () => navigate('/reports'),
    goToSettings: () => navigate('/settings'),
    goBack: () => navigate(-1),
  };
}
```

## URL Parameters & Query Strings

```typescript
// Transaction filters via query params
// /transactions?month=2024-01&category=food&account=checking

function TransactionsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  
  const filters = {
    month: searchParams.get('month'),
    category: searchParams.get('category'),
    account: searchParams.get('account'),
  };
  
  const updateFilters = (newFilters: Partial<typeof filters>) => {
    const params = new URLSearchParams(searchParams);
    Object.entries(newFilters).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    });
    setSearchParams(params);
  };
  
  return (
    // Component using filters
  );
}
```

## Breadcrumbs

```typescript
// Breadcrumbs.tsx
function Breadcrumbs() {
  const location = useLocation();
  const pathnames = location.pathname.split('/').filter(x => x);
  
  return (
    <Breadcrumb>
      <BreadcrumbItem>
        <BreadcrumbLink href="/">
          <Icon as={MdHome} />
        </BreadcrumbLink>
      </BreadcrumbItem>
      {pathnames.map((name, index) => {
        const routeTo = `/${pathnames.slice(0, index + 1).join('/')}`;
        const isLast = index === pathnames.length - 1;
        
        return (
          <BreadcrumbItem key={name} isCurrentPage={isLast}>
            <BreadcrumbLink href={routeTo}>
              {name.charAt(0).toUpperCase() + name.slice(1)}
            </BreadcrumbLink>
          </BreadcrumbItem>
        );
      })}
    </Breadcrumb>
  );
}
```

## Code Splitting

```typescript
// Lazy load pages for better performance
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const TransactionsPage = lazy(() => import('./pages/TransactionsPage'));
const AccountsPage = lazy(() => import('./pages/AccountsPage'));
const BudgetsPage = lazy(() => import('./pages/BudgetsPage'));
const PeoplePage = lazy(() => import('./pages/PeoplePage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));

// Wrap routes in Suspense
<Suspense fallback={<LoadingSpinner />}>
  <Routes>
    {/* Routes */}
  </Routes>
</Suspense>
```

## Summary

- ✅ Clean URL structure
- ✅ Protected routes with authentication
- ✅ Nested layouts with Outlet
- ✅ Query parameters for filters
- ✅ Navigation hooks for type-safe routing
- ✅ Code splitting for performance
- ✅ Breadcrumb navigation
- ✅ 404 handling
