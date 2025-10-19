# Integration Checklist

## Overview
This checklist covers the integration of frontend and backend systems, including API client setup, authentication flow, feature-by-feature integration testing, and end-to-end verification.

**References:**
- [`docs/system-design/04-api/api-specification.md`](../system-design/04-api/api-specification.md)
- [`docs/system-design/04-api/api-patterns.md`](../system-design/04-api/api-patterns.md)

---

## API Client Setup

### Axios Configuration
- [ ] Create Axios instance (`src/lib/axios.ts`)
  ```typescript
  const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
    timeout: 10000,
    headers: {
      'Content-Type': 'application/json',
    },
  });
  ```
- [ ] Verify base URL configuration
- [ ] Test timeout settings
- [ ] Test connection to backend

### Request Interceptor
- [ ] Implement request interceptor
  ```typescript
  api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });
  ```
- [ ] Add JWT token to requests
- [ ] Add request ID for tracing (optional)
- [ ] Test token injection

### Response Interceptor
- [ ] Implement response interceptor
  ```typescript
  api.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response?.status === 401) {
        // Clear token and redirect to login
        localStorage.removeItem('token');
        window.location.href = '/login';
      }
      return Promise.reject(error);
    }
  );
  ```
- [ ] Handle 401 Unauthorized (redirect to login)
- [ ] Handle 403 Forbidden
- [ ] Handle 404 Not Found
- [ ] Handle 500 Server Error
- [ ] Handle network errors
- [ ] Test error handling

---

## API Service Layer

### Create API Service Functions (`src/services/api/`)

#### Auth Service (`authService.ts`)
- [ ] Implement `login(username, password)`
  - [ ] POST /api/auth/login
  - [ ] Return user + token
  - [ ] Store token in localStorage
- [ ] Implement `register(userData)`
  - [ ] POST /api/auth/register
  - [ ] Return user + token
- [ ] Implement `logout()`
  - [ ] Clear token from localStorage
  - [ ] Clear React Query cache
- [ ] Test all auth service functions

#### Transaction Service (`transactionService.ts`)
- [ ] Implement `getTransactions(filters)`
  - [ ] GET /api/transactions
  - [ ] Support query parameters (date, category, account, etc.)
- [ ] Implement `getTransaction(id)`
  - [ ] GET /api/transactions/:id
- [ ] Implement `createTransaction(data)`
  - [ ] POST /api/transactions
  - [ ] Include splits if present
- [ ] Implement `updateTransaction(id, data)`
  - [ ] PUT /api/transactions/:id
- [ ] Implement `deleteTransaction(id)`
  - [ ] DELETE /api/transactions/:id
- [ ] Test all transaction service functions

#### Account Service (`accountService.ts`)
- [ ] Implement `getAccounts()`
  - [ ] GET /api/accounts
- [ ] Implement `getAccount(id)`
  - [ ] GET /api/accounts/:id
- [ ] Implement `createAccount(data)`
  - [ ] POST /api/accounts
- [ ] Implement `updateAccount(id, data)`
  - [ ] PUT /api/accounts/:id
- [ ] Implement `deleteAccount(id)`
  - [ ] DELETE /api/accounts/:id
- [ ] Test all account service functions

#### Budget Service (`budgetService.ts`)
- [ ] Implement `getBudgets()`
  - [ ] GET /api/budgets
- [ ] Implement `getBudget(id)`
  - [ ] GET /api/budgets/:id
- [ ] Implement `createBudget(data)`
  - [ ] POST /api/budgets
- [ ] Implement `updateBudget(id, data)`
  - [ ] PUT /api/budgets/:id
- [ ] Implement `deleteBudget(id)`
  - [ ] DELETE /api/budgets/:id
- [ ] Implement `addBudgetRange(budgetId, rangeData)`
  - [ ] POST /api/budgets/:id/ranges
- [ ] Test all budget service functions

#### People Service (`peopleService.ts`)
- [ ] Implement `getPeople()`
  - [ ] GET /api/people
- [ ] Implement `getPerson(id)`
  - [ ] GET /api/people/:id
- [ ] Implement `createPerson(data)`
  - [ ] POST /api/people
- [ ] Implement `updatePerson(id, data)`
  - [ ] PUT /api/people/:id
- [ ] Implement `deletePerson(id)`
  - [ ] DELETE /api/people/:id
- [ ] Implement `getPersonDebts(id)`
  - [ ] GET /api/people/:id/debts
- [ ] Implement `settleDebt(id, data)`
  - [ ] POST /api/people/:id/settle
- [ ] Test all people service functions

#### Category Service (`categoryService.ts`)
- [ ] Implement `getCategories()`
  - [ ] GET /api/categories
- [ ] Implement `createCategory(data)`
  - [ ] POST /api/categories
- [ ] Implement `updateCategory(id, data)`
  - [ ] PUT /api/categories/:id
- [ ] Implement `deleteCategory(id)`
  - [ ] DELETE /api/categories/:id
- [ ] Test all category service functions

#### Dashboard Service (`dashboardService.ts`)
- [ ] Implement `getDashboardSummary()`
  - [ ] GET /api/dashboard
  - [ ] Return aggregated data
- [ ] Test dashboard service

---

## Authentication Integration

### Login Flow
- [ ] Test login with valid credentials
  - [ ] Verify token received
  - [ ] Verify token stored in localStorage
  - [ ] Verify user data stored in context
  - [ ] Verify redirect to dashboard
- [ ] Test login with invalid credentials
  - [ ] Verify error message displayed
  - [ ] Verify no token stored
  - [ ] Verify user stays on login page
- [ ] Test login with network error
  - [ ] Verify error handling
  - [ ] Verify user-friendly error message

### Registration Flow
- [ ] Test registration with valid data
  - [ ] Verify user created
  - [ ] Verify token received
  - [ ] Verify auto-login
  - [ ] Verify redirect to dashboard
- [ ] Test registration with existing username
  - [ ] Verify error message
  - [ ] Verify validation feedback
- [ ] Test registration with invalid data
  - [ ] Verify validation errors
  - [ ] Verify form stays open

### Logout Flow
- [ ] Test logout
  - [ ] Verify token cleared from localStorage
  - [ ] Verify user cleared from context
  - [ ] Verify React Query cache cleared
  - [ ] Verify redirect to login page

### Protected Routes
- [ ] Test accessing protected route without auth
  - [ ] Verify redirect to login
  - [ ] Verify intended destination preserved
- [ ] Test accessing protected route with auth
  - [ ] Verify access granted
  - [ ] Verify data loads correctly
- [ ] Test token expiration
  - [ ] Verify automatic logout on 401
  - [ ] Verify redirect to login

---

## Feature Integration Testing

### Account Management Integration
- [ ] Test creating account
  - [ ] Fill form with valid data
  - [ ] Submit form
  - [ ] Verify API call made
  - [ ] Verify account appears in list
  - [ ] Verify success message
  - [ ] Verify React Query cache updated
- [ ] Test updating account
  - [ ] Open edit form
  - [ ] Modify data
  - [ ] Submit form
  - [ ] Verify API call made
  - [ ] Verify account updated in list
  - [ ] Verify cache invalidated
- [ ] Test deleting account
  - [ ] Click delete button
  - [ ] Confirm deletion
  - [ ] Verify API call made
  - [ ] Verify account removed from list
  - [ ] Verify cache updated
- [ ] Test account balance calculation
  - [ ] Verify balance matches transactions
  - [ ] Test with multiple accounts
- [ ] Test error handling
  - [ ] Test with network error
  - [ ] Test with validation error
  - [ ] Test with server error

### Transaction Management Integration
- [ ] Test creating transaction
  - [ ] Fill form with valid data
  - [ ] Submit form
  - [ ] Verify API call made
  - [ ] Verify transaction appears in list
  - [ ] Verify account balance updated
  - [ ] Verify success message
- [ ] Test creating transaction with splits
  - [ ] Add split payments
  - [ ] Verify split validation
  - [ ] Submit form
  - [ ] Verify splits saved
  - [ ] Verify debt calculations updated
- [ ] Test updating transaction
  - [ ] Open edit form
  - [ ] Modify data
  - [ ] Submit form
  - [ ] Verify API call made
  - [ ] Verify transaction updated
  - [ ] Verify account balance recalculated
- [ ] Test deleting transaction
  - [ ] Click delete button
  - [ ] Confirm deletion
  - [ ] Verify API call made
  - [ ] Verify transaction removed
  - [ ] Verify account balance updated
- [ ] Test transaction filtering
  - [ ] Filter by date range
  - [ ] Filter by category
  - [ ] Filter by account
  - [ ] Filter by amount
  - [ ] Verify API calls with correct params
  - [ ] Verify filtered results
- [ ] Test transaction pagination
  - [ ] Load initial page
  - [ ] Load next page
  - [ ] Verify correct data loaded
- [ ] Test error handling
  - [ ] Test with invalid data
  - [ ] Test with network error
  - [ ] Test with server error

### Budget Management Integration
- [ ] Test creating budget
  - [ ] Fill form with valid data
  - [ ] Configure filters
  - [ ] Set limit and period
  - [ ] Submit form
  - [ ] Verify API call made
  - [ ] Verify budget appears in list
- [ ] Test budget status calculation
  - [ ] Create transactions matching budget
  - [ ] Verify spent amount calculated
  - [ ] Verify progress bar updated
  - [ ] Verify warning shown when over budget
- [ ] Test adding budget range
  - [ ] Add new range to existing budget
  - [ ] Verify API call made
  - [ ] Verify range appears
- [ ] Test updating budget
  - [ ] Modify budget settings
  - [ ] Submit form
  - [ ] Verify API call made
  - [ ] Verify budget updated
- [ ] Test deleting budget
  - [ ] Click delete button
  - [ ] Confirm deletion
  - [ ] Verify API call made
  - [ ] Verify budget removed
- [ ] Test budget filter matching
  - [ ] Create budget with category filter
  - [ ] Create matching transaction
  - [ ] Verify transaction counted in budget
  - [ ] Create non-matching transaction
  - [ ] Verify transaction not counted
- [ ] Test error handling
  - [ ] Test with invalid data
  - [ ] Test with network error

### People & Debt Management Integration
- [ ] Test creating person
  - [ ] Fill form with valid data
  - [ ] Submit form
  - [ ] Verify API call made
  - [ ] Verify person appears in list
- [ ] Test debt calculation
  - [ ] Create transaction with split
  - [ ] Verify debt calculated correctly
  - [ ] Verify debt shown in person card
- [ ] Test settling debt
  - [ ] Open settle debt modal
  - [ ] Enter settlement details
  - [ ] Submit form
  - [ ] Verify API call made
  - [ ] Verify debt updated
  - [ ] Verify settlement transaction created
- [ ] Test updating person
  - [ ] Modify person details
  - [ ] Submit form
  - [ ] Verify API call made
  - [ ] Verify person updated
- [ ] Test deleting person
  - [ ] Click delete button
  - [ ] Verify warning if debts exist
  - [ ] Confirm deletion
  - [ ] Verify API call made
  - [ ] Verify person removed
- [ ] Test error handling
  - [ ] Test with invalid data
  - [ ] Test with network error

### Dashboard Data Aggregation
- [ ] Test dashboard data loading
  - [ ] Navigate to dashboard
  - [ ] Verify API call made
  - [ ] Verify all widgets populated
  - [ ] Verify loading states shown
- [ ] Test net worth calculation
  - [ ] Verify assets summed correctly
  - [ ] Verify liabilities subtracted
  - [ ] Verify net worth displayed
- [ ] Test account summary
  - [ ] Verify all accounts shown
  - [ ] Verify balances correct
  - [ ] Verify total balance calculated
- [ ] Test budget progress
  - [ ] Verify budgets shown
  - [ ] Verify progress calculated
  - [ ] Verify warnings shown
- [ ] Test spending chart
  - [ ] Verify data loaded
  - [ ] Verify chart renders
  - [ ] Verify correct time period
- [ ] Test category breakdown
  - [ ] Verify categories shown
  - [ ] Verify percentages calculated
  - [ ] Verify chart renders
- [ ] Test recent transactions
  - [ ] Verify transactions loaded
  - [ ] Verify correct sort order
  - [ ] Verify link to full list works
- [ ] Test dashboard refresh
  - [ ] Create new transaction
  - [ ] Verify dashboard updates
  - [ ] Test cache invalidation

### Reports Generation
- [ ] Test monthly report
  - [ ] Select month
  - [ ] Generate report
  - [ ] Verify API call made
  - [ ] Verify data displayed
  - [ ] Verify charts render
- [ ] Test category report
  - [ ] Select date range
  - [ ] Generate report
  - [ ] Verify category breakdown
  - [ ] Verify trends shown
- [ ] Test budget report
  - [ ] Generate budget performance report
  - [ ] Verify all budgets included
  - [ ] Verify status calculated
- [ ] Test net worth report
  - [ ] Generate net worth trend
  - [ ] Verify historical data
  - [ ] Verify chart renders
- [ ] Test report export
  - [ ] Export as PDF (if implemented)
  - [ ] Export as CSV (if implemented)
  - [ ] Verify data integrity

---

## Error Handling Integration

### Network Errors
- [ ] Test with backend offline
  - [ ] Verify error message shown
  - [ ] Verify retry option available
  - [ ] Verify graceful degradation
- [ ] Test with slow network
  - [ ] Verify loading states shown
  - [ ] Verify timeout handling
  - [ ] Verify user feedback

### Validation Errors
- [ ] Test form validation
  - [ ] Submit invalid data
  - [ ] Verify client-side validation
  - [ ] Verify error messages shown
- [ ] Test server validation
  - [ ] Submit data that passes client validation but fails server
  - [ ] Verify server errors displayed
  - [ ] Verify form stays open

### Authorization Errors
- [ ] Test accessing unauthorized resource
  - [ ] Verify 403 error handled
  - [ ] Verify appropriate message shown
- [ ] Test with expired token
  - [ ] Verify 401 error handled
  - [ ] Verify redirect to login
  - [ ] Verify token cleared

### Server Errors
- [ ] Test with 500 error
  - [ ] Verify error message shown
  - [ ] Verify error boundary catches error
  - [ ] Verify user can recover

---

## Loading States Verification

### Page Loading
- [ ] Test dashboard loading
  - [ ] Verify skeleton loaders shown
  - [ ] Verify smooth transition to content
- [ ] Test transaction list loading
  - [ ] Verify loading indicator
  - [ ] Verify pagination loading
- [ ] Test account list loading
  - [ ] Verify skeleton cards
- [ ] Test budget list loading
  - [ ] Verify loading states

### Mutation Loading
- [ ] Test form submission loading
  - [ ] Verify button disabled during submit
  - [ ] Verify loading spinner shown
  - [ ] Verify form locked during submit
- [ ] Test delete operation loading
  - [ ] Verify loading state
  - [ ] Verify optimistic update (optional)

---

## Data Synchronization Testing

### Cache Invalidation
- [ ] Test transaction creation invalidates:
  - [ ] Transaction list cache
  - [ ] Account balance cache
  - [ ] Dashboard cache
  - [ ] Budget status cache
- [ ] Test account update invalidates:
  - [ ] Account list cache
  - [ ] Dashboard cache
- [ ] Test budget update invalidates:
  - [ ] Budget list cache
  - [ ] Dashboard cache
- [ ] Verify cache invalidation timing
- [ ] Test manual refresh

### Optimistic Updates (Optional)
- [ ] Test optimistic transaction creation
  - [ ] Verify immediate UI update
  - [ ] Verify rollback on error
- [ ] Test optimistic deletion
  - [ ] Verify immediate removal
  - [ ] Verify rollback on error

### Real-time Updates (Future)
- [ ] Plan for WebSocket integration (if needed)
- [ ] Plan for polling strategy (if needed)

---

## Cross-Feature Integration

### Transaction → Account Flow
- [ ] Create transaction
- [ ] Verify account balance updated
- [ ] Verify dashboard updated
- [ ] Delete transaction
- [ ] Verify account balance reverted

### Transaction → Budget Flow
- [ ] Create budget with category filter
- [ ] Create matching transaction
- [ ] Verify budget status updated
- [ ] Verify dashboard budget widget updated
- [ ] Delete transaction
- [ ] Verify budget status reverted

### Transaction → People Flow
- [ ] Create transaction with split
- [ ] Verify person debt updated
- [ ] Verify people page shows debt
- [ ] Settle debt
- [ ] Verify debt cleared
- [ ] Verify settlement transaction created

### Account → Dashboard Flow
- [ ] Create account
- [ ] Verify dashboard account summary updated
- [ ] Verify net worth updated
- [ ] Delete account
- [ ] Verify dashboard updated

---

## Performance Testing

### API Response Times
- [ ] Measure dashboard load time
  - [ ] Target: < 1 second
- [ ] Measure transaction list load time
  - [ ] Target: < 500ms
- [ ] Measure form submission time
  - [ ] Target: < 300ms
- [ ] Identify slow endpoints
- [ ] Optimize if needed

### Frontend Performance
- [ ] Measure initial page load
  - [ ] Target: < 2 seconds
- [ ] Measure time to interactive
  - [ ] Target: < 3 seconds
- [ ] Test with large datasets
  - [ ] 1000+ transactions
  - [ ] 50+ accounts
  - [ ] 20+ budgets
- [ ] Verify virtual scrolling (if implemented)
- [ ] Check bundle size
  - [ ] Target: < 500KB gzipped

---

## Browser Compatibility Testing

### Desktop Browsers
- [ ] Test on Chrome (latest)
- [ ] Test on Firefox (latest)
- [ ] Test on Safari (latest)
- [ ] Test on Edge (latest)
- [ ] Verify all features work
- [ ] Verify styling consistent

### Mobile Browsers
- [ ] Test on iOS Safari
- [ ] Test on Chrome Mobile
- [ ] Test on Firefox Mobile
- [ ] Verify touch interactions
- [ ] Verify responsive layouts

---

## Security Testing

### Authentication Security
- [ ] Verify JWT token stored securely
- [ ] Verify token not exposed in URLs
- [ ] Verify token cleared on logout
- [ ] Test token expiration handling
- [ ] Verify HTTPS in production

### Authorization Testing
- [ ] Verify users can only access own data
- [ ] Test accessing other user's resources
- [ ] Verify proper 403 responses
- [ ] Test API endpoint authorization

### Input Validation
- [ ] Test SQL injection attempts (should be blocked by backend)
- [ ] Test XSS attempts (should be sanitized)
- [ ] Test CSRF protection (if applicable)
- [ ] Verify input sanitization

---

## End-to-End User Flows

### New User Onboarding
- [ ] Register new account
- [ ] Login
- [ ] Create first account
- [ ] Create first category
- [ ] Create first transaction
- [ ] View dashboard
- [ ] Verify complete flow works

### Daily Usage Flow
- [ ] Login
- [ ] View dashboard
- [ ] Add transaction
- [ ] Check budget status
- [ ] View account balances
- [ ] Logout
- [ ] Verify smooth experience

### Monthly Review Flow
- [ ] Login
- [ ] Navigate to reports
- [ ] Generate monthly report
- [ ] Review spending
- [ ] Adjust budgets
- [ ] Verify workflow

---

## Documentation

### API Integration Documentation
- [ ] Document API endpoints used
- [ ] Document request/response formats
- [ ] Document error codes
- [ ] Document authentication flow

### Integration Issues Log
- [ ] Document any integration issues found
- [ ] Document workarounds applied
- [ ] Document known limitations

---

## Completion Checklist

- [ ] All API services implemented and tested
- [ ] Authentication flow fully integrated
- [ ] All CRUD operations working end-to-end
- [ ] Error handling comprehensive
- [ ] Loading states implemented everywhere
- [ ] Data synchronization working correctly
- [ ] Cache invalidation working properly
- [ ] Cross-feature integration verified
- [ ] Performance acceptable
- [ ] Browser compatibility verified
- [ ] Security testing passed
- [ ] End-to-end user flows tested

**Estimated Time:** 3-5 days

**Next Steps:** Proceed to [`05-deployment-checklist.md`](05-deployment-checklist.md)