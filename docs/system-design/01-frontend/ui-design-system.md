# UI Design System

## Overview

This document defines the comprehensive UI design system for Master of Coin using Chakra UI as the foundation. The design emphasizes clarity, accessibility, and icon-driven interfaces.

## Design Principles

### 1. Icon-First Design
- **Use icons wherever possible instead of text labels**
- Icons should be intuitive and universally recognizable
- Always include tooltips for icon-only buttons
- Combine icons with text only when necessary for clarity

### 2. Clean & Minimal
- Generous white space
- Clear visual hierarchy
- Minimal borders and decorations
- Focus on content, not chrome

### 3. Accessible by Default
- WCAG 2.1 AA compliance
- Keyboard navigation support
- Screen reader friendly
- High contrast ratios

### 4. Responsive & Mobile-First
- Mobile-optimized layouts
- Touch-friendly targets (min 44x44px)
- Adaptive components
- Progressive enhancement

## Chakra UI Configuration

### Theme Setup

```typescript
// theme.ts
import { extendTheme, type ThemeConfig } from '@chakra-ui/react';

const config: ThemeConfig = {
  initialColorMode: 'light',
  useSystemColorMode: true, // Respect system preference
};

const theme = extendTheme({
  config,
  colors: {
    brand: {
      50: '#e3f2fd',
      100: '#bbdefb',
      200: '#90caf9',
      300: '#64b5f6',
      400: '#42a5f5',
      500: '#2196f3', // Primary brand color
      600: '#1e88e5',
      700: '#1976d2',
      800: '#1565c0',
      900: '#0d47a1',
    },
    success: {
      50: '#e8f5e9',
      500: '#4caf50',
      600: '#43a047',
    },
    warning: {
      50: '#fff3e0',
      500: '#ff9800',
      600: '#fb8c00',
    },
    error: {
      50: '#ffebee',
      500: '#f44336',
      600: '#e53935',
    },
    income: {
      50: '#e8f5e9',
      500: '#4caf50',
      600: '#43a047',
    },
    expense: {
      50: '#ffebee',
      500: '#f44336',
      600: '#e53935',
    },
  },
  fonts: {
    heading: `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`,
    body: `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`,
    mono: `'JetBrains Mono', 'Fira Code', monospace`,
  },
  fontSizes: {
    xs: '0.75rem',   // 12px
    sm: '0.875rem',  // 14px
    md: '1rem',      // 16px
    lg: '1.125rem',  // 18px
    xl: '1.25rem',   // 20px
    '2xl': '1.5rem', // 24px
    '3xl': '1.875rem', // 30px
    '4xl': '2.25rem',  // 36px
    '5xl': '3rem',     // 48px
  },
  space: {
    px: '1px',
    0.5: '0.125rem', // 2px
    1: '0.25rem',    // 4px
    2: '0.5rem',     // 8px
    3: '0.75rem',    // 12px
    4: '1rem',       // 16px
    5: '1.25rem',    // 20px
    6: '1.5rem',     // 24px
    8: '2rem',       // 32px
    10: '2.5rem',    // 40px
    12: '3rem',      // 48px
    16: '4rem',      // 64px
  },
  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    base: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  },
  radii: {
    none: '0',
    sm: '0.25rem',   // 4px
    base: '0.5rem',  // 8px
    md: '0.75rem',   // 12px
    lg: '1rem',      // 16px
    xl: '1.5rem',    // 24px
    full: '9999px',
  },
  components: {
    Button: {
      defaultProps: {
        colorScheme: 'brand',
      },
      variants: {
        solid: {
          borderRadius: 'md',
          fontWeight: 'medium',
        },
        ghost: {
          borderRadius: 'md',
        },
      },
    },
    Card: {
      baseStyle: {
        container: {
          borderRadius: 'lg',
          boxShadow: 'sm',
          bg: 'white',
          _dark: {
            bg: 'gray.800',
          },
        },
      },
    },
    Input: {
      defaultProps: {
        focusBorderColor: 'brand.500',
      },
      variants: {
        outline: {
          field: {
            borderRadius: 'md',
          },
        },
      },
    },
  },
});

export default theme;
```

## Icon System

### Icon Library: Chakra UI Icons + React Icons

```typescript
// Install packages
// npm install @chakra-ui/icons react-icons
```

### Icon Categories & Usage

#### 1. Navigation Icons

```typescript
import { 
  ViewIcon,           // Dashboard
  RepeatIcon,         // Transactions
  InfoIcon,           // Accounts
  CalendarIcon,       // Budgets
  AtSignIcon,         // People
  DownloadIcon,       // Reports
} from '@chakra-ui/icons';

import {
  MdDashboard,        // Dashboard (alternative)
  MdAccountBalance,   // Accounts
  MdPeople,           // People
  MdAssessment,       // Reports
} from 'react-icons/md';
```

#### 2. Financial Icons

```typescript
import {
  FiTrendingUp,       // Income/Growth
  FiTrendingDown,     // Expense/Loss
  FiDollarSign,       // Money/Currency
  FiCreditCard,       // Credit Card
  FiPieChart,         // Budget/Category
} from 'react-icons/fi';

import {
  MdAccountBalanceWallet,  // Wallet
  MdSavings,               // Savings
  MdTrendingUp,            // Growth
  MdAttachMoney,           // Money
} from 'react-icons/md';
```

#### 3. Category Icons

```typescript
import {
  MdFastfood,         // Food & Dining
  MdLocalGroceryStore, // Groceries
  MdDirectionsCar,    // Transport
  MdShoppingCart,     // Shopping
  MdHome,             // Housing/Bills
  MdLocalHospital,    // Healthcare
  MdSchool,           // Education
  MdTheaters,         // Entertainment
  MdFlight,           // Travel
  MdFitnessCenter,    // Fitness
  MdPets,             // Pets
  MdCardGiftcard,     // Gifts
  MdBuild,            // Utilities
  MdMoreHoriz,        // Other
} from 'react-icons/md';
```

#### 4. Action Icons

```typescript
import { 
  AddIcon,            // Add/Create
  EditIcon,           // Edit
  DeleteIcon,         // Delete
  SearchIcon,         // Search
  SettingsIcon,       // Settings
  CheckIcon,          // Confirm/Success
  CloseIcon,          // Close/Cancel
  ChevronRightIcon,   // Navigate forward
  ChevronLeftIcon,    // Navigate back
  DownloadIcon,       // Download/Export
  UploadIcon,         // Upload/Import
} from '@chakra-ui/icons';

import {
  FiFilter,           // Filter
  FiRefreshCw,        // Refresh
  FiShare2,           // Share
  FiMoreVertical,     // More options (vertical)
  FiMoreHorizontal,   // More options (horizontal)
} from 'react-icons/fi';
```

#### 5. Status Icons

```typescript
import { 
  CheckCircleIcon,    // Success
  WarningIcon,        // Warning
  InfoIcon,           // Info
  QuestionIcon,       // Help
} from '@chakra-ui/icons';

import {
  MdError,            // Error
  MdCheckCircle,      // Success (alternative)
  MdWarning,          // Warning (alternative)
} from 'react-icons/md';
```

### Icon Usage Guidelines

```typescript
// Icon Button (icon only)
<IconButton
  aria-label="Add transaction"
  icon={<AddIcon />}
  colorScheme="brand"
  size="md"
/>

// Icon with Tooltip
<Tooltip label="Add transaction" placement="top">
  <IconButton
    aria-label="Add transaction"
    icon={<AddIcon />}
    colorScheme="brand"
  />
</Tooltip>

// Icon with Text (when needed for clarity)
<Button leftIcon={<AddIcon />} colorScheme="brand">
  Add Transaction
</Button>

// Icon in Text
<HStack>
  <Icon as={MdFastfood} color="orange.500" />
  <Text>Food & Dining</Text>
</HStack>

// Sized Icons
<Icon as={MdDashboard} boxSize={6} /> // 24px
<Icon as={MdDashboard} boxSize={8} /> // 32px
<Icon as={MdDashboard} boxSize={10} /> // 40px
```

## Component Patterns

### 1. Cards

```typescript
// Basic Card
<Card>
  <CardHeader>
    <Heading size="md">Card Title</Heading>
  </CardHeader>
  <CardBody>
    <Text>Card content</Text>
  </CardBody>
</Card>

// Card with Icon Header
<Card>
  <CardHeader>
    <HStack>
      <Icon as={MdAccountBalance} boxSize={5} color="brand.500" />
      <Heading size="md">Checking Account</Heading>
    </HStack>
  </CardHeader>
  <CardBody>
    <Stat>
      <StatNumber>$12,450.50</StatNumber>
      <StatHelpText>Available Balance</StatHelpText>
    </Stat>
  </CardBody>
</Card>

// Horizontal Scrollable Cards
<HStack spacing={4} overflowX="auto" pb={2}>
  <Card minW="200px">
    <CardBody>
      <VStack align="start">
        <HStack>
          <Icon as={MdAccountBalance} />
          <Text fontWeight="medium">Checking</Text>
        </HStack>
        <Text fontSize="2xl" fontWeight="bold">$12,450.50</Text>
      </VStack>
    </CardBody>
  </Card>
  {/* More cards... */}
</HStack>
```

### 2. Stats Display

```typescript
// Single Stat
<Stat>
  <StatLabel>Net Worth</StatLabel>
  <StatNumber>$125,450.00</StatNumber>
  <StatHelpText>
    <StatArrow type="increase" />
    2.5% ($3,000)
  </StatHelpText>
</Stat>

// Stat with Icon
<Stat>
  <HStack justify="space-between">
    <StatLabel>Total Balance</StatLabel>
    <Icon as={MdAccountBalanceWallet} color="brand.500" />
  </HStack>
  <StatNumber>$45,230.00</StatNumber>
  <StatHelpText>Across 4 accounts</StatHelpText>
</Stat>

// Stat Group
<StatGroup>
  <Stat>
    <StatLabel>Income</StatLabel>
    <StatNumber color="green.500">+$5,500</StatNumber>
  </Stat>
  <Stat>
    <StatLabel>Expenses</StatLabel>
    <StatNumber color="red.500">-$3,250</StatNumber>
  </Stat>
  <Stat>
    <StatLabel>Net</StatLabel>
    <StatNumber>$2,250</StatNumber>
  </Stat>
</StatGroup>
```

### 3. Lists & Tables

```typescript
// Transaction List Item
<Box py={3} borderBottomWidth="1px">
  <HStack justify="space-between" align="start">
    <HStack spacing={3}>
      <Icon as={MdFastfood} boxSize={6} color="orange.500" />
      <VStack align="start" spacing={0}>
        <Text fontWeight="medium">Grocery Store</Text>
        <Text fontSize="sm" color="gray.500">
          Food & Dining • Checking
        </Text>
      </VStack>
    </HStack>
    <VStack align="end" spacing={0}>
      <Text fontWeight="bold" color="red.500">-$85.50</Text>
      <Icon as={MdCreditCard} boxSize={4} color="gray.400" />
    </VStack>
  </HStack>
</Box>

// Table with TanStack Table
<Table variant="simple">
  <Thead>
    <Tr>
      <Th>
        <HStack>
          <Icon as={MdCalendarToday} boxSize={4} />
          <Text>Date</Text>
        </HStack>
      </Th>
      <Th>Transaction</Th>
      <Th isNumeric>Amount</Th>
    </Tr>
  </Thead>
  <Tbody>
    {/* Table rows */}
  </Tbody>
</Table>
```

### 4. Forms

```typescript
// Form with Icons
<FormControl>
  <FormLabel>
    <HStack>
      <Icon as={MdTitle} boxSize={4} />
      <Text>Title</Text>
    </HStack>
  </FormLabel>
  <Input placeholder="Enter transaction title" />
  <FormHelperText>Brief description of the transaction</FormHelperText>
</FormControl>

// Number Input with Currency
<FormControl>
  <FormLabel>
    <HStack>
      <Icon as={MdAttachMoney} boxSize={4} />
      <Text>Amount</Text>
    </HStack>
  </FormLabel>
  <NumberInput>
    <NumberInputField placeholder="0.00" />
  </NumberInput>
</FormControl>

// Select with Icon
<FormControl>
  <FormLabel>
    <HStack>
      <Icon as={MdCategory} boxSize={4} />
      <Text>Category</Text>
    </HStack>
  </FormLabel>
  <Select placeholder="Select category">
    <option value="food">🍔 Food & Dining</option>
    <option value="transport">🚗 Transport</option>
    <option value="shopping">🛍️ Shopping</option>
  </Select>
</FormControl>
```

### 5. Navigation

```typescript
// Sidebar Navigation
<VStack align="stretch" spacing={1}>
  <Button
    leftIcon={<Icon as={MdDashboard} />}
    variant="ghost"
    justifyContent="flex-start"
  >
    Dashboard
  </Button>
  <Button
    leftIcon={<Icon as={MdSwapHoriz} />}
    variant="ghost"
    justifyContent="flex-start"
  >
    Transactions
  </Button>
  <Button
    leftIcon={<Icon as={MdAccountBalance} />}
    variant="ghost"
    justifyContent="flex-start"
  >
    Accounts
  </Button>
</VStack>

// Tab Navigation (Month Selector)
<Tabs variant="soft-rounded" colorScheme="brand">
  <TabList overflowX="auto" overflowY="hidden">
    <Tab>Jan</Tab>
    <Tab>Feb</Tab>
    <Tab>Mar</Tab>
    <Tab>Apr</Tab>
    <Tab>May</Tab>
    <Tab>Jun</Tab>
    {/* More tabs... */}
  </TabList>
</Tabs>

// Breadcrumbs with Icons
<Breadcrumb>
  <BreadcrumbItem>
    <BreadcrumbLink href="/">
      <Icon as={MdHome} />
    </BreadcrumbLink>
  </BreadcrumbItem>
  <BreadcrumbItem>
    <BreadcrumbLink href="/transactions">Transactions</BreadcrumbLink>
  </BreadcrumbItem>
  <BreadcrumbItem isCurrentPage>
    <BreadcrumbLink>Details</BreadcrumbLink>
  </BreadcrumbItem>
</Breadcrumb>
```

### 6. Modals & Drawers

```typescript
// Modal with Icon Header
<Modal isOpen={isOpen} onClose={onClose}>
  <ModalOverlay />
  <ModalContent>
    <ModalHeader>
      <HStack>
        <Icon as={AddIcon} color="brand.500" />
        <Text>Add Transaction</Text>
      </HStack>
    </ModalHeader>
    <ModalCloseButton />
    <ModalBody>
      {/* Form content */}
    </ModalBody>
    <ModalFooter>
      <Button variant="ghost" mr={3} onClick={onClose}>
        Cancel
      </Button>
      <Button colorScheme="brand">Save</Button>
    </ModalFooter>
  </ModalContent>
</Modal>

// Drawer for Mobile Menu
<Drawer isOpen={isOpen} placement="left" onClose={onClose}>
  <DrawerOverlay />
  <DrawerContent>
    <DrawerCloseButton />
    <DrawerHeader>
      <HStack>
        <Icon as={MdMenu} />
        <Text>Menu</Text>
      </HStack>
    </DrawerHeader>
    <DrawerBody>
      {/* Navigation items */}
    </DrawerBody>
  </DrawerContent>
</Drawer>
```

### 7. Floating Action Button

```typescript
// FAB for Add Transaction
<IconButton
  aria-label="Add transaction"
  icon={<AddIcon />}
  colorScheme="brand"
  size="lg"
  isRound
  position="fixed"
  bottom={4}
  right={4}
  boxShadow="lg"
  _hover={{ transform: 'scale(1.1)' }}
  transition="transform 0.2s"
/>
```

## Color Usage

### Semantic Colors

```typescript
// Income/Positive
<Text color="green.500">+$3,500</Text>
<Badge colorScheme="green">Income</Badge>

// Expense/Negative
<Text color="red.500">-$85.50</Text>
<Badge colorScheme="red">Expense</Badge>

// Neutral
<Text color="gray.600">$0.00</Text>
<Badge colorScheme="gray">Pending</Badge>

// Warning (Budget exceeded)
<Text color="orange.500">130% of budget</Text>
<Badge colorScheme="orange">Over Budget</Badge>

// Info
<Badge colorScheme="blue">Split Payment</Badge>
```

### Category Colors

```typescript
const categoryColors = {
  food: 'orange.500',
  transport: 'blue.500',
  shopping: 'purple.500',
  bills: 'gray.600',
  entertainment: 'pink.500',
  healthcare: 'red.500',
  education: 'teal.500',
  income: 'green.500',
  other: 'gray.400',
};
```

## Typography

### Heading Hierarchy

```typescript
// Page Title
<Heading as="h1" size="2xl" mb={4}>Dashboard</Heading>

// Section Title
<Heading as="h2" size="xl" mb={3}>Recent Transactions</Heading>

// Card Title
<Heading as="h3" size="md" mb={2}>Net Worth</Heading>

// Subsection
<Heading as="h4" size="sm" mb={1}>Monthly Summary</Heading>
```

### Text Styles

```typescript
// Body Text
<Text fontSize="md">Regular body text</Text>

// Small Text / Helper Text
<Text fontSize="sm" color="gray.500">Helper text</Text>

// Large Numbers (Stats)
<Text fontSize="3xl" fontWeight="bold">$125,450.00</Text>

// Labels
<Text fontSize="sm" fontWeight="medium" color="gray.700">
  Account Name
</Text>
```

## Spacing System

### Component Spacing

```typescript
// Vertical Stack (default spacing)
<VStack spacing={4}>  // 16px between items
  <Component1 />
  <Component2 />
</VStack>

// Horizontal Stack
<HStack spacing={3}>  // 12px between items
  <Icon />
  <Text />
</HStack>

// Grid Layout
<Grid templateColumns="repeat(12, 1fr)" gap={4}>
  <GridItem colSpan={6}>...</GridItem>
  <GridItem colSpan={6}>...</GridItem>
</Grid>

// Container Padding
<Box p={4}>  // 16px padding all sides
<Box px={6} py={4}>  // 24px horizontal, 16px vertical
```

## Responsive Design

### Breakpoints

```typescript
// Chakra UI default breakpoints
const breakpoints = {
  base: '0px',    // Mobile
  sm: '480px',    // Small mobile
  md: '768px',    // Tablet
  lg: '992px',    // Desktop
  xl: '1280px',   // Large desktop
  '2xl': '1536px' // Extra large
};

// Usage
<Box
  display={{ base: 'block', md: 'flex' }}
  fontSize={{ base: 'sm', md: 'md', lg: 'lg' }}
  p={{ base: 2, md: 4, lg: 6 }}
>
  Content
</Box>
```

### Mobile Adaptations

```typescript
// Hide on mobile
<Box display={{ base: 'none', md: 'block' }}>
  Desktop only content
</Box>

// Show only on mobile
<Box display={{ base: 'block', md: 'none' }}>
  Mobile only content
</Box>

// Responsive Grid
<Grid
  templateColumns={{ 
    base: 'repeat(1, 1fr)',  // 1 column on mobile
    md: 'repeat(2, 1fr)',    // 2 columns on tablet
    lg: 'repeat(3, 1fr)'     // 3 columns on desktop
  }}
  gap={4}
>
  {/* Grid items */}
</Grid>
```

## Accessibility

### ARIA Labels

```typescript
// Icon buttons MUST have aria-label
<IconButton
  aria-label="Delete transaction"
  icon={<DeleteIcon />}
/>

// Links with icons
<Link aria-label="Go to dashboard">
  <Icon as={MdDashboard} />
</Link>
```

### Keyboard Navigation

```typescript
// Focusable elements
<Button
  _focus={{
    boxShadow: 'outline',
    borderColor: 'brand.500',
  }}
>
  Click me
</Button>

// Skip to content link
<Link
  href="#main-content"
  position="absolute"
  left="-9999px"
  _focus={{
    left: '0',
    top: '0',
    zIndex: 9999,
  }}
>
  Skip to content
</Link>
```

### Screen Reader Support

```typescript
// Visually hidden but available to screen readers
<VisuallyHidden>
  <Heading>Transaction Details</Heading>
</VisuallyHidden>

// Descriptive text for icons
<Icon as={MdFastfood} aria-label="Food category" />
```

## Dark Mode Support

```typescript
// Color mode aware components
<Box
  bg={{ base: 'white', _dark: 'gray.800' }}
  color={{ base: 'gray.800', _dark: 'white' }}
>
  Content
</Box>

// Using useColorModeValue hook
const bg = useColorModeValue('white', 'gray.800');
const color = useColorModeValue('gray.800', 'white');

<Box bg={bg} color={color}>
  Content
</Box>

// Color mode toggle
<IconButton
  aria-label="Toggle color mode"
  icon={colorMode === 'light' ? <MoonIcon /> : <SunIcon />}
  onClick={toggleColorMode}
/>
```

## Animation & Transitions

```typescript
// Hover effects
<Button
  _hover={{
    transform: 'translateY(-2px)',
    boxShadow: 'lg',
  }}
  transition="all 0.2s"
>
  Hover me
</Button>

// Loading states
<Spinner
  thickness="4px"
  speed="0.65s"
  color="brand.500"
  size="xl"
/>

// Skeleton loading
<Skeleton height="20px" />
<SkeletonCircle size="10" />
<SkeletonText mt="4" noOfLines={4} spacing="4" />
```

## Summary

This design system provides:
- ✅ Icon-first approach for cleaner UI
- ✅ Consistent Chakra UI patterns
- ✅ Comprehensive component library
- ✅ Responsive design guidelines
- ✅ Accessibility best practices
- ✅ Dark mode support
- ✅ Clear color semantics
- ✅ Typography hierarchy
- ✅ Spacing consistency
