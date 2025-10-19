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
- [ ] Initialize Vite project (already done in setup)
- [ ] Verify TypeScript configuration
  - [ ] Enable strict mode
  - [ ] Configure path aliases (@/ for src/)
  - [ ] Set up proper type checking
- [ ] Configure Vite for production builds
  - [ ] Enable code splitting
  - [ ] Configure asset optimization
  - [ ] Set up environment variables

### Dependencies Installation
- [ ] Verify all core dependencies installed (from setup checklist)
  - [ ] Chakra UI + dependencies
  - [ ] React Router DOM
  - [ ] React Query (TanStack Query)
  - [ ] React Hook Form + Zod
  - [ ] Recharts
  - [ ] Axios
  - [ ] date-fns
  - [ ] React Icons
- [ ] Install additional dependencies if needed
  - [ ] @tanstack/react-table (for advanced tables)
  - [ ] @tanstack/react-virtual (for virtual scrolling)

---

## Chakra UI Configuration

### Theme Setup (`src/theme/index.ts`)
- [ ] Create custom theme extending Chakra defaults
  - [ ] Define brand colors (primary: #2196f3)
  - [ ] Define semantic colors (success, warning, error, income, expense)
  - [ ] Configure fonts (Inter for body/heading)
  - [ ] Set up font sizes scale
  - [ ] Configure spacing scale
  - [ ] Define shadow system
  - [ ] Set border radius values
- [ ] Configure component defaults
  - [ ] Button variants and defaults
  - [ ] Card styling
  - [ ] Input focus colors
  - [ ] Form control styles
- [ ] Set up color mode configuration
  - [ ] Initial color mode: light
  - [ ] Enable system color mode preference
  - [ ] Define dark mode color overrides

### Theme Provider Setup (`src/main.tsx`)
- [ ] Wrap app with ChakraProvider
- [ ] Apply custom theme
- [ ] Add ColorModeScript for SSR support
- [ ] Test theme switching

---

## React Router Setup

### Route Configuration (`src/App.tsx`)
- [ ] Install and configure React Router
- [ ] Define route structure
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
- [ ] Create ProtectedRoute component
- [ ] Implement route guards for authentication
- [ ] Add 404 Not Found page
- [ ] Test navigation between routes

---

## State Management Setup

### React Query Configuration (`src/lib/queryClient.ts`)
- [ ] Create QueryClient instance
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
- [ ] Wrap app with QueryClientProvider
- [ ] Add React Query DevTools (development only)
- [ ] Test query caching behavior

### Axios Configuration (`src/lib/axios.ts`)
- [ ] Create Axios instance with base URL
- [ ] Add request interceptor for JWT token
- [ ] Add response interceptor for error handling
- [ ] Handle 401 unauthorized (redirect to login)
- [ ] Handle network errors
- [ ] Test API client

---

## Authentication System

### Auth Context (`src/contexts/AuthContext.tsx`)
- [ ] Create AuthContext and AuthProvider
- [ ] Implement useAuth hook (max 1 useState for user)
  - [ ] Store user state
  - [ ] Provide login function
  - [ ] Provide logout function
  - [ ] Provide register function
- [ ] Store JWT token in localStorage
- [ ] Load user on app mount
- [ ] Clear user on logout
- [ ] Test authentication flow

### Auth Pages
- [ ] Create LoginPage (`src/pages/LoginPage.tsx`)
  - [ ] Email/username input
  - [ ] Password input
  - [ ] Login button
  - [ ] Link to register
  - [ ] Error display
  - [ ] Loading state
- [ ] Create RegisterPage (`src/pages/RegisterPage.tsx`)
  - [ ] Username input
  - [ ] Email input
  - [ ] Name input
  - [ ] Password input
  - [ ] Confirm password
  - [ ] Register button
  - [ ] Link to login
  - [ ] Validation
- [ ] Test login/register flows
- [ ] Test protected route access

---

## Custom Hooks Implementation

**CRITICAL: Each hook MUST have maximum ONE useState and ONE useEffect**

### API Hooks (`src/hooks/api/`)

#### Transaction Hooks
- [ ] `useTransactions.ts` - Fetch transactions with filters
  - [ ] ONE useState for local filter state (if needed)
  - [ ] Use React Query for data fetching
  - [ ] Support pagination
- [ ] `useTransaction.ts` - Fetch single transaction
- [ ] `useCreateTransaction.ts` - Create transaction mutation
- [ ] `useUpdateTransaction.ts` - Update transaction mutation
- [ ] `useDeleteTransaction.ts` - Delete transaction mutation
- [ ] Test all transaction hooks

#### Account Hooks
- [ ] `useAccounts.ts` - Fetch all accounts
- [ ] `useAccount.ts` - Fetch single account
- [ ] `useCreateAccount.ts` - Create account mutation
- [ ] `useUpdateAccount.ts` - Update account mutation
- [ ] `useDeleteAccount.ts` - Delete account mutation
- [ ] Test all account hooks

#### Budget Hooks
- [ ] `useBudgets.ts` - Fetch all budgets
- [ ] `useBudget.ts` - Fetch single budget
- [ ] `useCreateBudget.ts` - Create budget mutation
- [ ] `useUpdateBudget.ts` - Update budget mutation
- [ ] `useDeleteBudget.ts` - Delete budget mutation
- [ ] `useAddBudgetRange.ts` - Add budget range mutation
- [ ] Test all budget hooks

#### People Hooks
- [ ] `usePeople.ts` - Fetch all people
- [ ] `usePerson.ts` - Fetch single person
- [ ] `useCreatePerson.ts` - Create person mutation
- [ ] `useUpdatePerson.ts` - Update person mutation
- [ ] `useDeletePerson.ts` - Delete person mutation
- [ ] `usePersonDebts.ts` - Fetch debts for person
- [ ] Test all people hooks

#### Category Hooks
- [ ] `useCategories.ts` - Fetch all categories
- [ ] `useCreateCategory.ts` - Create category mutation
- [ ] `useUpdateCategory.ts` - Update category mutation
- [ ] `useDeleteCategory.ts` - Delete category mutation
- [ ] Test all category hooks

#### Dashboard Hook
- [ ] `useDashboardSummary.ts` - Fetch dashboard data
  - [ ] Aggregate multiple data sources
  - [ ] Use React Query for caching
- [ ] Test dashboard hook

### Form Hooks (`src/hooks/forms/`)
- [ ] `useTransactionForm.ts`
  - [ ] ONE useState for form data
  - [ ] Handle form changes
  - [ ] Validate form data
  - [ ] Return form state and handlers
- [ ] `useAccountForm.ts`
  - [ ] ONE useState for form data
  - [ ] Validation logic
- [ ] `useBudgetForm.ts`
  - [ ] ONE useState for form data
  - [ ] Budget filter validation
- [ ] `usePersonForm.ts`
  - [ ] ONE useState for form data
  - [ ] Contact validation
- [ ] Test all form hooks

### UI State Hooks (`src/hooks/ui/`)
- [ ] `useTableSort.ts`
  - [ ] ONE useState for sort state (key + order)
  - [ ] Handle sort toggle
- [ ] `useFilters.ts`
  - [ ] ONE useState for filter object
  - [ ] Update and reset filters
- [ ] `usePagination.ts`
  - [ ] ONE useState for page state
  - [ ] Handle page changes
- [ ] Test all UI hooks

### Business Logic Hooks (`src/hooks/business/`)
- [ ] `useSplitCalculator.ts`
  - [ ] ONE useState for splits array
  - [ ] Calculate remaining amount (derived)
  - [ ] Add/remove/update splits
- [ ] `useDebtCalculator.ts`
  - [ ] Use transaction data (no useState)
  - [ ] Calculate total owed (derived)
- [ ] `useBudgetStatus.ts`
  - [ ] Calculate budget status (derived)
  - [ ] No useState needed
- [ ] `useChartData.ts`
  - [ ] Transform data for charts (derived)
  - [ ] No useState needed
- [ ] Test all business logic hooks

### Effect Hooks (`src/hooks/effects/`)
- [ ] `useDocumentTitle.ts`
  - [ ] ONE useEffect to set document title
- [ ] `useAutoSave.ts` (optional)
  - [ ] ONE useEffect with debounce
- [ ] Test effect hooks

---

## Layout Components

### Main Layout (`src/components/layout/Layout.tsx`)
- [ ] Create responsive layout structure
  - [ ] Sidebar (desktop) / Drawer (mobile)
  - [ ] Header with user menu
  - [ ] Main content area with Outlet
  - [ ] Responsive breakpoints
- [ ] Test layout on different screen sizes

### Sidebar (`src/components/layout/Sidebar.tsx`)
- [ ] Create navigation menu
  - [ ] Dashboard link with icon
  - [ ] Transactions link with icon
  - [ ] Accounts link with icon
  - [ ] Budgets link with icon
  - [ ] People link with icon
  - [ ] Reports link with icon
  - [ ] Settings link with icon
- [ ] Highlight active route
- [ ] User profile section at bottom
- [ ] Responsive drawer for mobile
- [ ] Test navigation

### Header (`src/components/layout/Header.tsx`)
- [ ] Page title display
- [ ] Mobile menu toggle button
- [ ] User menu dropdown
  - [ ] Profile link
  - [ ] Settings link
  - [ ] Logout button
- [ ] Color mode toggle
- [ ] Test header functionality

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
- [ ] `LoadingSpinner.tsx`
  - [ ] Chakra Spinner with branding
  - [ ] Full page and inline variants
- [ ] `ErrorBoundary.tsx`
  - [ ] Catch React errors
  - [ ] Display error message
  - [ ] Reload button
- [ ] `EmptyState.tsx`
  - [ ] Icon + message
  - [ ] Call-to-action button
  - [ ] Reusable for different contexts
- [ ] `ConfirmDialog.tsx`
  - [ ] Alert dialog for confirmations
  - [ ] Customizable title/message
  - [ ] Confirm/cancel buttons
- [ ] `PageHeader.tsx`
  - [ ] Page title
  - [ ] Breadcrumbs (optional)
  - [ ] Action buttons
- [ ] Test all common components

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
  const DashboardPage = lazy(() => import('./pages/DashboardPage'));
  const TransactionsPage = lazy(() => import('./pages/TransactionsPage'));
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