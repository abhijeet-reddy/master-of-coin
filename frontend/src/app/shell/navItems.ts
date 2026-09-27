import {
  ArrowLeftRight,
  ChartColumn,
  Clock,
  Cpu,
  Gauge,
  LayoutGrid,
  Settings,
  Tag,
  Trash2,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  /** Label on the phone bottom bar, when it differs. */
  short?: string;
  icon: LucideIcon;
}

/** The 11 primary destinations, in sidebar order. A rule is drawn after the fourth. */
export const NAV_ITEMS: readonly NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', short: 'Dash', icon: LayoutGrid },
  { to: '/transactions', label: 'Transactions', short: 'Txns', icon: ArrowLeftRight },
  { to: '/accounts', label: 'Accounts', icon: Wallet },
  { to: '/budgets', label: 'Budgets', icon: Gauge },
  { to: '/categories', label: 'Categories', icon: Tag },
  { to: '/people', label: 'People', icon: Users },
  { to: '/reports', label: 'Reports', icon: ChartColumn },
  { to: '/jobs', label: 'Jobs', icon: Cpu },
  { to: '/schedules', label: 'Schedules', icon: Clock },
  { to: '/trash', label: 'Trash', icon: Trash2 },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export const NAV_DIVIDER_AFTER = 3;
/** The first four live on the phone bottom bar; the rest are in "More". */
export const BOTTOM_BAR_COUNT = 4;
