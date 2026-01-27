# React Development Rules

## Component Design Principles

### 1. Keep Components Simple and Focused

- **Break down large components**: A component should do one thing well. If a component is becoming too large or complex, split it into smaller, more focused components.
- **Single Responsibility**: Each component should have a single, well-defined purpose.
- **Composition over Complexity**: Use component composition to build complex UIs from simple building blocks.

**Example:**

```tsx
// ❌ Bad: One large component doing everything
function UserDashboard() {
  // 200+ lines of code handling profile, stats, settings, etc.
}

// ✅ Good: Broken into focused components
function UserDashboard() {
  return (
    <>
      <UserProfile />
      <UserStats />
      <UserSettings />
    </>
  );
}
```

### 2. Extract Logic to Hooks and Utils

- **Never write business logic directly in components**: Components should focus on rendering UI and handling user interactions.
- **State-dependent logic → Custom Hooks**: If logic depends on React state or lifecycle, extract it to a custom hook.
- **Pure logic → Utils**: If logic is stateless and doesn't depend on React features, extract it to utility functions.

**Example:**

```tsx
// ❌ Bad: Logic in component
function TransactionList() {
  const [transactions, setTransactions] = useState([]);

  // Complex filtering logic in component
  const filtered = transactions.filter((t) => {
    // 20+ lines of filtering logic
  });

  return <div>{/* render */}</div>;
}

// ✅ Good: Logic in hooks/utils
function TransactionList() {
  const { transactions, filteredTransactions } = useTransactionFilters();
  return <div>{/* render */}</div>;
}

// In hooks/useTransactionFilters.ts
export function useTransactionFilters() {
  const [transactions, setTransactions] = useState([]);
  const filteredTransactions = useMemo(
    () => filterTransactions(transactions),
    [transactions],
  );
  return { transactions, filteredTransactions };
}

// In utils/transactionUtils.ts
export function filterTransactions(transactions: Transaction[]) {
  // Pure filtering logic
}
```

### 3. Limit useState Usage

- **Maximum 1-2 useState per component**: If you need more than 2 state variables, your component is likely doing too much.
- **Consider alternatives**:
  - `useReducer` for complex related state
  - Extract to a custom hook
  - Split into multiple components
  - Use Context API for shared state

**Example:**

```tsx
// ❌ Bad: Too many useState hooks
function AccountForm() {
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [balance, setBalance] = useState(0);
  const [currency, setCurrency] = useState("USD");
  const [isActive, setIsActive] = useState(true);
  // This component is doing too much!
}

// ✅ Good: Use useReducer or extract to hook
function AccountForm() {
  const { formData, updateField } = useAccountForm();
  // Single hook managing all form state
}
```

### 4. Limit Component Props

- **Maximum 3-4 props per component**: More props indicate the component is too complex or tightly coupled.
- **Use Context API for shared data**: Don't drill props through multiple levels.
- **Group related props**: Use objects to group related properties.

**Example:**

```tsx
// ❌ Bad: Too many props
function UserCard({ name, email, avatar, role, department, location, phone }) {
  // Too many props!
}

// ✅ Good: Grouped props or Context
function UserCard({ user, onEdit }) {
  // user object contains all user data
}

// Or use Context for widely-shared data
function UserCard() {
  const { user } = useUserContext();
  return <div>{/* render */}</div>;
}
```

## React Query Best Practices

### 5. Leverage useQuery and Caching

- **Use useQuery everywhere needed**: Don't be shy about using the same query in multiple components.
- **Trust the cache**: React Query handles caching automatically - actual API calls won't be duplicated.
- **Create unique, descriptive query keys**: Keys should clearly identify what data is being fetched.
- **Colocate queries with components**: Each component can independently fetch the data it needs.

**Example:**

```tsx
// ✅ Good: Use useQuery in multiple components
function AccountList() {
  const { data: accounts } = useQuery({
    queryKey: ["accounts"],
    queryFn: fetchAccounts,
  });
  return <div>{/* render accounts */}</div>;
}

function AccountSummary() {
  // Same query - uses cache, no duplicate API call!
  const { data: accounts } = useQuery({
    queryKey: ["accounts"],
    queryFn: fetchAccounts,
  });
  return <div>{/* render summary */}</div>;
}

// ✅ Good: Specific query keys for filtered data
function TransactionList({ accountId, startDate, endDate }) {
  const { data: transactions } = useQuery({
    queryKey: ["transactions", accountId, startDate, endDate],
    queryFn: () => fetchTransactions({ accountId, startDate, endDate }),
  });
  return <div>{/* render */}</div>;
}
```

### 6. Query Key Patterns

- **Use arrays for query keys**: Enables partial matching and invalidation.
- **Order matters**: Most general to most specific.
- **Include all dependencies**: Any variable that affects the query should be in the key.

**Example:**

```tsx
// ✅ Good query key patterns
["accounts"][("accounts", accountId)]["transactions"][ // All accounts // Specific account // All transactions
  ("transactions", { accountId })
][("transactions", { accountId, month: "2024-01" })]; // Filtered transactions // More specific filter

// Invalidation becomes easy
queryClient.invalidateQueries({ queryKey: ["accounts"] }); // Invalidates all account queries
queryClient.invalidateQueries({ queryKey: ["transactions", { accountId }] }); // Specific transactions
```

## Additional Best Practices

### 7. Component Organization

```tsx
// ✅ Recommended component structure
function MyComponent({ prop1, prop2 }) {
  // 1. Hooks (in consistent order)
  const context = useContext(MyContext);
  const query = useQuery(...);
  const [state, setState] = useState();
  const customHook = useCustomHook();

  // 2. Derived values and memoization
  const derivedValue = useMemo(() => compute(state), [state]);

  // 3. Event handlers
  const handleClick = useCallback(() => {
    // handler logic
  }, [dependencies]);

  // 4. Effects (if absolutely necessary)
  useEffect(() => {
    // effect logic
  }, [dependencies]);

  // 5. Early returns for loading/error states
  if (query.isLoading) return <LoadingSpinner />;
  if (query.isError) return <ErrorAlert />;

  // 6. Render
  return <div>{/* JSX */}</div>;
}
```

### 8. Avoid Prop Drilling

```tsx
// ❌ Bad: Prop drilling
function App() {
  const [user, setUser] = useState();
  return <Layout user={user} />;
}

function Layout({ user }) {
  return <Sidebar user={user} />;
}

function Sidebar({ user }) {
  return <UserMenu user={user} />;
}

// ✅ Good: Use Context
const UserContext = createContext();

function App() {
  const [user, setUser] = useState();
  return (
    <UserContext.Provider value={user}>
      <Layout />
    </UserContext.Provider>
  );
}

function UserMenu() {
  const user = useContext(UserContext);
  return <div>{user.name}</div>;
}
```

### 9. Performance Optimization

- **Use `useMemo` for expensive computations**: Only when profiling shows it's needed.
- **Use `useCallback` for callbacks passed to optimized child components**: Prevents unnecessary re-renders.
- **Use `React.memo` sparingly**: Only for components that re-render frequently with the same props.

### 10. TypeScript Integration

- **Always type props**: Use interfaces or types for component props.
- **Type custom hooks**: Return types should be explicit.
- **Avoid `any`**: Use proper types or `unknown` if type is truly unknown.

```tsx
// ✅ Good: Properly typed component
interface UserCardProps {
  userId: string;
  onEdit?: (userId: string) => void;
}

function UserCard({ userId, onEdit }: UserCardProps) {
  const { data: user } = useQuery({
    queryKey: ["users", userId],
    queryFn: () => fetchUser(userId),
  });

  return <div>{/* render */}</div>;
}
```

## Summary Checklist

Before committing a component, ask yourself:

- [ ] Is this component doing one thing well?
- [ ] Does it have 1-2 useState hooks maximum?
- [ ] Is all logic extracted to hooks or utils?
- [ ] Does it have 3-4 props maximum?
- [ ] Am I using Context API for shared state instead of prop drilling?
- [ ] Am I leveraging React Query's caching effectively?
- [ ] Are my query keys unique and descriptive?
- [ ] Is the component properly typed with TypeScript?
- [ ] Can this component be broken down further?

---

_These rules are designed to keep our React codebase maintainable, testable, and performant. When in doubt, favor simplicity and composition._
