// Shared sample data for all v2 mocks. Every direction renders THIS data so
// the three directions are comparable like-for-like. Shapes mirror
// frontend/src/types/models.ts. Primary currency EUR, locale en-US.
window.MOC = (() => {
  const user = { name: 'Abhijeet Reddy', email: 'abhijeet@example.com', version: '0.24.0' };

  const categories = [
    { id: 'c-groc', name: 'Groceries', icon: 'cart', color: '#3FA672' },
    { id: 'c-dine', name: 'Eating Out', icon: 'fork', color: '#E07A3F' },
    { id: 'c-rent', name: 'Rent', icon: 'home', color: '#5B6CE0' },
    { id: 'c-util', name: 'Utilities', icon: 'bolt', color: '#C9A227' },
    { id: 'c-tran', name: 'Transport', icon: 'train', color: '#2F9BBF' },
    { id: 'c-shop', name: 'Shopping', icon: 'bag', color: '#C2549B' },
    { id: 'c-ent', name: 'Entertainment', icon: 'film', color: '#8A5BD6' },
    { id: 'c-hlth', name: 'Health', icon: 'heart', color: '#D2504F' },
    { id: 'c-trav', name: 'Travel', icon: 'plane', color: '#1F9E8F' },
    { id: 'c-sal', name: 'Salary', icon: 'briefcase', color: '#4C9A2A' },
    { id: 'c-subs', name: 'Subscriptions', icon: 'repeat', color: '#6A7A8C' },
  ];

  // account_type: CHECKING SAVINGS CREDIT_CARD INVESTMENT CASH DEBT GIFT_CARD
  // (LOAN is rejected by the backend today, do not show it)
  const accounts = [
    { id: 'a-main', name: 'Revolut Main', account_type: 'CHECKING', currency: 'EUR', balance: 4382.17, provider: 'TrueLayer', synced: '12 min ago' },
    { id: 'a-joint', name: 'N26 Joint', account_type: 'CHECKING', currency: 'EUR', balance: 1204.5, provider: 'TrueLayer', synced: '1 h ago' },
    { id: 'a-save', name: 'Emergency Fund', account_type: 'SAVINGS', currency: 'EUR', balance: 15000.0 },
    { id: 'a-uk', name: 'Monzo UK', account_type: 'CHECKING', currency: 'GBP', balance: 812.4 },
    { id: 'a-in', name: 'HDFC Savings', account_type: 'SAVINGS', currency: 'INR', balance: 245300.0 },
    { id: 'a-cc', name: 'Amex Gold', account_type: 'CREDIT_CARD', currency: 'EUR', balance: -1286.93 },
    { id: 'a-t212', name: 'Trading 212 ISA', account_type: 'INVESTMENT', currency: 'EUR', balance: 28471.62, provider: 'Trading 212', synced: '3 h ago', dayChange: 1.84 },
    { id: 'a-cash', name: 'Wallet', account_type: 'CASH', currency: 'EUR', balance: 85.0 },
    { id: 'a-gift', name: 'Amazon Gift Card', account_type: 'GIFT_CARD', currency: 'EUR', balance: 42.0 },
    { id: 'a-debt', name: 'Car finance', account_type: 'DEBT', currency: 'EUR', balance: -6420.0 },
  ];
  const fx = { EUR: 1, GBP: 1.17, INR: 0.0107, USD: 0.92 };
  const toEur = (a) => a.balance * (fx[a.currency] || 1);
  const netWorth = accounts.reduce((s, a) => s + toEur(a), 0);

  const people = [
    { id: 'p-ana', name: 'Ana', owes_me: 64.2, i_owe: 0 },
    { id: 'p-tom', name: 'Tom', owes_me: 0, i_owe: 23.5 },
    { id: 'p-mei', name: 'Mei', owes_me: 118.0, i_owe: 0 },
  ];

  // Signed amounts: negative = money out. Dates are ISO (YYYY-MM-DD).
  const transactions = [
    { id: 't1', date: '2026-09-25', title: 'Lidl', category_id: 'c-groc', account_id: 'a-main', amount: -47.82 },
    { id: 't2', date: '2026-09-25', title: 'Dishoom Covent Garden', category_id: 'c-dine', account_id: 'a-uk', amount: -38.6, currency: 'GBP', splits: [{ person: 'Ana', amount: 19.3 }], notes: 'Birthday dinner' },
    { id: 't3', date: '2026-09-24', title: 'Transfer to Emergency Fund', account_id: 'a-main', amount: -500, transfer: { linked: 'Emergency Fund' } },
    { id: 't4', date: '2026-09-24', title: 'Spotify Family', category_id: 'c-subs', account_id: 'a-cc', amount: -17.99, recurring: true },
    { id: 't5', date: '2026-09-23', title: 'Uber', category_id: 'c-tran', account_id: 'a-main', amount: -14.2 },
    { id: 't6', date: '2026-09-23', title: 'Vattenfall Energy', category_id: 'c-util', account_id: 'a-joint', amount: -96.4, recurring: true },
    { id: 't7', date: '2026-09-22', title: 'Zara', category_id: 'c-shop', account_id: 'a-cc', amount: -79.95 },
    { id: 't8', date: '2026-09-22', title: 'Albert Heijn', category_id: 'c-groc', account_id: 'a-joint', amount: -63.1, splits: [{ person: 'Mei', amount: 31.55 }] },
    { id: 't9', date: '2026-09-21', title: 'Pathé Tuschinski', category_id: 'c-ent', account_id: 'a-main', amount: -28.0, debt: { paidBy: 'Tom', total: 47 } },
    { id: 't10', date: '2026-09-20', title: 'Apotheek', category_id: 'c-hlth', account_id: 'a-cash', amount: -12.45 },
    { id: 't11', date: '2026-09-19', title: 'KLM AMS to HYD', category_id: 'c-trav', account_id: 'a-cc', amount: -642.0, notes: 'Diwali trip' },
    { id: 't12', date: '2026-09-18', title: 'Swiggy', category_id: 'c-dine', account_id: 'a-in', amount: -860, currency: 'INR' },
    { id: 't13', date: '2026-09-15', title: 'Acme Corp Salary', category_id: 'c-sal', account_id: 'a-main', amount: 5240.0 },
    { id: 't14', date: '2026-09-15', title: 'Rent September', category_id: 'c-rent', account_id: 'a-joint', amount: -1450.0, recurring: true },
    { id: 't15', date: '2026-09-14', title: 'Ana paid you back', account_id: 'a-main', amount: 42.0, category_id: null },
  ];

  // Budgets: percentage_used drives OK (<80) / WARNING (80-100) / EXCEEDED (>100)
  const budgets = [
    { id: 'b-groc', name: 'Groceries', category_id: 'c-groc', period: 'MONTHLY', limit: 450, spent: 312.4, start: '2026-09-01', end: '2026-09-30' },
    { id: 'b-dine', name: 'Eating out', category_id: 'c-dine', period: 'MONTHLY', limit: 250, spent: 231.9, start: '2026-09-01', end: '2026-09-30' },
    { id: 'b-shop', name: 'Shopping', category_id: 'c-shop', period: 'MONTHLY', limit: 200, spent: 247.35, start: '2026-09-01', end: '2026-09-30' },
    { id: 'b-tran', name: 'Transport', category_id: 'c-tran', period: 'MONTHLY', limit: 120, spent: 58.7, start: '2026-09-01', end: '2026-09-30' },
    { id: 'b-ent', name: 'Fun money', category_id: 'c-ent', period: 'WEEKLY', limit: 60, spent: 28, start: '2026-09-21', end: '2026-09-27' },
    { id: 'b-trav', name: 'Travel 2026', category_id: 'c-trav', period: 'YEARLY', limit: 4000, spent: 2911.0, start: '2026-01-01', end: '2026-12-31' },
  ];

  // Monthly totals, last 12 months (EUR). Spending trend exists in the
  // backend but has no route yet (backend task filed); mocks may show it
  // but must mark it "needs backend".
  const monthly = [
    { m: 'Oct', income: 5180, spend: 3420 }, { m: 'Nov', income: 5180, spend: 3890 },
    { m: 'Dec', income: 6900, spend: 5210 }, { m: 'Jan', income: 5240, spend: 3105 },
    { m: 'Feb', income: 5240, spend: 2980 }, { m: 'Mar', income: 5240, spend: 3360 },
    { m: 'Apr', income: 5240, spend: 3620 }, { m: 'May', income: 5240, spend: 3240 },
    { m: 'Jun', income: 5240, spend: 4120 }, { m: 'Jul', income: 5240, spend: 4680 },
    { m: 'Aug', income: 5240, spend: 3510 }, { m: 'Sep', income: 5282, spend: 3542 },
  ];
  // Net worth history does NOT exist in the backend (task filed). Illustrative only.
  const netWorthHistory = [31200, 32150, 31980, 33400, 34820, 35100, 36750, 37020, 38110, 37640, 39380, netWorth];

  const categoryBreakdown = [
    { category_id: 'c-rent', total: 1450, percentage: 40.9 },
    { category_id: 'c-trav', total: 642, percentage: 18.1 },
    { category_id: 'c-groc', total: 312.4, percentage: 8.8 },
    { category_id: 'c-shop', total: 247.35, percentage: 7.0 },
    { category_id: 'c-dine', total: 231.9, percentage: 6.5 },
    { category_id: 'c-util', total: 196.4, percentage: 5.5 },
    { category_id: 'other', total: 461.95, percentage: 13.2 },
  ];

  const fmt = (n, cur = 'EUR', opts = {}) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: cur, maximumFractionDigits: cur === 'INR' || cur === 'JPY' ? 0 : 2, ...opts }).format(n);

  return { user, categories, accounts, people, transactions, budgets, monthly, netWorth, netWorthHistory, categoryBreakdown, fx, toEur, fmt,
    cat: (id) => categories.find((c) => c.id === id),
    acct: (id) => accounts.find((a) => a.id === id),
    nav: ['Dashboard', 'Transactions', 'Accounts', 'Budgets', 'Categories', 'People', 'Reports', 'Jobs', 'Schedules', 'Trash', 'Settings'],
  };
})();
