# Frontend Checklist

## Overview

This checklist covers the React + TypeScript frontend implementation using Vite, Chakra UI, and React Query, with strict adherence to the hook constraints (max 1 useState, 1 useEffect per hook).

**References:**

- [`docs/system-design/01-frontend/component-architecture.md`](../system-design/01-frontend/component-architecture.md)
- [`docs/system-design/01-frontend/ui-design-system.md`](../system-design/01-frontend/ui-design-system.md)
- [`docs/system-design/01-frontend/routing-navigation.md`](../system-design/01-frontend/routing-navigation.md)

---

## Project Setup

### Vite + React + TypeScript

- [x] Initialize Vite project (already done in setup)
- [x] Verify TypeScript configuration
  - [x] Enable strict mode
  - [x] Configure path aliases (@/ for src/)
  - [x] Set up proper type checking
- [x] Configure Vite for production builds
  - [x] Enable code splitting
  - [x] Configure asset optimization
  - [x] Set up environment variables

### Dependencies Installation

- [x] Verify all core dependencies installed (from setup checklist)
  - [x] Chakra UI + dependencies
  - [x] React Router DOM
  - [x] React Query (TanStack Query)
  - [x] React Hook Form + Zod
  - [x] Recharts
  - [x] Axios
  - [x] date-fns
  - [x] React Icons
- [x] Install additional dependencies if needed
  - [x] @tanstack/react-table (for advanced tables)
  - [ ] @tanstack/react-virtual (for virtual scrolling)

---

## Chakra UI Configuration

### Theme Setup (`src/theme/index.ts`)

- [x] Create custom theme extending Chakra defaults
  - [x] Define brand colors (primary: #2196f3)
  - [x] Define semantic colors (success, warning, error, income, expense)
  - [x] Configure fonts (Inter for body/heading)
  - [x] Set up font sizes scale
  - [x] Configure spacing scale
  - [x] Define shadow system
  - [x] Set border radius values
- [x] Configure component defaults
  - [x] Button variants and defaults
  - [x] Card styling
  - [x] Input focus colors
  - [x] Form control styles
- [x] Set up color mode configuration
  - [x] Initial color mode: light
  - [x] Enable system color mode preference
  - [x] Define dark mode color overrides

### Theme Provider Setup (`src/main.tsx`)

- [x] Wrap app with ChakraProvider
- [x] Apply custom theme
- [x] Add ColorModeScript for SSR support
- [x] Test theme switching

---

## React Router Setup

### Route Configuration (`src/App.tsx`)

- [x] Install and configure React Router
- [x] Define route structure
  ```typescript
  - / (redirect to /dashboard)
  - /login
  - /register
  - /dashboard (protected)
  - /transactions (protected)
  - /accounts (protected)
  - /budgets (protected)
  - /people (protected)
  - /reports (protected)
  - /settings (protected)
  ```
- [x] Create ProtectedRoute component
- [x] Implement route guards for authentication
- [x] Add 404 Not Found page
- [x] Test navigation between routes

---

## State Management Setup

### React Query Configuration (`src/lib/queryClient.ts`)

- [x] Create QueryClient instance
  ```typescript
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000, // 5 minutes
        cacheTime: 10 * 60 * 1000, // 10 minutes
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });
  ```
- [x] Wrap app with QueryClientProvider
- [x] Add React Query DevTools (development only)
- [x] Test query caching behavior

### Axios Configuration (`src/lib/axios.ts`)

- [x] Create Axios instance with base URL
- [x] Add request interceptor for JWT token
- [x] Add response interceptor for error handling
- [x] Handle 401 unauthorized (redirect to login)
- [x] Handle network errors
- [x] Test API client

---

## Authentication System

### Auth Context (`src/contexts/AuthContext.tsx`)

- [x] Create AuthContext and AuthProvider
- [x] Implement useAuth hook (max 1 useState for user)
  - [x] Store user state
  - [x] Provide login function
  - [x] Provide logout function
  - [x] Provide register function
- [x] Store JWT token in localStorage
- [x] Load user on app mount
- [x] Clear user on logout
- [x] Test authentication flow

### Auth Pages

- [x] Create LoginPage (`src/pages/LoginPage.tsx`)
  - [x] Email/username input
  - [x] Password input
  - [x] Login button
  - [x] Link to register
  - [x] Error display
  - [x] Loading state
- [x] Create RegisterPage (`src/pages/RegisterPage.tsx`)
  - [x] Username input
  - [x] Email input
  - [x] Name input
  - [x] Password input
  - [x] Confirm password
  - [x] Register button
  - [x] Link to login
  - [x] Validation
- [x] Test login/register flows
- [x] Test protected route access

---

## Custom Hooks Implementation

**CRITICAL: Each hook MUST have maximum ONE useState and ONE useEffect**

### API Hooks (`src/hooks/api/`)

#### Transaction Hooks

- [x] `useTransactions.ts` - Fetch transactions with filters
  - [x] ONE useState for local filter state (if needed)
  - [x] Use React Query for data fetching
  - [x] Support pagination
- [x] `useTransaction.ts` - Fetch single transaction
- [x] `useCreateTransaction.ts` - Create transaction mutation
- [x] `useUpdateTransaction.ts` - Update transaction mutation
- [x] `useDeleteTransaction.ts` - Delete transaction mutation
- [x] Test all transaction hooks

#### Account Hooks

- [x] `useAccounts.ts` - Fetch all accounts
- [x] `useAccount.ts` - Fetch single account
- [x] `useCreateAccount.ts` - Create account mutation
- [x] `useUpdateAccount.ts` - Update account mutation
- [x] `useDeleteAccount.ts` - Delete account mutation
- [x] Test all account hooks

#### Budget Hooks

- [x] `useBudgets.ts` - Fetch all budgets
- [x] `useBudget.ts` - Fetch single budget
- [x] `useCreateBudget.ts` - Create budget mutation
- [x] `useUpdateBudget.ts` - Update budget mutation
- [x] `useDeleteBudget.ts` - Delete budget mutation
- [x] `useAddBudgetRange.ts` - Add budget range mutation
- [x] Test all budget hooks

#### People Hooks

- [x] `usePeople.ts` - Fetch all people
- [x] `usePerson.ts` - Fetch single person
- [x] `useCreatePerson.ts` - Create person mutation
- [x] `useUpdatePerson.ts` - Update person mutation
- [x] `useDeletePerson.ts` - Delete person mutation
- [x] `usePersonDebts.ts` - Fetch debts for person
- [x] Test all people hooks

#### Category Hooks

- [x] `useCategories.ts` - Fetch all categories
- [x] `useCreateCategory.ts` - Create category mutation
- [x] `useUpdateCategory.ts` - Update category mutation
- [x] `useDeleteCategory.ts` - Delete category mutation
- [x] Test all category hooks

#### Dashboard Hook

- [x] `useDashboardSummary.ts` - Fetch dashboard data
  - [x] Aggregate multiple data sources
  - [x] Use React Query for caching
- [x] Test dashboard hook

### Form Hooks (`src/hooks/forms/`)

- [x] `useTransactionForm.ts`
  - [x] ONE useState for form data
  - [x] Handle form changes
  - [x] Validate form data
  - [x] Return form state and handlers
- [x] `useAccountForm.ts`
  - [x] ONE useState for form data
  - [x] Validation logic
- [x] `useBudgetForm.ts`
  - [x] ONE useState for form data
  - [x] Budget filter validation
- [x] `usePersonForm.ts`
  - [x] ONE useState for form data
  - [x] Contact validation
- [x] Test all form hooks

### UI State Hooks (`src/hooks/ui/`)

- [x] `useTableSort.ts`
  - [x] ONE useState for sort state (key + order)
  - [x] Handle sort toggle
- [x] `useFilters.ts`
  - [x] ONE useState for filter object
  - [x] Update and reset filters
- [x] `usePagination.ts`
  - [x] ONE useState for page state
  - [x] Handle page changes
- [x] Test all UI hooks

### Business Logic Hooks (`src/hooks/business/`)

- [x] `useSplitCalculator.ts`
  - [x] ONE useState for splits array
  - [x] Calculate remaining amount (derived)
  - [x] Add/remove/update splits
- [x] `useDebtCalculator.ts`
  - [x] Use transaction data (no useState)
  - [x] Calculate total owed (derived)
- [x] `useBudgetStatus.ts`
  - [x] Calculate budget status (derived)
  - [x] No useState needed
- [x] `useChartData.ts`
  - [x] Transform data for charts (derived)
  - [x] No useState needed
- [x] Test all business logic hooks

### Effect Hooks (`src/hooks/effects/`)

- [x] `useDocumentTitle.ts`
  - [x] ONE useEffect to set document title
- [x] `useDebounce.ts` (created instead of useAutoSave)
  - [x] ONE useEffect with debounce
- [x] Test effect hooks

---

## Layout Components

### Main Layout (`src/components/layout/Layout.tsx`)

- [x] Create responsive layout structure
  - [x] Sidebar (desktop) / Drawer (mobile)
  - [x] Header with user menu
  - [x] Main content area with Outlet
  - [x] Responsive breakpoints
- [x] Test layout on different screen sizes

### Sidebar (`src/components/layout/Sidebar.tsx`)

- [x] Create navigation menu
  - [x] Dashboard link with icon
  - [x] Transactions link with icon
  - [x] Accounts link with icon
  - [x] Budgets link with icon
  - [x] People link with icon
  - [x] Reports link with icon
  - [x] Settings link with icon
- [x] Highlight active route
- [x] User profile section at bottom
- [x] Responsive drawer for mobile
- [x] Test navigation

### Header (`src/components/layout/Header.tsx`)

- [x] Page title display
- [x] Mobile menu toggle button
- [x] User menu dropdown
  - [x] Profile link
  - [x] Settings link
  - [x] Logout button
- [x] Color mode toggle
- [x] Test header functionality

---

## Dashboard Page Components

### Dashboard Page (`src/pages/DashboardPage.tsx`)

- [ ] Create dashboard layout
  - [ ] Grid layout with responsive columns
  - [ ] Account summary section (horizontal scroll)
  - [ ] Budget progress section (horizontal scroll)
  - [ ] Net worth widget
  - [ ] Spending chart
  - [ ] Category breakdown
  - [ ] Recent transactions list
- [ ] Use `useDashboardSummary` hook
- [ ] Handle loading states
- [ ] Handle error states
- [ ] Test dashboard rendering

### Dashboard Widgets

- [ ] `NetWorthWidget.tsx`
  - [ ] Display net worth amount
  - [ ] Show change percentage
  - [ ] Up/down arrow indicator
  - [ ] Icon for visual appeal
- [ ] `AccountSummary.tsx`
  - [ ] Horizontal scrollable cards
  - [ ] Account icon + name
  - [ ] Balance display
  - [ ] Account type indicator
- [ ] `BudgetProgress.tsx`
  - [ ] Horizontal scrollable cards
  - [ ] Category icon + name
  - [ ] Progress bar
  - [ ] Spent / Limit display
  - [ ] Warning for over-budget
- [ ] `SpendingChart.tsx`
  - [ ] Line chart with Recharts
  - [ ] Monthly spending trend
  - [ ] Responsive sizing
- [ ] `CategoryBreakdown.tsx`
  - [ ] Pie chart or bar chart
  - [ ] Category percentages
  - [ ] Color-coded categories
- [ ] `RecentTransactions.tsx`
  - [ ] List of recent 5-10 transactions
  - [ ] Transaction icon + title
  - [ ] Amount with color
  - [ ] Date display
  - [ ] Link to view all
- [ ] Test all widgets with mock data

---

## Transactions Page Components

### Transactions Page (`src/pages/TransactionsPage.tsx`)

- [ ] Create page layout
  - [ ] Month navigation tabs (horizontal scroll)
  - [ ] Month summary (spent, income, net)
  - [ ] Transaction list grouped by date
  - [ ] Floating action button for add
- [ ] Use `useTransactions` hook with filters
- [ ] Implement month navigation
- [ ] Handle loading states
- [ ] Handle empty states
- [ ] Test page functionality

### Transaction Components

- [ ] `TransactionList.tsx`
  - [ ] Group transactions by date
  - [ ] Date headers with daily totals
  - [ ] Transaction rows
  - [ ] Infinite scroll or pagination
  - [ ] Loading skeleton
- [ ] `TransactionRow.tsx`
  - [ ] Category icon
  - [ ] Transaction title
  - [ ] Account indicator
  - [ ] Amount with color (red/green)
  - [ ] Split payment indicator
  - [ ] Click to view details
- [ ] `TransactionFilters.tsx`
  - [ ] Account filter
  - [ ] Category filter
  - [ ] Date range filter
  - [ ] Amount range filter
  - [ ] Clear filters button
- [ ] `TransactionFormModal.tsx`
  - [ ] Modal with form
  - [ ] Title input
  - [ ] Amount input
  - [ ] Account select
  - [ ] Category select
  - [ ] Date picker
  - [ ] Notes textarea
  - [ ] Split payment toggle
  - [ ] Save/Cancel buttons
- [ ] `SplitPaymentForm.tsx`
  - [ ] Person selector
  - [ ] Amount input per person
  - [ ] Add/remove person buttons
  - [ ] My share calculation
  - [ ] Total split display
  - [ ] Validation (splits <= total)
- [ ] Test all transaction components

---

## Accounts Page Components

### Accounts Page (`src/pages/AccountsPage.tsx`)

- [ ] Create page layout
  - [ ] Page header with add button
  - [ ] Account list/grid
  - [ ] Total balance summary
- [ ] Use `useAccounts` hook
- [ ] Handle loading/error states
- [ ] Test page functionality

### Account Components

- [ ] `AccountList.tsx`
  - [ ] List of account cards
  - [ ] Responsive grid layout
- [ ] `AccountCard.tsx`
  - [ ] Account icon + name
  - [ ] Account type badge
  - [ ] Balance display
  - [ ] Recent activity sparkline (optional)
  - [ ] Edit/delete buttons
  - [ ] Click to view details
- [ ] `AccountFormModal.tsx`
  - [ ] Account name input
  - [ ] Account type select
  - [ ] Currency select
  - [ ] Notes textarea
  - [ ] Save/Cancel buttons
  - [ ] Validation
- [ ] Test all account components

---

## Budgets Page Components

### Budgets Page (`src/pages/BudgetsPage.tsx`)

- [ ] Create page layout
  - [ ] Month selector
  - [ ] Overall progress summary
  - [ ] Budget list
  - [ ] Add budget button
- [ ] Use `useBudgets` hook
- [ ] Calculate budget statuses
- [ ] Handle loading/error states
- [ ] Test page functionality

### Budget Components

- [ ] `BudgetList.tsx`
  - [ ] List of budget cards
  - [ ] Sort by status/name
- [ ] `BudgetCard.tsx`
  - [ ] Category icon + name
  - [ ] Progress bar with percentage
  - [ ] Spent / Limit display
  - [ ] Days remaining
  - [ ] Warning indicator for over-budget
  - [ ] Edit/delete buttons
- [ ] `BudgetFormModal.tsx`
  - [ ] Budget name input
  - [ ] Filter configuration
    - [ ] Category selector
    - [ ] Account selector (optional)
    - [ ] Date range
  - [ ] Limit amount input
  - [ ] Period selector (monthly, weekly, etc.)
  - [ ] Save/Cancel buttons
  - [ ] Validation
- [ ] Test all budget components

---

## People Page Components

### People Page (`src/pages/PeoplePage.tsx`)

- [ ] Create page layout
  - [ ] Debt summary card
  - [ ] People list
  - [ ] Add person button
- [ ] Use `usePeople` hook
- [ ] Calculate debt totals
- [ ] Handle loading/error states
- [ ] Test page functionality

### People Components

- [ ] `PeopleList.tsx`
  - [ ] List of person cards
  - [ ] Sort by debt amount
- [ ] `PersonCard.tsx`
  - [ ] Person avatar/icon
  - [ ] Person name
  - [ ] Email/phone display
  - [ ] Debt amount (owes me / I owe)
  - [ ] Recent transactions list
  - [ ] Settle up button
  - [ ] Edit/delete buttons
- [ ] `PersonFormModal.tsx`
  - [ ] Name input
  - [ ] Email input
  - [ ] Phone input
  - [ ] Notes textarea
  - [ ] Save/Cancel buttons
  - [ ] Validation
- [ ] `DebtSummary.tsx`
  - [ ] Total owed to me
  - [ ] Total I owe
  - [ ] Net amount
  - [ ] Visual indicator
- [ ] `SettleDebtModal.tsx`
  - [ ] Person name display
  - [ ] Amount owed
  - [ ] Settlement amount input
  - [ ] Settlement date
  - [ ] Notes
  - [ ] Confirm button
- [ ] Test all people components

---

## Reports Page Components

### Reports Page (`src/pages/ReportsPage.tsx`)

- [ ] Create page layout
  - [ ] Report type selector
  - [ ] Period selector
  - [ ] Generate button
  - [ ] Export buttons (PDF, CSV)
  - [ ] Report display area
- [ ] Implement report generation
- [ ] Handle loading states
- [ ] Test page functionality

### Report Components

- [ ] `MonthlyReport.tsx`
  - [ ] Income vs expenses chart
  - [ ] Category breakdown
  - [ ] Spending trends
  - [ ] Key insights
- [ ] `CategoryReport.tsx`
  - [ ] Category spending analysis
  - [ ] Comparison charts
  - [ ] Trends over time
- [ ] `BudgetReport.tsx`
  - [ ] Budget performance
  - [ ] Over/under budget analysis
  - [ ] Recommendations
- [ ] `NetWorthReport.tsx`
  - [ ] Net worth trend chart
  - [ ] Asset/liability breakdown
  - [ ] Growth analysis
- [ ] Test all report components

---

## Settings Page Components

### Settings Page (`src/pages/SettingsPage.tsx`)

- [ ] Create settings layout
  - [ ] Profile settings
  - [ ] Preferences
  - [ ] Security settings
  - [ ] About section
- [ ] Implement settings updates
- [ ] Test settings functionality

---

## Common/Shared Components

### UI Components (`src/components/common/`)

- [x] `LoadingSpinner.tsx`
  - [x] Chakra Spinner with branding
  - [x] Full page and inline variants
- [ ] `ErrorBoundary.tsx`
  - [ ] Catch React errors
  - [ ] Display error message
  - [ ] Reload button
- [x] `EmptyState.tsx`
  - [x] Icon + message
  - [x] Call-to-action button
  - [x] Reusable for different contexts
- [ ] `ConfirmDialog.tsx`
  - [ ] Alert dialog for confirmations
  - [ ] Customizable title/message
  - [ ] Confirm/cancel buttons
- [x] `PageHeader.tsx`
  - [x] Page title
  - [x] Breadcrumbs (optional)
  - [x] Action buttons
- [x] Test all common components

---

## Form Handling & Validation

### React Hook Form Integration

- [ ] Set up form validation with Zod schemas
- [ ] Create validation schemas for:
  - [ ] Transaction form
  - [ ] Account form
  - [ ] Budget form
  - [ ] Person form
  - [ ] User profile form
- [ ] Implement error display
- [ ] Test form validation

### Form Components

- [ ] Create reusable form field components
  - [ ] TextInput with validation
  - [ ] NumberInput with validation
  - [ ] Select with validation
  - [ ] DatePicker with validation
  - [ ] Textarea with validation
- [ ] Test form components

---

## Chart Integration (Recharts)

### Chart Components (`src/components/charts/`)

- [ ] `LineChart.tsx` - Spending trends
  - [ ] Responsive container
  - [ ] Tooltip
  - [ ] Legend
  - [ ] Grid
  - [ ] Custom colors
- [ ] `BarChart.tsx` - Category comparison
  - [ ] Horizontal/vertical variants
  - [ ] Color-coded bars
- [ ] `PieChart.tsx` - Category breakdown
  - [ ] Custom colors
  - [ ] Labels
  - [ ] Legend
- [ ] `AreaChart.tsx` - Net worth over time
  - [ ] Gradient fill
  - [ ] Smooth curves
- [ ] Test all charts with mock data

---

## Responsive Design Implementation

### Mobile Optimizations

- [ ] Test all pages on mobile viewport
- [ ] Implement mobile-specific layouts
  - [ ] Drawer navigation instead of sidebar
  - [ ] Stacked layouts instead of grids
  - [ ] Touch-friendly buttons (min 44x44px)
- [ ] Test horizontal scrolling sections
- [ ] Test form inputs on mobile
- [ ] Verify FAB positioning

### Tablet Optimizations

- [ ] Test all pages on tablet viewport
- [ ] Adjust grid columns for tablet
- [ ] Test navigation on tablet
- [ ] Verify touch interactions

### Desktop Optimizations

- [ ] Test all pages on desktop viewport
- [ ] Verify sidebar navigation
- [ ] Test hover states
- [ ] Verify keyboard navigation

---

## Error Handling & Loading States

### Error Boundaries

- [ ] Implement global error boundary
- [ ] Add error boundaries for major sections
- [ ] Create error fallback UI
- [ ] Test error scenarios

### Loading States

- [ ] Implement skeleton loaders for:
  - [ ] Dashboard widgets
  - [ ] Transaction list
  - [ ] Account cards
  - [ ] Budget cards
- [ ] Add loading spinners for:
  - [ ] Form submissions
  - [ ] Data mutations
  - [ ] Page transitions
- [ ] Test loading states

### Empty States

- [ ] Create empty state components for:
  - [ ] No transactions
  - [ ] No accounts
  - [ ] No budgets
  - [ ] No people
  - [ ] No data in reports
- [ ] Add call-to-action buttons
- [ ] Test empty states

---

## Authentication Flow

### Login Flow

- [ ] Implement login page
- [ ] Handle login form submission
- [ ] Store JWT token
- [ ] Redirect to dashboard on success
- [ ] Display error messages
- [ ] Test login flow

### Registration Flow

- [ ] Implement registration page
- [ ] Handle registration form
- [ ] Validate password strength
- [ ] Auto-login after registration
- [ ] Redirect to dashboard
- [ ] Test registration flow

### Protected Routes

- [ ] Implement route guards
- [ ] Redirect to login if not authenticated
- [ ] Preserve intended destination
- [ ] Test protected route access

### Logout Flow

- [ ] Implement logout function
- [ ] Clear JWT token
- [ ] Clear React Query cache
- [ ] Redirect to login page
- [ ] Test logout flow

---

## Performance Optimization

### Code Splitting

- [ ] Implement lazy loading for routes
  ```typescript
  const DashboardPage = lazy(() => import("./pages/DashboardPage"));
  const TransactionsPage = lazy(() => import("./pages/TransactionsPage"));
  ```
- [ ] Add Suspense boundaries with loading fallbacks
- [ ] Test code splitting

### Memoization

- [ ] Use `useMemo` for expensive calculations
- [ ] Use `useCallback` for event handlers in lists
- [ ] Memoize chart data transformations
- [ ] Test performance improvements

### Virtual Scrolling (Optional)

- [ ] Implement virtual scrolling for long transaction lists
- [ ] Use @tanstack/react-virtual
- [ ] Test with large datasets

### Image Optimization

- [ ] Optimize icon usage
- [ ] Use SVG icons where possible
- [ ] Lazy load images
- [ ] Test image loading

---

## Accessibility (A11y)

### ARIA Labels

- [ ] Add aria-labels to all icon buttons
- [ ] Add aria-labels to interactive elements
- [ ] Test with screen reader

### Keyboard Navigation

- [ ] Test tab navigation through forms
- [ ] Test keyboard shortcuts (if any)
- [ ] Ensure focus indicators visible
- [ ] Test modal focus trapping

### Color Contrast

- [ ] Verify color contrast ratios (WCAG AA)
- [ ] Test in dark mode
- [ ] Ensure text readability

### Screen Reader Support

- [ ] Test with VoiceOver (Mac) or NVDA (Windows)
- [ ] Add descriptive labels
- [ ] Test form error announcements

---

## Testing

### Component Tests (React Testing Library)

- [ ] Test authentication components
  - [ ] Login form
  - [ ] Register form
- [ ] Test dashboard widgets
  - [ ] Net worth widget
  - [ ] Account summary
  - [ ] Budget progress
- [ ] Test transaction components
  - [ ] Transaction list
  - [ ] Transaction form
  - [ ] Split payment form
- [ ] Test form validation
- [ ] Test error states
- [ ] Test loading states

### Hook Tests

- [ ] Test custom hooks with renderHook
- [ ] Test form hooks
- [ ] Test business logic hooks
- [ ] Test API hooks (with MSW)

### Integration Tests

- [ ] Test complete user flows
  - [ ] Login → Dashboard
  - [ ] Create transaction
  - [ ] Create account
  - [ ] Create budget
- [ ] Test navigation
- [ ] Test data persistence

---

## Build & Optimization

### Production Build

- [ ] Run production build: `npm run build`
- [ ] Verify build output in `dist/`
- [ ] Check bundle sizes
- [ ] Analyze bundle with `vite-plugin-visualizer`

### Build Optimization

- [ ] Enable code splitting
- [ ] Minimize bundle size
- [ ] Optimize images and assets
- [ ] Configure caching headers
- [ ] Test production build locally

### Environment Configuration

- [ ] Set up environment variables
  - [ ] `VITE_API_URL` for backend URL
  - [ ] Different configs for dev/prod
- [ ] Create `.env.example`
- [ ] Test with different environments

---

## Documentation

### Component Documentation

- [ ] Add JSDoc comments to components
- [ ] Document prop types
- [ ] Add usage examples
- [ ] Document custom hooks

### Code Comments

- [ ] Comment complex logic
- [ ] Explain business rules
- [ ] Document workarounds

---

## Completion Checklist

- [ ] All pages implemented and functional
- [ ] All custom hooks follow strict constraints (max 1 useState, 1 useEffect)
- [ ] Authentication flow working
- [ ] All CRUD operations working
- [ ] Forms validated properly
- [ ] Charts displaying correctly
- [ ] Responsive design tested on all breakpoints
- [ ] Loading and error states implemented
- [ ] Accessibility requirements met
- [ ] Component tests passing
- [ ] Production build successful
- [ ] Performance optimized

**Estimated Time:** 7-10 days

**Next Steps:** Proceed to [`04-integration-checklist.md`](04-integration-checklist.md)
