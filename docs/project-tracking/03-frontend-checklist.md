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

- [x] Create dashboard layout
  - [x] Grid layout with responsive columns
  - [x] Account summary section (horizontal scroll)
  - [x] Budget progress section (horizontal scroll)
  - [x] Net worth widget
  - [x] Spending chart
  - [x] Category breakdown
  - [x] Recent transactions list
- [x] Use `useDashboardSummary` hook
- [x] Handle loading states
- [x] Handle error states
- [x] Test dashboard rendering

### Dashboard Widgets

- [x] `NetWorthWidget.tsx`
  - [x] Display net worth amount
  - [x] Show change percentage
  - [x] Up/down arrow indicator
  - [x] Icon for visual appeal
- [x] `AccountSummary.tsx`
  - [x] Horizontal scrollable cards
  - [x] Account icon + name
  - [x] Balance display
  - [x] Account type indicator
- [x] `BudgetProgress.tsx`
  - [x] Horizontal scrollable cards
  - [x] Category icon + name
  - [x] Progress bar
  - [x] Spent / Limit display
  - [x] Warning for over-budget
- [x] `SpendingChart.tsx`
  - [x] Line chart with Recharts
  - [x] Monthly spending trend
  - [x] Responsive sizing
- [x] `CategoryBreakdown.tsx`
  - [x] Pie chart or bar chart
  - [x] Category percentages
  - [x] Color-coded categories
- [x] `RecentTransactions.tsx`
  - [x] List of recent 5-10 transactions
  - [x] Transaction icon + title
  - [x] Amount with color
  - [x] Date display
  - [x] Link to view all
- [x] Test all widgets with mock data

---

## Transactions Page Components

### Transactions Page (`src/pages/TransactionsPage.tsx`)

- [x] Create page layout
  - [x] Month navigation tabs (horizontal scroll)
  - [x] Month summary (spent, income, net)
  - [x] Transaction list grouped by date
  - [x] Floating action button for add
- [x] Use `useTransactions` hook with filters
- [x] Implement month navigation
- [x] Handle loading states
- [x] Handle empty states
- [x] Test page functionality

### Transaction Components

- [x] `TransactionList.tsx`
  - [x] Group transactions by date
  - [x] Date headers with daily totals
  - [x] Transaction rows
  - [x] Infinite scroll or pagination
  - [x] Loading skeleton
- [x] `TransactionRow.tsx`
  - [x] Category icon
  - [x] Transaction title
  - [x] Account indicator
  - [x] Amount with color (red/green)
  - [x] Split payment indicator
  - [x] Click to view details
- [x] `TransactionFilters.tsx`
  - [x] Account filter
  - [x] Category filter
  - [x] Date range filter
  - [x] Amount range filter
  - [x] Clear filters button
- [x] `TransactionFormModal.tsx`
  - [x] Modal with form
  - [x] Title input
  - [x] Amount input
  - [x] Account select
  - [x] Category select
  - [x] Date picker
  - [x] Notes textarea
  - [x] Split payment toggle
  - [x] Save/Cancel buttons
- [x] `SplitPaymentForm.tsx`
  - [x] Person selector
  - [x] Amount input per person
  - [x] Add/remove person buttons
  - [x] My share calculation
  - [x] Total split display
  - [x] Validation (splits <= total)
- [x] Test all transaction components

---

## Accounts Page Components

### Accounts Page (`src/pages/AccountsPage.tsx`)

- [x] Create page layout
  - [x] Page header with add button
  - [x] Account list/grid
  - [x] Total balance summary
- [x] Use `useAccounts` hook
- [x] Handle loading/error states
- [x] Test page functionality

### Account Components

- [x] `AccountList.tsx`
  - [x] List of account cards
  - [x] Responsive grid layout
- [x] `AccountCard.tsx`
  - [x] Account icon + name
  - [x] Account type badge
  - [x] Balance display
  - [x] Recent activity sparkline (optional)
  - [x] Edit/delete buttons
  - [x] Click to view details
- [x] `AccountFormModal.tsx`
  - [x] Account name input
  - [x] Account type select
  - [x] Currency select
  - [x] Notes textarea
  - [x] Save/Cancel buttons
  - [x] Validation
- [x] Test all account components

---

## Budgets Page Components

### Budgets Page (`src/pages/BudgetsPage.tsx`)

- [x] Create page layout
  - [x] Month selector
  - [x] Overall progress summary
  - [x] Budget list
  - [x] Add budget button
- [x] Use `useBudgets` hook
- [x] Calculate budget statuses
- [x] Handle loading/error states
- [x] Test page functionality

### Budget Components

- [x] `BudgetList.tsx`
  - [x] List of budget cards
  - [x] Sort by status/name
- [x] `BudgetCard.tsx`
  - [x] Category icon + name
  - [x] Progress bar with percentage
  - [x] Spent / Limit display
  - [x] Days remaining
  - [x] Warning indicator for over-budget
  - [x] Edit/delete buttons
- [x] `BudgetFormModal.tsx`
  - [x] Budget name input
  - [x] Filter configuration
    - [x] Category selector
    - [x] Account selector (optional)
    - [x] Date range
  - [x] Limit amount input
  - [x] Period selector (monthly, weekly, etc.)
  - [x] Save/Cancel buttons
  - [x] Validation
- [x] Test all budget components

---

## People Page Components

### People Page (`src/pages/PeoplePage.tsx`)

- [x] Create page layout
  - [x] Debt summary card
  - [x] People list
  - [x] Add person button
- [x] Use `usePeople` hook
- [x] Calculate debt totals
- [x] Handle loading/error states
- [x] Test page functionality

### People Components

- [x] `PeopleList.tsx`
  - [x] List of person cards
  - [x] Sort by debt amount
- [x] `PersonCard.tsx`
  - [x] Person avatar/icon
  - [x] Person name
  - [x] Email/phone display
  - [x] Debt amount (owes me / I owe)
  - [x] Recent transactions list
  - [x] Settle up button
  - [x] Edit/delete buttons
- [x] `PersonFormModal.tsx`
  - [x] Name input
  - [x] Email input
  - [x] Phone input
  - [x] Notes textarea
  - [x] Save/Cancel buttons
  - [x] Validation
- [x] `DebtSummary.tsx`
  - [x] Total owed to me
  - [x] Total I owe
  - [x] Net amount
  - [x] Visual indicator
- [x] `SettleDebtModal.tsx`
  - [x] Person name display
  - [x] Amount owed
  - [x] Settlement amount input
  - [x] Settlement date
  - [x] Notes
  - [x] Confirm button
- [x] Test all people components

---

## Reports Page Components

### Reports Page (`src/pages/ReportsPage.tsx`)

- [x] Create page layout
  - [x] Report type selector
  - [x] Period selector
  - [x] Generate button
  - [x] Export buttons (PDF, CSV)
  - [x] Report display area
- [x] Implement report generation
- [x] Handle loading states
- [x] Test page functionality

### Report Components

- [x] `MonthlyReport.tsx`
  - [x] Income vs expenses chart
  - [x] Category breakdown
  - [x] Spending trends
  - [x] Key insights
- [x] `CategoryReport.tsx`
  - [x] Category spending analysis
  - [x] Comparison charts
  - [x] Trends over time
- [x] `BudgetReport.tsx`
  - [x] Budget performance
  - [x] Over/under budget analysis
  - [x] Recommendations
- [x] `NetWorthReport.tsx`
  - [x] Net worth trend chart
  - [x] Asset/liability breakdown
  - [x] Growth analysis
- [x] Test all report components

---

## Settings Page Components

### Settings Page (`src/pages/SettingsPage.tsx`)

- [x] Create settings layout
  - [x] Profile settings
  - [x] Preferences
  - [x] Security settings
  - [x] About section
- [x] Implement settings updates
- [x] Test settings functionality

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

- [x] Test all pages on mobile viewport
- [x] Implement mobile-specific layouts
  - [x] Drawer navigation instead of sidebar
  - [x] Stacked layouts instead of grids
  - [x] Touch-friendly buttons (min 44x44px)
- [x] Test horizontal scrolling sections
- [x] Test form inputs on mobile
- [x] Verify FAB positioning

### Tablet Optimizations

- [x] Test all pages on tablet viewport
- [x] Adjust grid columns for tablet
- [x] Test navigation on tablet
- [x] Verify touch interactions

### Desktop Optimizations

- [x] Test all pages on desktop viewport
- [x] Verify sidebar navigation
- [x] Test hover states
- [x] Verify keyboard navigation

---

## Error Handling & Loading States

### Error Boundaries

- [x] Implement global error boundary
- [x] Add error boundaries for major sections
- [x] Create error fallback UI
- [x] Test error scenarios

### Loading States

- [x] Implement skeleton loaders for:
  - [x] Dashboard widgets
  - [x] Transaction list
  - [x] Account cards
  - [x] Budget cards
- [x] Add loading spinners for:
  - [x] Form submissions
  - [x] Data mutations
  - [x] Page transitions
- [x] Test loading states

### Empty States

- [x] Create empty state components for:
  - [x] No transactions
  - [x] No accounts
  - [x] No budgets
  - [x] No people
  - [x] No data in reports
- [x] Add call-to-action buttons
- [x] Test empty states

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

- [x] Add aria-labels to all icon buttons
- [x] Add aria-labels to interactive elements
- [x] Test with screen reader

### Keyboard Navigation

- [x] Test tab navigation through forms
- [x] Test keyboard shortcuts (if any)
- [x] Ensure focus indicators visible
- [x] Test modal focus trapping

### Color Contrast

- [x] Verify color contrast ratios (WCAG AA)
- [x] Test in dark mode
- [x] Ensure text readability

### Screen Reader Support

- [x] Test with VoiceOver (Mac) or NVDA (Windows)
- [x] Add descriptive labels
- [x] Test form error announcements

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
