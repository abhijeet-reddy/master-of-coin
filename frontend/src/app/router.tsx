import type { ComponentType } from 'react';
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom';
import { RequireAuth } from './auth/RequireAuth';
import { AppShell } from './shell/AppShell';
import { RouteError } from './errors/RouteError';
import { BootScreen } from './auth/BootScreen';
import type { RouteHandle } from './shell/routeMeta';

/** A lazily loaded route module's component. */
type Loader = () => Promise<{ Component: ComponentType }>;

function page<M>(load: () => Promise<M>, pick: (m: M) => ComponentType): Loader {
  return async () => ({ Component: pick(await load()) });
}

function route(path: string, lazy: Loader, handle: RouteHandle): RouteObject {
  return { path, lazy, handle };
}

const parent = (label: string, to: string): RouteHandle['crumb'] => ({ label, to });

export const routes: RouteObject[] = [
  {
    errorElement: <RouteError />,
    hydrateFallbackElement: <BootScreen />,
    children: [
      route(
        'login',
        page(
          () => import('@/features/auth/pages/LoginPage'),
          (m) => m.LoginPage
        ),
        { title: 'Sign in' }
      ),
      route(
        'register',
        page(
          () => import('@/features/auth/pages/RegisterPage'),
          (m) => m.RegisterPage
        ),
        {
          title: 'Create account',
        }
      ),
      {
        element: <RequireAuth />,
        children: [
          {
            element: <AppShell />,
            children: [
              { index: true, element: <Navigate to="/dashboard" replace /> },
              route(
                'dashboard',
                page(
                  () => import('@/features/dashboard/pages/DashboardPage'),
                  (m) => m.DashboardPage
                ),
                {
                  title: 'Dashboard',
                }
              ),
              route(
                'transactions',
                page(
                  () => import('@/features/transactions/pages/TransactionsPage'),
                  (m) => m.TransactionsPage
                ),
                { title: 'Transactions' }
              ),
              route(
                'transactions/:id',
                page(
                  () => import('@/features/transactions/pages/TransactionDetailPage'),
                  (m) => m.TransactionDetailPage
                ),
                {
                  title: 'Transaction',
                  crumb: parent('Transactions', '/transactions'),
                }
              ),
              route(
                'accounts',
                page(
                  () => import('@/features/accounts/pages/AccountsPage'),
                  (m) => m.AccountsPage
                ),
                { title: 'Accounts' }
              ),
              route(
                'accounts/:id',
                page(
                  () => import('@/features/accounts/pages/AccountDetailPage'),
                  (m) => m.AccountDetailPage
                ),
                {
                  title: 'Account',
                  crumb: parent('Accounts', '/accounts'),
                }
              ),
              route(
                'budgets',
                page(
                  () => import('@/features/budgets/pages/BudgetsPage'),
                  (m) => m.BudgetsPage
                ),
                { title: 'Budgets' }
              ),
              route(
                'budgets/:id',
                page(
                  () => import('@/features/budgets/pages/BudgetDetailPage'),
                  (m) => m.BudgetDetailPage
                ),
                {
                  title: 'Budget',
                  crumb: parent('Budgets', '/budgets'),
                }
              ),
              route(
                'categories',
                page(
                  () => import('@/features/categories/pages/CategoriesPage'),
                  (m) => m.CategoriesPage
                ),
                { title: 'Categories' }
              ),
              route(
                'categories/:id',
                page(
                  () => import('@/features/categories/pages/CategoryDetailPage'),
                  (m) => m.CategoryDetailPage
                ),
                {
                  title: 'Category',
                  crumb: parent('Categories', '/categories'),
                }
              ),
              route(
                'people',
                page(
                  () => import('@/features/people/pages/PeoplePage'),
                  (m) => m.PeoplePage
                ),
                { title: 'People' }
              ),
              route(
                'people/:id',
                page(
                  () => import('@/features/people/pages/PersonDetailPage'),
                  (m) => m.PersonDetailPage
                ),
                {
                  title: 'Person',
                  crumb: parent('People', '/people'),
                }
              ),
              route(
                'trash',
                page(
                  () => import('@/features/trash/pages/TrashPage'),
                  (m) => m.TrashPage
                ),
                { title: 'Trash' }
              ),
              route(
                'jobs',
                page(
                  () => import('@/features/jobs/pages/JobsPage'),
                  (m) => m.JobsPage
                ),
                { title: 'Jobs' }
              ),
              route(
                'jobs/:type/:id',
                page(
                  () => import('@/features/jobs/pages/JobDetailPage'),
                  (m) => m.JobDetailPage
                ),
                {
                  title: 'Job',
                  crumb: parent('Jobs', '/jobs'),
                }
              ),
              route(
                'schedules',
                page(
                  () => import('@/features/schedules/pages/SchedulesPage'),
                  (m) => m.SchedulesPage
                ),
                { title: 'Schedules' }
              ),
              route(
                'schedules/:id',
                page(
                  () => import('@/features/schedules/pages/ScheduleDetailPage'),
                  (m) => m.ScheduleDetailPage
                ),
                {
                  title: 'Schedule',
                  crumb: parent('Schedules', '/schedules'),
                }
              ),
              route(
                'reports',
                page(
                  () => import('@/features/reports/pages/ReportsPage'),
                  (m) => m.ReportsPage
                ),
                { title: 'Reports' }
              ),
              route(
                'settings',
                page(
                  () => import('@/features/settings/pages/SettingsPage'),
                  (m) => m.SettingsPage
                ),
                { title: 'Settings' }
              ),
              {
                path: '*',
                lazy: page(
                  () => import('./NotFound'),
                  (m) => m.default
                ),
                handle: { title: 'Not found' } satisfies RouteHandle,
              },
            ],
          },
        ],
      },
    ],
  },
];

export const router = createBrowserRouter(routes);
