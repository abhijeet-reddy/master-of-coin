/* Master of Coin v2, direction A: Precision.
   Vanilla JS, no build, no network. Renders every page from window.MOC.
   Classic script (not a module) so it runs from file:// as well as a server. */
(() => {
  'use strict';
  const M = window.MOC;
  const root = document.documentElement;
  const RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FINE = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const params = new URLSearchParams(location.search);
  const PAGE = document.body.dataset.page;
  const TODAY = '2026-09-25'; // the sample data's "today"

  /* ------------------------------------------------------------------ utils */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const MINUS = '−';
  const fixMinus = (s) => s.replace('-', MINUS);
  const money = (n, cur = 'EUR', o = {}) => fixMinus(M.fmt(n, cur, o));
  const signed = (n, cur = 'EUR') => fixMinus(M.fmt(n, cur, { signDisplay: 'exceptZero' }));
  const compact = (n) => fixMinus(M.fmt(n, 'EUR', { notation: 'compact', maximumFractionDigits: 1 }));
  const pct = (n, d = 1) => `${n.toFixed(d)}%`;
  const parseDate = (s) => new Date(`${s}T12:00:00`);
  const dayDiff = (a, b) => Math.round((parseDate(b) - parseDate(a)) / 86400000);
  const fmtDate = (s, o) => new Intl.DateTimeFormat('en-US', o).format(parseDate(s));
  const initials = (name) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  const txEur = (t) => t.amount * (M.fx[t.currency || M.acct(t.account_id)?.currency || 'EUR'] || 1);
  const txCur = (t) => t.currency || M.acct(t.account_id)?.currency || 'EUR';
  const sum = (a) => a.reduce((s, v) => s + v, 0);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

  /* Generated spring, emitted as CSS linear(). Apple-style params: duration 0.5s, bounce 0.2 */
  const SPRING = (() => {
    const dur = 0.5, bounce = 0.2;
    const w0 = (2 * Math.PI) / dur, z = 1 - bounce, wd = w0 * Math.sqrt(1 - z * z);
    const x = (t) => 1 - Math.exp(-z * w0 * t) * (Math.cos(wd * t) + ((z * w0) / wd) * Math.sin(wd * t));
    let T = 0.2;
    for (let t = 0; t < 3; t += 0.002) if (Math.abs(1 - x(t)) > 0.002) T = t;
    const N = 48, pts = [];
    for (let i = 0; i <= N; i++) pts.push(i === N ? 1 : +x((i / N) * T).toFixed(4));
    return { easing: `linear(${pts.join(', ')})`, ms: Math.round(T * 1000) };
  })();
  root.style.setProperty('--spring', SPRING.easing);
  root.style.setProperty('--spring-dur', `${SPRING.ms}ms`);

  /* ------------------------------------------------------------------ icons */
  const ICONS = {
    dashboard: '<rect x="3" y="3" width="7.5" height="9" rx="2"/><rect x="13.5" y="3" width="7.5" height="5.5" rx="2"/><rect x="13.5" y="11.5" width="7.5" height="9.5" rx="2"/><rect x="3" y="15" width="7.5" height="6" rx="2"/>',
    transactions: '<path d="M5.5 3h13v18l-2.6-1.7-2.2 1.7-2.2-1.7-2.2 1.7-2.2-1.7L5.5 21z"/><path d="M9 8h6M9 12h6M9 16h3.5"/>',
    accounts: '<path d="M3 9.5 12 4l9 5.5"/><path d="M5 10.5v7M9.7 10.5v7M14.3 10.5v7M19 10.5v7M3 20.5h18"/>',
    budgets: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/>',
    categories: '<path d="M3 12.2V4a1 1 0 0 1 1-1h8.2l8.6 8.6a1.4 1.4 0 0 1 0 2l-7.2 7.2a1.4 1.4 0 0 1-2 0z"/><circle cx="7.6" cy="7.6" r="1.4"/>',
    people: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18.2 14.2A6.5 6.5 0 0 1 21.5 20"/>',
    reports: '<path d="M3.5 3.5v17h17"/><path d="m7.5 15 4-4.5 3 3 5.5-6.5"/>',
    jobs: '<path d="M12 3 3 8l9 5 9-5z"/><path d="m3 12.5 9 5 9-5"/><path d="m3 16.5 9 5 9-5"/>',
    schedules: '<rect x="3" y="4.5" width="18" height="16.5" rx="3"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/><path d="M12 13v3l2 1.2"/>',
    trash: '<path d="M4 6.5h16M9.5 6.5V4h5v2.5M6 6.5l1 14h10l1-14"/><path d="M10 10.5v6M14 10.5v6"/>',
    settings: '<path d="M4 6.5h9M17 6.5h3M4 12h3M11 12h9M4 17.5h11M19 17.5h1"/><circle cx="15" cy="6.5" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="17.5" r="2"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    transfer: '<path d="M4 8.5h15l-3.5-3.5"/><path d="M20 15.5H5l3.5 3.5"/>',
    import: '<path d="M12 14.5V3.5M7.5 8 12 3.5 16.5 8"/><path d="M4 14.5v3.5a2.5 2.5 0 0 0 2.5 2.5h11a2.5 2.5 0 0 0 2.5-2.5v-3.5"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
    filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
    'chev-l': '<path d="m14.5 18-6-6 6-6"/>',
    'chev-r': '<path d="m9.5 18 6-6-6-6"/>',
    'chev-d': '<path d="m6 9.5 6 6 6-6"/>',
    more: '<circle cx="5.5" cy="12" r="1.1" fill="currentColor"/><circle cx="12" cy="12" r="1.1" fill="currentColor"/><circle cx="18.5" cy="12" r="1.1" fill="currentColor"/>',
    edit: '<path d="M4 20h4.2L19.4 8.8a2 2 0 0 0 0-2.8l-1.4-1.4a2 2 0 0 0-2.8 0L4 15.8z"/><path d="m13.5 6.5 4 4"/>',
    copy: '<rect x="8" y="8" width="12.5" height="12.5" rx="2.5"/><path d="M16 8V5.5A2.5 2.5 0 0 0 13.5 3h-8A2.5 2.5 0 0 0 3 5.5v8A2.5 2.5 0 0 0 5.5 16H8"/>',
    split: '<circle cx="8" cy="8.5" r="3"/><circle cx="16.5" cy="8.5" r="3"/><path d="M2.5 20a5.5 5.5 0 0 1 11 0M13.5 15.2a5.5 5.5 0 0 1 8 4.8"/>',
    repeat: '<path d="m17 2.5 3 3-3 3"/><path d="M4 11.5v-1a5 5 0 0 1 5-5h11"/><path d="m7 21.5-3-3 3-3"/><path d="M20 12.5v1a5 5 0 0 1-5 5H4"/>',
    note: '<path d="M5 3.5h14v11l-6 6H5z"/><path d="M13 20.5v-6h6"/><path d="M8.5 8.5h7M8.5 12h4"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/>',
    sync: '<path d="M20 11.5A8 8 0 0 0 5.8 6.8L4 8.5"/><path d="M4 4v4.5h4.5"/><path d="M4 12.5a8 8 0 0 0 14.2 4.7l1.8-1.7"/><path d="M20 20v-4.5h-4.5"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3.3-3.3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0L5 13.3A4 4 0 0 0 10.7 19l1-1"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    x: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
    alert: '<path d="M10.3 4.2 2.9 17.5A2 2 0 0 0 4.6 20.5h14.8a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0z"/><path d="M12 9.5v4.5M12 17.2v.1"/>',
    'alert-circle': '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.4v.1"/>',
    'check-circle': '<circle cx="12" cy="12" r="9"/><path d="m8.2 12.4 2.6 2.6 5-5.4"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"/>',
    moon: '<path d="M20 14.6A8.5 8.5 0 1 1 9.4 4a6.6 6.6 0 0 0 10.6 10.6z"/>',
    sidebar: '<rect x="3" y="4" width="18" height="16" rx="3.5"/><path d="M9.5 4v16"/>',
    cart: '<circle cx="9.5" cy="19.5" r="1.4"/><circle cx="17.5" cy="19.5" r="1.4"/><path d="M2.5 3.5h2.6l2.4 11.5h11l2-8.5H6.3"/>',
    fork: '<path d="M6.5 3v6.5a2 2 0 0 0 2 2 2 2 0 0 0 2-2V3M8.5 11.5V21"/><path d="M17.5 21V3c-2.2 1-3.7 3.5-3.7 7.2 0 2.5 1.3 3.8 3.7 3.8"/>',
    home: '<path d="M3.5 10.8 12 3.8l8.5 7V20a1 1 0 0 1-1 1H15v-6.5H9V21H4.5a1 1 0 0 1-1-1z"/>',
    bolt: '<path d="M13 2.5 4.5 13.5H12l-1 8 8.5-11H12z"/>',
    train: '<rect x="5" y="3" width="14" height="14" rx="3.5"/><path d="M5 10.5h14M8.5 21l1.8-4M15.5 21l-1.8-4"/><path d="M9 13.8h.1M15 13.8h.1"/>',
    bag: '<path d="M5 8h14l-1.1 12.5a1 1 0 0 1-1 .9H7.1a1 1 0 0 1-1-.9z"/><path d="M9 10.5V6.5a3 3 0 0 1 6 0v4"/>',
    film: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M7.5 4v16M16.5 4v16M3 9.5h4.5M3 14.5h4.5M16.5 9.5H21M16.5 14.5H21"/>',
    heart: '<path d="M12 20s-7.5-4.4-7.5-10.1A4.4 4.4 0 0 1 12 7.1a4.4 4.4 0 0 1 7.5 2.8C19.5 15.6 12 20 12 20z"/>',
    plane: '<path d="M21 15.5v-1.8l-8-5V4a1.5 1.5 0 0 0-3 0v4.7l-8 5v1.8l8-2.5V18l-2.5 2v1.5L11.5 20l4 1.5V20L13 18v-5z"/>',
    briefcase: '<rect x="3" y="7" width="18" height="13" rx="2.5"/><path d="M9 7V5.2A1.7 1.7 0 0 1 10.7 3.5h2.6A1.7 1.7 0 0 1 15 5.2V7M3 12.5h18"/>',
    'trend-up': '<path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
    'trend-down': '<path d="m3 7 6 6 4-4 8 8"/><path d="M15 17h6v-6"/>',
    'arrow-in': '<path d="M17 7 7 17M16 17H7V8"/>',
    'arrow-out': '<path d="M7 17 17 7M8 7h9v9"/>',
    vault: '<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="12" cy="12" r="3.8"/><path d="M12 8.2v1.3M12 14.5v1.3M8.2 12h1.3M14.5 12h1.3"/>',
    card: '<rect x="2.5" y="5" width="19" height="14" rx="3"/><path d="M2.5 10h19M6 15h4"/>',
    cash: '<rect x="2.5" y="6" width="19" height="12" rx="2.5"/><circle cx="12" cy="12" r="2.6"/><path d="M6 9.5h.1M18 14.5h.1"/>',
    gift: '<rect x="3.5" y="8" width="17" height="4" rx="1"/><path d="M5 12v7.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V12M12 8v12.5"/><path d="M12 8C11 4.8 7 4.3 7 6.7 7 8 8.5 8 12 8zM12 8c1-3.2 5-3.7 5-1.3C17 8 15.5 8 12 8z"/>',
    loan: '<circle cx="12" cy="12" r="9"/><path d="M8 12h8"/>',
    plug: '<path d="M9 3v4.5M15 3v4.5M6.5 7.5h11V11a5.5 5.5 0 0 1-11 0zM12 16.5V21"/>',
    calendar: '<rect x="3" y="4.5" width="18" height="16.5" rx="3"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/>',
    archive: '<rect x="3" y="4" width="18" height="4.5" rx="1.2"/><path d="M5 8.5v10.5a1.5 1.5 0 0 0 1.5 1.5h11a1.5 1.5 0 0 0 1.5-1.5V8.5M10 12.5h4"/>',
    undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    grid: '<circle cx="6" cy="6" r="1.4"/><circle cx="12" cy="6" r="1.4"/><circle cx="18" cy="6" r="1.4"/><circle cx="6" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="18" cy="12" r="1.4"/><circle cx="6" cy="18" r="1.4"/><circle cx="12" cy="18" r="1.4"/><circle cx="18" cy="18" r="1.4"/>',
    coin: '<circle cx="12" cy="12" r="8.5"/><path d="M14.8 9.2A3.4 3.4 0 0 0 12 8a4 4 0 0 0 0 8 3.4 3.4 0 0 0 2.8-1.2"/><path d="M8.5 11h4.5M8.5 13h4.5"/>',
    pace: '<path d="M12 21a9 9 0 1 1 9-9"/><path d="m12 12 4.5-3"/><path d="M19 17.5h2.5M18 21h3.5"/>',
    link2: '<path d="M9 17H7A5 5 0 0 1 7 7h2M15 7h2a5 5 0 0 1 0 10h-2M8 12h8"/>',
    tag: '<path d="M3 12.2V4a1 1 0 0 1 1-1h8.2l8.6 8.6a1.4 1.4 0 0 1 0 2l-7.2 7.2a1.4 1.4 0 0 1-2 0z"/><circle cx="7.6" cy="7.6" r="1.4"/>',
    sparkle: '<path d="M12 3.5 13.6 9l5.4 1.6-5.4 1.6L12 17.5l-1.6-5.3L5 10.6 10.4 9z"/>',
  };
  const ic = (name, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONS[name] || ''}</svg>`;

  const CAT_ICON = { cart: 'cart', fork: 'fork', home: 'home', bolt: 'bolt', train: 'train', bag: 'bag', film: 'film', heart: 'heart', plane: 'plane', briefcase: 'briefcase', repeat: 'repeat' };
  const catIco = (catId, size = '', extra = {}) => {
    const c = catId ? M.cat(catId) : null;
    if (extra.transfer) return `<span class="cat-ico ${size}" style="--c: var(--accent)">${ic('transfer')}</span>`;
    if (!c) return `<span class="cat-ico ${size}" style="--c: var(--text-3)">${ic('tag')}</span>`;
    return `<span class="cat-ico ${size}" style="--c:${c.color}">${ic(CAT_ICON[c.icon] || 'tag')}</span>`;
  };
  const catName = (t) => (t.transfer ? 'Transfer' : t.category_id ? M.cat(t.category_id).name : 'Uncategorised');

  /* --------------------------------------------------------- derived data */
  const TYPE_LABEL = { CHECKING: 'Checking', SAVINGS: 'Savings', CREDIT_CARD: 'Credit card', INVESTMENT: 'Investment', CASH: 'Cash', GIFT_CARD: 'Gift card', DEBT: 'Debt' };
  const TYPE_ICON = { CHECKING: 'accounts', SAVINGS: 'vault', CREDIT_CARD: 'card', INVESTMENT: 'trend-up', CASH: 'cash', GIFT_CARD: 'gift', DEBT: 'loan' };
  const ACC_COLOR = { 'a-main': '#1d2129', 'a-joint': '#2a8c80', 'a-save': '#5457e8', 'a-uk': '#e8575a', 'a-in': '#23509e', 'a-cc': '#a88a3f', 'a-t212': '#1b78c9', 'a-cash': '#6b7482', 'a-gift': '#d9822b', 'a-debt': '#5d6371' };
  const isLiab = (a) => a.balance < 0 || a.account_type === 'CREDIT_CARD' || a.account_type === 'DEBT';
  const GROUPS = [
    { id: 'everyday', name: 'Cash and bank', types: ['CHECKING', 'CASH'], icon: 'accounts' },
    { id: 'savings', name: 'Savings', types: ['SAVINGS'], icon: 'vault' },
    { id: 'invest', name: 'Investments', types: ['INVESTMENT'], icon: 'trend-up' },
    { id: 'other', name: 'Gift cards', types: ['GIFT_CARD'], icon: 'gift' },
    { id: 'credit', name: 'Credit cards', types: ['CREDIT_CARD'], icon: 'card', liability: true },
    { id: 'debt', name: 'Loans and debt', types: ['DEBT'], icon: 'loan', liability: true },
  ];
  const GROUP_COLOR = { everyday: 'var(--chart-1)', savings: '#1f9e8f', invest: '#8a5bd6', other: '#c9a227' };
  const groupAccounts = (g) => M.accounts.filter((a) => g.types.includes(a.account_type));
  const assets = sum(M.accounts.filter((a) => !isLiab(a)).map(M.toEur));
  const liabilities = sum(M.accounts.filter(isLiab).map(M.toEur));
  const nwPrev = M.netWorthHistory[M.netWorthHistory.length - 2];
  const nwDelta = M.netWorth - nwPrev;

  const pctUsed = (b) => (b.spent / b.limit) * 100;
  const statusOf = (b) => { const p = pctUsed(b); return p > 100 ? 'EXCEEDED' : p >= 80 ? 'WARNING' : 'OK'; };
  const STATUS = {
    OK: { label: 'OK', cls: 'status-ok', icon: 'check-circle', color: 'var(--pos)' },
    WARNING: { label: 'Warning', cls: 'status-warning', icon: 'alert', color: 'var(--warn-mark)' },
    EXCEEDED: { label: 'Exceeded', cls: 'status-exceeded', icon: 'alert-circle', color: 'var(--neg)' },
  };
  const statusChip = (s) => `<span class="status ${STATUS[s].cls}">${ic(STATUS[s].icon)}${STATUS[s].label}</span>`;
  const budgetTime = (b) => {
    const total = dayDiff(b.start, b.end) + 1;
    const elapsed = clamp(dayDiff(b.start, TODAY) + 1, 0, total);
    const left = Math.max(0, dayDiff(TODAY, b.end));
    const expected = (b.limit * elapsed) / total;
    const ahead = b.spent > expected * 1.02;
    return { total, elapsed, left, expected, ahead, timePct: (elapsed / total) * 100 };
  };
  const PERIOD_LABEL = { DAILY: 'Daily', WEEKLY: 'Weekly', MONTHLY: 'Monthly', QUARTERLY: 'Quarterly', YEARLY: 'Yearly' };

  /* ------------------------------------------------------------------ theme */
  const themeToggleBtn = () => `<button class="icon-btn theme-toggle" type="button" data-action="theme" aria-label="Switch to dark theme">${ic('moon', 'i-moon')}${ic('sun', 'i-sun')}</button>`;
  const syncThemeLabels = () => {
    const dark = root.dataset.theme === 'dark';
    $$('[data-action="theme"]').forEach((b) => b.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme'));
  };
  function setTheme(next, originEl) {
    const apply = () => {
      root.classList.add('theme-swapping');
      root.dataset.theme = next;
      try { localStorage.setItem('moc-a-theme', next); } catch (e) { /* storage may be blocked */ }
      syncThemeLabels();
      void root.offsetHeight;
      requestAnimationFrame(() => root.classList.remove('theme-swapping'));
    };
    if (RM || !document.startViewTransition) { apply(); return; }
    const r = originEl ? originEl.getBoundingClientRect() : { left: innerWidth / 2, top: 0, width: 0, height: 0 };
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    const vt = document.startViewTransition(apply);
    vt.ready.then(() => {
      root.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        { duration: 600, easing: 'cubic-bezier(0.22, 0, 0.12, 1)', pseudoElement: '::view-transition-new(root)' },
      );
    }).catch(() => {});
  }

  /* ------------------------------------------------------------------ shell */
  const NAV_ICON = ['dashboard', 'transactions', 'accounts', 'budgets', 'categories', 'people', 'reports', 'jobs', 'schedules', 'trash', 'settings'];
  const NAV_HREF = { Dashboard: 'dashboard.html', Transactions: 'transactions.html', Accounts: 'accounts.html', Budgets: 'budgets.html' };
  const NAV_GROUPS = [['Money', [0, 1, 2, 3]], ['Organise', [4, 5, 6]], ['System', [7, 8, 9, 10]]];
  const PAGE_NAME = { dashboard: 'Dashboard', transactions: 'Transactions', accounts: 'Accounts', budgets: 'Budgets' };

  const navItem = (i) => {
    const name = M.nav[i];
    const href = NAV_HREF[name];
    const cur = PAGE_NAME[PAGE] === name;
    if (href) return `<li><a class="nav-item" href="${href}" ${cur ? 'aria-current="page"' : ''} title="${name}">${ic(NAV_ICON[i])}<span class="lbl">${name}</span></a></li>`;
    return `<li><span class="nav-item" aria-disabled="true" title="${name} (not mocked)">${ic(NAV_ICON[i])}<span class="lbl">${name}</span></span></li>`;
  };

  function renderShell(contentHtml) {
    const collapsed = (() => { try { return localStorage.getItem('moc-a-collapsed') === '1'; } catch (e) { return false; } })();
    const brandSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15.5 8.6A4.6 4.6 0 0 0 12 7a5 5 0 0 0 0 10 4.6 4.6 0 0 0 3.5-1.6"/><path d="M7.5 10.8h5.5M7.5 13.2h5.5"/></svg>`;
    document.body.insertAdjacentHTML('afterbegin', `
      <a class="skip" href="#main">Skip to content</a>
      <div class="shell" data-collapsed="${collapsed}">
        <aside class="sidebar" aria-label="Sidebar">
          <div class="sb-head">
            <a class="brand" href="dashboard.html" aria-label="Master of Coin, go to Dashboard">
              <span class="brand-mark">${brandSvg}</span>
              <span class="brand-name">Master of Coin<span class="brand-sub">Personal finance</span></span>
            </a>
          </div>
          <nav class="nav" aria-label="Primary">
            ${NAV_GROUPS.map(([label, idx]) => `<div class="nav-group"><div class="nav-label" aria-hidden="true">${label}</div><ul>${idx.map(navItem).join('')}</ul></div>`).join('')}
          </nav>
          <div class="sb-foot">
            <div class="user">
              <span class="avatar" aria-hidden="true">${initials(M.user.name)}</span>
              <div class="user-meta"><div class="user-name">${esc(M.user.name)}</div><div class="user-mail">${esc(M.user.email)}</div></div>
            </div>
            <div class="sb-row">
              <button class="icon-btn sm" type="button" data-action="collapse" aria-label="${collapsed ? 'Expand sidebar' : 'Collapse sidebar'}" aria-expanded="${!collapsed}">${ic('sidebar')}</button>
              <span class="version">v${esc(M.user.version)}</span>
            </div>
          </div>
        </aside>
        <div class="main-wrap">
          <div class="panel">
            <header class="topbar">
              <div class="mobile-brand"><span class="brand-mark">${brandSvg}</span><span>Master of Coin</span></div>
              <div class="crumbs">${ic(NAV_ICON[M.nav.indexOf(PAGE_NAME[PAGE])], 'ic-sm')}<strong>${PAGE_NAME[PAGE]}</strong></div>
              <div class="topbar-spacer"></div>
              <button class="cmdk" type="button" data-action="cmdk" aria-label="Search and jump to">${ic('search', 'ic-sm')}<span>Search or jump to</span><kbd>⌘K</kbd></button>
              ${themeToggleBtn()}
            </header>
            <main id="main" class="content" tabindex="-1">${contentHtml}</main>
          </div>
        </div>
        <nav class="tabbar" aria-label="Primary">
          ${[0, 1, 2, 3].map((i) => `<a href="${NAV_HREF[M.nav[i]]}" ${PAGE_NAME[PAGE] === M.nav[i] ? 'aria-current="page"' : ''}>${ic(NAV_ICON[i])}<span>${M.nav[i]}</span></a>`).join('')}
          <button type="button" data-action="more-nav" aria-haspopup="dialog">${ic('grid')}<span>More</span></button>
        </nav>
      </div>
      <div class="toast-region" role="status" aria-live="polite"></div>
      <div class="menu" role="menu" aria-hidden="true"></div>`);
    syncThemeLabels();
    const topbar = $('.topbar');
    const onScroll = () => topbar.classList.toggle('scrolled', scrollY > 4);
    addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  function toggleSidebar(btn) {
    const shell = $('.shell');
    const wrap = $('.main-wrap');
    const before = wrap.getBoundingClientRect().left;
    const next = shell.dataset.collapsed !== 'true';
    shell.dataset.collapsed = String(next);
    btn.setAttribute('aria-expanded', String(!next));
    btn.setAttribute('aria-label', next ? 'Expand sidebar' : 'Collapse sidebar');
    try { localStorage.setItem('moc-a-collapsed', next ? '1' : '0'); } catch (e) { /* ignore */ }
    const after = wrap.getBoundingClientRect().left;
    if (!RM) wrap.animate([{ transform: `translateX(${before - after}px)` }, { transform: 'none' }], { duration: SPRING.ms, easing: SPRING.easing });
  }

  /* --------------------------------------------------------------- count-up */
  function countUp(el, to, render, dur = 900, delay = 250) {
    if (RM) { el.innerHTML = render(to); return; }
    el.innerHTML = render(0);
    const start = performance.now() + delay;
    const ease = (t) => 1 - Math.pow(1 - t, 4);
    const tick = (now) => {
      const t = clamp((now - start) / dur, 0, 1);
      el.innerHTML = render(to * ease(t));
      if (t < 1) requestAnimationFrame(tick); else el.innerHTML = render(to);
    };
    requestAnimationFrame(tick);
  }
  const heroMoney = (n) => {
    const s = money(n);
    const dot = s.lastIndexOf('.');
    return dot > -1 ? `${s.slice(0, dot)}<span class="cents">${s.slice(dot)}</span>` : s;
  };

  /* ================================================================ charts */
  let ENTERED = false;
  const charts = [];
  const registerChart = (fn) => { charts.push(fn); fn(!ENTERED && !RM); };
  const rerender = debounce(() => charts.forEach((fn) => fn(false)), 120);
  addEventListener('resize', rerender);
  const svgEl = (w, h, inner, label) => `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}">${inner}</svg>`;

  function niceStep(range, count) {
    const raw = range / count;
    const p = Math.pow(10, Math.floor(Math.log10(raw)));
    const n = raw / p;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
  }
  function monotonePath(pts) {
    const n = pts.length;
    if (n < 2) return '';
    const dx = [], m = [], t = [];
    for (let i = 0; i < n - 1; i++) { dx[i] = pts[i + 1][0] - pts[i][0]; m[i] = (pts[i + 1][1] - pts[i][1]) / dx[i]; }
    t[0] = m[0]; t[n - 1] = m[n - 2];
    for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
    for (let i = 0; i < n - 1; i++) {
      if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
      const a = t[i] / m[i], b = t[i + 1] / m[i], s = a * a + b * b;
      if (s > 9) { const k = 3 / Math.sqrt(s); t[i] = k * a * m[i]; t[i + 1] = k * b * m[i]; }
    }
    let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
    for (let i = 0; i < n - 1; i++) {
      const h = dx[i] / 3;
      d += `C${(pts[i][0] + h).toFixed(1)},${(pts[i][1] + t[i] * h).toFixed(1)} ${(pts[i + 1][0] - h).toFixed(1)},${(pts[i + 1][1] - t[i + 1] * h).toFixed(1)} ${pts[i + 1][0].toFixed(1)},${pts[i + 1][1].toFixed(1)}`;
    }
    return d;
  }
  function tooltipFor(host) {
    let tt = $('.tooltip', host);
    if (!tt) { tt = document.createElement('div'); tt.className = 'tooltip'; tt.setAttribute('aria-hidden', 'true'); host.append(tt); }
    return tt;
  }
  /* Tooltip content is built with textContent: labels are data, not markup. */
  function fillTooltip(tt, title, rows) {
    tt.replaceChildren();
    const h = document.createElement('div'); h.className = 'tt-title'; h.textContent = title; tt.append(h);
    rows.forEach((r) => {
      const row = document.createElement('div'); row.className = 'tt-row';
      if (r.color) { const k = document.createElement('span'); k.className = 'key-line'; k.style.background = r.color; row.append(k); }
      const n = document.createElement('span'); n.className = 'tt-name'; n.textContent = r.name; row.append(n);
      const v = document.createElement('span'); v.className = 'tt-val'; v.textContent = r.value; row.append(v);
      tt.append(row);
    });
  }
  function placeTooltip(host, tt, x, y) {
    const w = host.clientWidth, tw = tt.offsetWidth, th = tt.offsetHeight;
    let left = x + 14;
    if (left + tw > w) left = x - tw - 14;
    tt.style.left = `${clamp(left, 0, Math.max(0, w - tw))}px`;
    tt.style.top = `${clamp(y - th / 2, -8, host.clientHeight - th + 8)}px`;
    tt.classList.add('show');
  }

  /* Area / line chart with crosshair, keyboard stepping and draw-in */
  function areaChart(host, o) {
    const render = (animate) => {
      const W = host.clientWidth, H = host.clientHeight || 200;
      if (!W) return;
      const pad = { l: 8, r: 52, t: 14, b: 24 };
      const v = o.values, n = v.length;
      const lo = Math.min(...v), hi = Math.max(...v);
      const step = niceStep((hi - lo) * 1.2 || 1, 3);
      const min = Math.floor((lo - (hi - lo) * 0.12) / step) * step, max = Math.ceil((hi + (hi - lo) * 0.06) / step) * step;
      const X = (i) => pad.l + (i * (W - pad.l - pad.r)) / (n - 1);
      const Y = (val) => pad.t + (1 - (val - min) / (max - min)) * (H - pad.t - pad.b);
      const pts = v.map((val, i) => [X(i), Y(val)]);
      const line = monotonePath(pts);
      const area = `${line}L${X(n - 1).toFixed(1)},${H - pad.b}L${X(0).toFixed(1)},${H - pad.b}Z`;
      let grid = '';
      for (let g = min; g <= max + 0.001; g += step) {
        grid += `<line class="grid-line" x1="${pad.l}" x2="${W - pad.r + 8}" y1="${Y(g).toFixed(1)}" y2="${Y(g).toFixed(1)}"/><text x="${W - pad.r + 14}" y="${(Y(g) + 3.5).toFixed(1)}">${compact(g)}</text>`;
      }
      const every = Math.max(1, Math.ceil((n * 46) / (W - pad.l - pad.r)));
      const labels = o.labels.map((l, i) => ((i % every !== 0 && i !== n - 1) || (i !== n - 1 && i > n - 1 - every) ? '' : `<text x="${X(i).toFixed(1)}" y="${H - 6}" text-anchor="${i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}">${esc(l)}</text>`)).join('');
      const gid = `g-${o.id}`;
      const A = animate;
      const last = pts[n - 1];
      host.innerHTML = svgEl(W, H, `
        <defs><linearGradient id="${gid}" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stop-color="${o.color}" stop-opacity="0.22"/><stop offset="1" stop-color="${o.color}" stop-opacity="0"/>
        </linearGradient></defs>
        ${grid}${labels}
        <g class="${A ? 'anim-reveal' : ''}" style="--delay:${o.delay || 250}ms"><path d="${area}" fill="url(#${gid})"/></g>
        <path class="line ${A ? 'anim-draw' : ''}" d="${line}" stroke="${o.color}" pathLength="1" stroke-dasharray="1" style="--from:1; --delay:${o.delay || 250}ms"/>
        <circle class="${A ? 'anim-ping' : ''}" cx="${last[0]}" cy="${last[1]}" r="5" fill="${o.color}" opacity="0" style="--delay:${(o.delay || 250) + 900}ms"/>
        <circle class="${A ? 'anim-pop' : ''}" cx="${last[0]}" cy="${last[1]}" r="4.5" fill="${o.color}" stroke="var(--surface)" stroke-width="2" style="--delay:${(o.delay || 250) + 800}ms"/>
        <line class="crosshair" x1="0" x2="0" y1="${pad.t}" y2="${H - pad.b}"/>
        <circle class="hover-dot" r="5" fill="${o.color}" stroke="var(--surface)" stroke-width="2.5" cx="-20" cy="-20"/>
        <rect class="hit" x="0" y="0" width="${W}" height="${H}"/>`, o.label);
      const svg = $('svg', host), cross = $('.crosshair', host), dot = $('.hover-dot', host), tt = tooltipFor(host);
      let idx = -1;
      const show = (i) => {
        idx = clamp(i, 0, n - 1);
        host.dataset.hover = 'true';
        cross.setAttribute('x1', pts[idx][0]); cross.setAttribute('x2', pts[idx][0]);
        dot.setAttribute('cx', pts[idx][0]); dot.setAttribute('cy', pts[idx][1]);
        const prev = idx > 0 ? v[idx] - v[idx - 1] : null;
        fillTooltip(tt, o.tipTitle ? o.tipTitle(idx) : o.labels[idx], [
          { name: o.seriesName, value: money(v[idx]), color: o.color },
          ...(prev !== null ? [{ name: 'Change', value: signed(prev) }] : []),
        ]);
        placeTooltip(host, tt, pts[idx][0], pts[idx][1]);
      };
      const hide = () => { host.dataset.hover = 'false'; tt.classList.remove('show'); };
      svg.addEventListener('pointermove', (e) => {
        const r = svg.getBoundingClientRect();
        show(Math.round(((e.clientX - r.left - pad.l) / (W - pad.l - pad.r)) * (n - 1)));
      });
      svg.addEventListener('pointerleave', hide);
      host.onkeydown = (e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); show((idx < 0 ? n - 1 : idx) + (e.key === 'ArrowRight' ? 1 : -1)); }
        if (e.key === 'Escape') hide();
      };
      host.onblur = hide;
    };
    host.tabIndex = 0;
    registerChart(render);
  }

  /* Grouped columns, one axis, per-group hover */
  function groupedBars(host, o) {
    const render = (animate) => {
      const W = host.clientWidth, H = host.clientHeight || 220;
      if (!W) return;
      const pad = { l: 8, r: 48, t: 12, b: 24 };
      const n = o.labels.length;
      const hi = Math.max(...o.series.flatMap((s) => s.values));
      const step = niceStep(hi, 3);
      const max = Math.ceil(hi / step) * step;
      const slot = (W - pad.l - pad.r) / n;
      const bw = Math.min(14, (slot - 10) / 2);
      const Y = (val) => pad.t + (1 - val / max) * (H - pad.t - pad.b);
      const base = H - pad.b;
      let grid = '';
      for (let g = 0; g <= max + 0.001; g += step) grid += `<line class="${g === 0 ? 'baseline' : 'grid-line'}" x1="${pad.l}" x2="${W - pad.r + 8}" y1="${Y(g).toFixed(1)}" y2="${Y(g).toFixed(1)}"/><text x="${W - pad.r + 14}" y="${(Y(g) + 3.5).toFixed(1)}">${compact(g)}</text>`;
      const barPath = (x, y, w, h) => { const r = Math.min(4, h, w / 2); return `M${x},${base}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${base}Z`; };
      let groups = '';
      for (let i = 0; i < n; i++) {
        const cx = pad.l + slot * i + slot / 2;
        const bars = o.series.map((s, si) => {
          const x = cx - bw - 1 + si * (bw + 2);
          const y = Y(s.values[i]);
          return `<path class="bar ${animate ? 'anim-grow-y' : ''}" d="${barPath(x, y, bw, base - y)}" fill="${s.color}" style="--delay:${250 + i * 40 + si * 20}ms"/>`;
        }).join('');
        groups += `<g class="bar-group" data-i="${i}">${bars}<rect class="hit" x="${(cx - slot / 2).toFixed(1)}" y="${pad.t}" width="${slot.toFixed(1)}" height="${H - pad.t}"/></g>`;
      }
      const lEvery = slot < 34 ? 2 : 1;
      const labels = o.labels.map((l, i) => (i % lEvery ? '' : `<text x="${(pad.l + slot * i + slot / 2).toFixed(1)}" y="${H - 6}" text-anchor="middle">${esc(l)}</text>`)).join('');
      host.innerHTML = svgEl(W, H, `${grid}${labels}${groups}`, o.label);
      const tt = tooltipFor(host);
      let idx = -1;
      const show = (i) => {
        idx = clamp(i, 0, n - 1);
        host.dataset.hover = 'true';
        $$('.bar-group', host).forEach((g) => g.classList.toggle('is-hover', +g.dataset.i === idx));
        const rows = o.series.map((s) => ({ name: s.name, value: money(s.values[idx]), color: s.color }));
        if (o.extra) rows.push(o.extra(idx));
        fillTooltip(tt, o.tipTitle ? o.tipTitle(idx) : o.labels[idx], rows);
        const cx = pad.l + slot * idx + slot / 2;
        placeTooltip(host, tt, cx + bw, Y(Math.max(...o.series.map((s) => s.values[idx]))) + 20);
      };
      const hide = () => { host.dataset.hover = 'false'; tt.classList.remove('show'); $$('.bar-group', host).forEach((g) => g.classList.remove('is-hover')); };
      $$('.bar-group', host).forEach((g) => g.addEventListener('pointerenter', () => show(+g.dataset.i)));
      $('svg', host).addEventListener('pointerleave', hide);
      host.onkeydown = (e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); show((idx < 0 ? n - 1 : idx) + (e.key === 'ArrowRight' ? 1 : -1)); }
        if (e.key === 'Escape') hide();
      };
      host.onblur = hide;
    };
    host.tabIndex = 0;
    registerChart(render);
  }

  /* Donut: 2px surface gaps between segments, sequential draw-in */
  function donutSvg(items, size, thick, animate, label) {
    const r = (size - thick) / 2, C = 2 * Math.PI * r;
    const total = sum(items.map((i) => i.value));
    const gap = (2 / C) * 100;
    let acc = 0;
    const segs = items.map((it, i) => {
      const len = (it.value / total) * 100;
      const vis = Math.max(0.1, len - gap);
      const rot = (acc / 100) * 360;
      acc += len;
      return `<circle class="seg-arc ${animate ? 'anim-draw' : ''}" data-i="${i}" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${it.color}" stroke-width="${thick}" pathLength="100" stroke-dasharray="${vis.toFixed(2)} 200" style="--from:${vis.toFixed(2)}; --delay:${300 + i * 90}ms; animation-duration: 500ms" transform="rotate(${rot.toFixed(2)} ${size / 2} ${size / 2})"/>`;
    }).join('');
    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="${esc(label)}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--surface-2)" stroke-width="${thick}"/>${segs}</svg>`;
  }

  /* Progress ring. Fill carries status colour, label carries the number. */
  function ringSvg(p, size, stroke, color, animate, delay = 300) {
    const r = (size - stroke) / 2;
    const off = 100 - clamp(p, 0, 100);
    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
      <circle class="track" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="${stroke}"/>
      <circle class="fill ${animate ? 'anim-draw' : ''}" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" pathLength="100" stroke-dasharray="100" stroke-dashoffset="${off}" style="--from:100; --delay:${delay}ms"/>
    </svg>`;
  }

  function sparkSvg(values, w, h, color, animate, delay = 400) {
    const lo = Math.min(...values), hi = Math.max(...values);
    const pts = values.map((v, i) => [2 + (i * (w - 4)) / (values.length - 1), 3 + (1 - (v - lo) / (hi - lo || 1)) * (h - 6)]);
    const d = monotonePath(pts);
    const last = pts[pts.length - 1];
    return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><path class="${animate ? 'anim-draw' : ''}" d="${d}" fill="none" stroke="${color}" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" pathLength="1" stroke-dasharray="1" style="--from:1; --delay:${delay}ms"/><circle cx="${last[0]}" cy="${last[1]}" r="2.5" fill="${color}"/></svg>`;
  }

  /* Accessible table view for a chart, visually hidden */
  const srTable = (caption, heads, rows) => `<table class="sr-only"><caption>${esc(caption)}</caption><thead><tr>${heads.map((h) => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;

  /* ============================================================ overlays */
  const Drawer = (() => {
    let layer, lastFocus, closeTimer, onCloseCb;
    const build = () => {
      layer = document.createElement('div');
      layer.className = 'drawer-layer';
      layer.hidden = true;
      layer.innerHTML = `<div class="scrim" data-close></div>
        <section class="drawer" role="dialog" aria-modal="true" aria-labelledby="dw-title" tabindex="-1">
          <header class="drawer-head"><div class="titles"><div class="eyebrow" id="dw-eyebrow"></div><h2 class="drawer-title" id="dw-title"></h2></div>
          <button class="icon-btn" type="button" data-close aria-label="Close panel">${ic('x')}</button></header>
          <div class="drawer-body"></div><footer class="drawer-foot"></footer>
        </section>`;
      document.body.append(layer);
      layer.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) close(); });
      layer.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { e.stopPropagation(); close(); return; }
        if (e.key !== 'Tab') return;
        const f = $$('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])', $('.drawer', layer)).filter((el) => el.offsetParent !== null);
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      });
    };
    const open = ({ eyebrow = '', title, body, foot = '', wide = false, onMount, onClose }) => {
      if (!layer) build();
      clearTimeout(closeTimer);
      const wasOpen = layer.classList.contains('open');
      if (!wasOpen) lastFocus = document.activeElement;
      onCloseCb = onClose;
      $('#dw-eyebrow', layer).textContent = eyebrow;
      $('#dw-title', layer).textContent = title;
      $('.drawer-body', layer).innerHTML = body;
      const footEl = $('.drawer-foot', layer);
      footEl.innerHTML = foot; footEl.hidden = !foot;
      $('.drawer', layer).classList.toggle('wide', wide);
      $('.drawer-body', layer).scrollTop = 0;
      $('.shell').inert = true;
      layer.classList.remove('closing');
      layer.hidden = false;
      if (!wasOpen) { void layer.offsetHeight; layer.classList.add('open'); }
      else { const st = $('.d-stagger', layer); if (st) { st.style.animation = 'none'; void st.offsetHeight; st.style.animation = ''; } }
      onMount && onMount($('.drawer', layer));
      setTimeout(() => $('.drawer', layer).focus({ preventScroll: true }), 40);
    };
    const close = () => {
      if (!layer || !layer.classList.contains('open')) return;
      layer.classList.add('closing');
      layer.classList.remove('open');
      $('.shell').inert = false;
      closeTimer = setTimeout(() => { layer.hidden = true; layer.classList.remove('closing'); }, RM ? 0 : 280);
      onCloseCb && onCloseCb();
      if (lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
    };
    return { open, close };
  })();

  const Menu = (() => {
    let trigger = null;
    const el = () => $('.menu');
    const close = (restore = true) => {
      const m = el();
      if (!m || !m.classList.contains('open')) return;
      m.classList.remove('open'); m.setAttribute('aria-hidden', 'true');
      trigger?.setAttribute('aria-expanded', 'false');
      trigger?.closest('.txl')?.classList.remove('menu-open');
      if (restore) trigger?.focus({ preventScroll: true });
      trigger = null;
    };
    const open = (btn, items) => {
      const m = el();
      if (trigger === btn) { close(); return; }
      close(false);
      trigger = btn;
      m.innerHTML = items.map((it, i) => (it === 'sep' ? '<hr>' : `<button type="button" role="menuitem" tabindex="-1" data-i="${i}" class="${it.danger ? 'danger' : ''}">${ic(it.icon)}<span>${esc(it.label)}</span>${it.kbd ? `<kbd>${esc(it.kbd)}</kbd>` : ''}</button>`)).join('');
      const r = btn.getBoundingClientRect();
      m.style.visibility = 'hidden'; m.classList.add('open');
      const mh = m.offsetHeight, mw = m.offsetWidth;
      m.classList.remove('open'); m.style.visibility = '';
      const below = r.bottom + 6 + mh < innerHeight;
      m.style.top = `${below ? r.bottom + 6 : r.top - mh - 6}px`;
      m.style.left = `${clamp(r.right - mw, 8, innerWidth - mw - 8)}px`;
      m.style.transformOrigin = `${below ? 'top' : 'bottom'} right`;
      void m.offsetHeight;
      m.classList.add('open'); m.setAttribute('aria-hidden', 'false');
      btn.setAttribute('aria-expanded', 'true');
      btn.closest('.txl')?.classList.add('menu-open');
      $$('button', m).forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); const it = items[+b.dataset.i]; close(false); it.action(); }));
      $('button', m)?.focus({ preventScroll: true });
    };
    document.addEventListener('keydown', (e) => {
      const m = el();
      if (!m || !m.classList.contains('open')) return;
      const btns = $$('button', m);
      const i = btns.indexOf(document.activeElement);
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); btns[(i + 1) % btns.length].focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); btns[(i - 1 + btns.length) % btns.length].focus(); }
      else if (e.key === 'Tab') close(false);
    });
    document.addEventListener('pointerdown', (e) => { if (!e.target.closest('.menu') && !e.target.closest('[aria-haspopup="menu"]')) close(false); });
    addEventListener('scroll', () => close(false), { passive: true });
    return { open, close };
  })();

  function toast(msg, { action, icon = 'check-circle' } = {}) {
    const region = $('.toast-region');
    const t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = `${ic(icon, icon === 'check-circle' ? 't-ok' : '')}<span class="msg"></span>${action ? `<button class="link" type="button">${ic('undo', 'ic-sm')} ${esc(action.label)}</button>` : ''}<button class="icon-btn" type="button" aria-label="Dismiss">${ic('x', 'ic-sm')}</button>`;
    $('.msg', t).textContent = msg;
    const dismiss = () => { t.classList.add('leaving'); setTimeout(() => t.remove(), RM ? 0 : 220); };
    if (action) $('.link', t).addEventListener('click', () => { action.fn(); dismiss(); });
    $('.icon-btn', t).addEventListener('click', dismiss);
    region.append(t);
    while (region.children.length > 3) region.firstElementChild.remove();
    if (!action) setTimeout(dismiss, 4000); // plain confirmations auto-dismiss, actionable ones wait for the user
    return t;
  }

  /* Segmented control with a spring thumb */
  const segHtml = (name, opts, value, label) => `<div class="seg" role="group" aria-label="${esc(label)}" data-seg="${name}"><span class="seg-thumb" aria-hidden="true"></span>${opts.map(([v, l]) => `<button type="button" data-v="${v}" aria-pressed="${v === value}">${esc(l)}</button>`).join('')}</div>`;
  function initSeg(el, onChange) {
    const thumb = $('.seg-thumb', el);
    const place = (instant) => {
      const b = $('button[aria-pressed="true"]', el);
      if (!b) return;
      if (instant) el.classList.add('no-anim');
      thumb.style.width = `${b.offsetWidth}px`;
      thumb.style.transform = `translateX(${b.offsetLeft}px)`;
      if (instant) { void thumb.offsetWidth; el.classList.remove('no-anim'); }
    };
    place(true);
    el.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b || b.getAttribute('aria-pressed') === 'true') return;
      $$('button', el).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      place(false);
      onChange && onChange(b.dataset.v);
    });
    addEventListener('resize', () => place(true));
    return place;
  }

  const needsBackend = (what) => `<span class="needs-backend" title="${esc(what)}">${ic('plug')}Needs backend</span>`;

  /* ======================================================== shared forms */
  const acctOptions = (sel) => M.accounts.map((a) => `<option value="${a.id}" ${a.id === sel ? 'selected' : ''}>${esc(a.name)} (${a.currency})</option>`).join('');
  const catOptions = (sel) => `<option value="">Uncategorised</option>` + M.categories.map((c) => `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>${esc(c.name)}</option>`).join('');
  const personOptions = (sel) => `<option value="">No split</option>` + M.people.map((p) => `<option ${p.name === sel ? 'selected' : ''}>${esc(p.name)}</option>`).join('');

  function openTxForm(t = null, mode = 'add') {
    const isEdit = mode === 'edit';
    const split = t?.splits?.[0];
    Drawer.open({
      eyebrow: isEdit ? 'Edit transaction' : 'New transaction',
      title: isEdit ? t.title : 'Add a transaction',
      body: `<form class="form-grid d-stagger" id="tx-form" novalidate>
        <div class="field full" style="--i:0"><label for="f-title">Title</label><input class="input" id="f-title" name="title" autocomplete="off" value="${esc(t?.title || '')}" placeholder="e.g. Albert Heijn"></div>
        <div class="field" style="--i:1"><label for="f-amt">Amount</label><div class="input-affix"><span class="affix">${t ? (txCur(t) === 'EUR' ? '€' : txCur(t)) : '€'}</span><input class="input" id="f-amt" name="amount" inputmode="decimal" value="${t ? Math.abs(t.amount).toFixed(2) : ''}" style="padding-inline-start:${t && txCur(t) !== 'EUR' ? 44 : 26}px"></div></div>
        <div class="field" style="--i:1"><span class="field-label" id="f-dir-l">Direction</span>${segHtml('dir', [['out', 'Money out'], ['in', 'Money in']], t && t.amount > 0 ? 'in' : 'out', 'Direction')}</div>
        <div class="field" style="--i:2"><label for="f-acct">Account</label><select class="select" id="f-acct">${acctOptions(t?.account_id || 'a-main')}</select></div>
        <div class="field" style="--i:2"><label for="f-cat">Category</label><select class="select" id="f-cat">${catOptions(t?.category_id)}</select></div>
        <div class="field" style="--i:3"><label for="f-date">Date</label><input class="input" type="date" id="f-date" value="${t?.date || TODAY}"></div>
        <div class="field" style="--i:3"><label for="f-split">Split with</label><select class="select" id="f-split">${personOptions(split?.person)}</select></div>
        <div class="field full" style="--i:4"><label for="f-notes">Notes</label><textarea class="input" id="f-notes" placeholder="Optional">${esc(t?.notes || '')}</textarea><span class="hint">Notes are searchable from the Transactions page.</span></div>
        <div class="field full" style="--i:5"><label class="switch"><input type="checkbox" ${t?.recurring ? 'checked' : ''}><span class="track"></span>Repeats every month</label></div>
      </form>`,
      foot: `<button class="btn btn-ghost" type="button" data-close>Cancel</button><button class="btn btn-primary" type="submit" form="tx-form">${isEdit ? 'Save changes' : 'Add transaction'}</button>`,
      onMount: (d) => {
        initSeg($('[data-seg="dir"]', d));
        $('#tx-form', d).addEventListener('submit', (e) => {
          e.preventDefault();
          const title = $('#f-title', d);
          if (!title.value.trim()) { title.setAttribute('aria-invalid', 'true'); title.focus(); title.style.boxShadow = 'inset 0 0 0 1px var(--neg), 0 0 0 3px var(--neg-soft)'; return; }
          Drawer.close();
          toast(isEdit ? 'Changes saved' : `Added "${title.value.trim()}"`);
        });
      },
    });
  }
  function openTransferForm(t = null) {
    const converting = !!t;
    Drawer.open({
      eyebrow: converting ? 'Convert to transfer' : 'New transfer',
      title: converting ? `Make "${t.title}" a transfer` : 'Move money between accounts',
      body: `<form class="form-grid d-stagger" id="tr-form">
        ${converting ? `<div class="well full" style="--i:0; display:flex; gap:12px; align-items:center">${catIco(t.category_id, 'sm')}<div style="flex:1; min-width:0"><div style="font-weight:600">${esc(t.title)}</div><div class="muted" style="font-size:12.5px">${fmtDate(t.date, { month: 'short', day: 'numeric' })}, ${esc(M.acct(t.account_id).name)}</div></div><div class="amount">${signed(t.amount, txCur(t))}</div></div>` : ''}
        <div class="field" style="--i:1"><label for="t-from">From</label><select class="select" id="t-from">${acctOptions(t?.account_id || 'a-main')}</select></div>
        <div class="field" style="--i:1"><label for="t-to">To</label><select class="select" id="t-to">${acctOptions('a-save')}</select></div>
        <div class="field" style="--i:2"><label for="t-sent">Amount sent</label><div class="input-affix"><span class="affix">€</span><input class="input" id="t-sent" inputmode="decimal" value="${t ? Math.abs(t.amount).toFixed(2) : ''}"></div></div>
        <div class="field" style="--i:2"><label for="t-recv">Amount received</label><div class="input-affix"><span class="affix">€</span><input class="input" id="t-recv" inputmode="decimal" value="${t ? Math.abs(t.amount).toFixed(2) : ''}"></div><span class="hint">Differs from sent when there is a fee or discount.</span></div>
        <div class="field" style="--i:3"><label for="t-date">Date</label><input class="input" type="date" id="t-date" value="${t?.date || TODAY}"></div>
        ${converting ? `<div class="field full" style="--i:4"><span class="field-label">Other side</span><label class="check"><input type="radio" name="leg" checked><span class="box" style="border-radius:99px">${ic('check')}</span>Create the matching transaction</label><label class="check"><input type="radio" name="leg"><span class="box" style="border-radius:99px">${ic('check')}</span>Link an existing transaction</label></div>` : ''}
      </form>`,
      foot: `<button class="btn btn-ghost" type="button" data-close>Cancel</button><button class="btn btn-primary" type="submit" form="tr-form">${converting ? 'Convert' : 'Create transfer'}</button>`,
      onMount: (d) => $('#tr-form', d).addEventListener('submit', (e) => { e.preventDefault(); Drawer.close(); toast(converting ? 'Converted to a transfer' : 'Transfer created'); }),
    });
  }
  function openImport() {
    Drawer.open({
      eyebrow: 'Import',
      title: 'Import transactions from CSV',
      body: `<form class="d-stagger" id="im-form" style="display:grid; gap:16px">
        <div class="field" style="--i:0"><label for="im-acct">Into account</label><select class="select" id="im-acct">${acctOptions('a-main')}</select></div>
        <div class="field" style="--i:1"><label for="im-file">CSV file</label>
          <label class="dropzone" for="im-file">${ic('import', 'ic-lg')}<span><strong>Choose a file</strong> or drop it here</span><span class="hint">Columns: date, title, amount. Up to 5 MB.</span></label>
          <input class="sr-only" type="file" id="im-file" accept=".csv,text/csv"></div>
        <div class="well" style="--i:2; font-size:13px; color:var(--text-2); display:flex; gap:10px">${ic('sparkle', 'ic-sm')}<span>Duplicates are detected by date, amount and title, and skipped before anything is saved.</span></div>
      </form>`,
      foot: `<button class="btn btn-ghost" type="button" data-close>Cancel</button><button class="btn btn-primary" type="submit" form="im-form">Preview import</button>`,
      onMount: (d) => $('#im-form', d).addEventListener('submit', (e) => { e.preventDefault(); Drawer.close(); toast('Import queued as a background job'); }),
    });
  }
  function openMoreNav() {
    Drawer.open({
      eyebrow: 'Navigate',
      title: 'Master of Coin',
      body: `<nav aria-label="All pages" class="d-stagger" style="display:grid; gap:2px">${M.nav.map((n, i) => (NAV_HREF[n] ? `<a class="nav-item" style="--i:${i}" href="${NAV_HREF[n]}" ${PAGE_NAME[PAGE] === n ? 'aria-current="page"' : ''}>${ic(NAV_ICON[i])}<span>${n}</span></a>` : `<span class="nav-item" style="--i:${i}" aria-disabled="true">${ic(NAV_ICON[i])}<span>${n}</span></span>`)).join('')}</nav>
        <div class="user" style="margin-top:16px; border-top:1px solid var(--line); padding-top:14px"><span class="avatar" aria-hidden="true">${initials(M.user.name)}</span><div class="user-meta"><div class="user-name">${esc(M.user.name)}</div><div class="user-mail">${esc(M.user.email)}</div></div><span class="version" style="margin-inline-start:auto">v${esc(M.user.version)}</span></div>`,
    });
  }

  /* Global click delegation for shell actions */
  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-action]');
    if (!a) return;
    const act = a.dataset.action;
    if (act === 'theme') setTheme(root.dataset.theme === 'dark' ? 'light' : 'dark', a);
    else if (act === 'collapse') toggleSidebar(a);
    else if (act === 'add-tx') openTxForm();
    else if (act === 'transfer') openTransferForm();
    else if (act === 'import') openImport();
    else if (act === 'more-nav') openMoreNav();
    else if (act === 'cmdk') toast('The command menu is out of scope for this mock', { icon: 'search' });
  });

  const quickActions = () => `<div class="actions">
    <button class="btn" type="button" data-action="import">${ic('import')}Import</button>
    <button class="btn" type="button" data-action="transfer">${ic('transfer')}Transfer</button>
    <button class="btn btn-primary" type="button" data-action="add-tx">${ic('plus')}Add transaction</button></div>`;

  /* Shared transaction row (dashboard) */
  function txBadges(t) {
    const b = [];
    if (t.splits) t.splits.forEach((s) => b.push(`<span class="badge badge-split">${ic('split')}Split with ${esc(s.person)}</span>`));
    if (t.transfer) b.push(`<span class="badge">${ic('transfer')}To ${esc(t.transfer.linked)}</span>`);
    if (t.debt) b.push(`<span class="badge badge-debt">${ic('user')}Paid by ${esc(t.debt.paidBy)}</span>`);
    if (t.recurring) b.push(`<span class="badge">${ic('repeat')}Recurring</span>`);
    if (t.currency && t.currency !== 'EUR') b.push(`<span class="badge">${ic('globe')}${esc(t.currency)}</span>`);
    return b.join('');
  }
  function amountHtml(t) {
    const cur = txCur(t);
    const out = t.amount < 0;
    const sr = out ? 'Money out' : 'Money in';
    return `<div class="amount ${out ? '' : 'in'}"><span class="sr-only">${sr}, </span>${signed(t.amount, cur)}${cur !== 'EUR' ? `<span class="eq">${signed(txEur(t))}</span>` : ''}</div>`;
  }

  /* ========================================================== DASHBOARD */
  function pageDashboard() {
    const hist = M.netWorthHistory;
    const months = M.monthly.map((m) => m.m);
    const nwPct = (nwDelta / nwPrev) * 100;
    const byPct = [...M.budgets].sort((a, b) => pctUsed(b) - pctUsed(a));
    const statusCounts = M.budgets.reduce((acc, b) => ((acc[statusOf(b)] = (acc[statusOf(b)] || 0) + 1), acc), {});
    const breakdown = M.categoryBreakdown.map((c) => {
      const cat = M.cat(c.category_id);
      return { ...c, name: cat ? cat.name : 'Other', color: cat ? cat.color : 'var(--line-strong)', cat };
    });
    const spendTotal = sum(breakdown.map((b) => b.total));
    const recent = M.transactions.slice(0, 7);
    const avgSaved = sum(M.monthly.map((m) => m.income - m.spend)) / M.monthly.length;
    const rate = (sum(M.monthly.map((m) => m.income - m.spend)) / sum(M.monthly.map((m) => m.income))) * 100;
    const owedToMe = sum(M.people.map((p) => p.owes_me)), iOwe = sum(M.people.map((p) => p.i_owe));
    const maxDebt = Math.max(...M.people.map((p) => Math.max(p.owes_me, p.i_owe)));
    const top = breakdown.filter((b) => b.cat).slice(0, 5);

    const sheetGroups = GROUPS.map((g) => ({ ...g, accts: groupAccounts(g), total: sum(groupAccounts(g).map(M.toEur)) })).filter((g) => g.accts.length);
    const assetGroups = sheetGroups.filter((g) => !g.liability);

    const html = `
      <div class="page-head rise" style="--i:0">
        <div><div class="eyebrow">${fmtDate(TODAY, { weekday: 'long', month: 'long', day: 'numeric' })}</div><h1 class="page-title" style="margin-top:6px">Dashboard</h1></div>
        ${quickActions()}
      </div>
      <div class="grid">
        <section class="card hero span-8 rise" style="--i:1" aria-labelledby="nw-title">
          <div class="hero-top">
            <div>
              <div class="stat-label" id="nw-title">Net worth ${ic('clock', 'ic-xs')}<span>in EUR, all accounts</span></div>
              <div class="hero-figure" id="nw-figure" aria-live="off">${heroMoney(M.netWorth)}</div>
              <div class="hero-delta">
                <span class="chip chip-pos">${ic('trend-up')}${signed(nwDelta)}</span>
                <span><strong class="pos">+${pct(nwPct)}</strong> since August</span>
              </div>
            </div>
            <div class="hero-kpis">
              <div class="kpi"><div class="stat-label">${ic('arrow-in', 'ic-xs')}Assets</div><div class="stat-value">${money(assets)}</div></div>
              <div class="kpi"><div class="stat-label">${ic('arrow-out', 'ic-xs')}Liabilities</div><div class="stat-value">${money(liabilities)}</div></div>
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:10px; margin-top:18px">
            <span class="card-sub">Last 12 months</span>${needsBackend('Net worth history has no backend route yet')}
            <span class="spacer" style="flex:1"></span>
            ${segHtml('nw-range', [['6', '6M'], ['12', '1Y']], '12', 'Net worth range')}
          </div>
          <div class="chart hero-chart" id="nw-chart" aria-describedby="nw-sum"></div>
          <p class="sr-only" id="nw-sum">Net worth rose from ${money(hist[0])} in ${months[0]} to ${money(M.netWorth)} in ${months[11]}. Use left and right arrow keys to step through months.</p>
          ${srTable('Net worth by month', ['Month', 'Net worth'], hist.map((v, i) => [months[i], money(v)]))}
        </section>

        <section class="card span-4 rise" style="--i:2" aria-labelledby="bs-title">
          <div class="card-head"><h2 class="card-title" id="bs-title">Balance sheet</h2><span class="spacer"></span><a class="card-link" href="accounts.html">Accounts ${ic('chev-r', 'ic-xs')}</a></div>
          <div style="display:flex; justify-content:space-between; gap:12px">
            <div><div class="stat-label"><span class="key-rect" style="background:var(--chart-1)"></span>Assets</div><div class="stat-value sm">${money(assets)}</div></div>
            <div style="text-align:end"><div class="stat-label" style="justify-content:flex-end"><span class="key-rect" style="background:var(--neg)"></span>Liabilities</div><div class="stat-value sm">${money(liabilities)}</div></div>
          </div>
          <div class="sheet-bar" role="img" aria-label="Assets ${money(assets)} against liabilities ${money(liabilities)}">
            ${assetGroups.map((g) => `<span class="anim-grow-x-el ${ENTERED || RM ? '' : ''}" style="flex:${g.total}; background:${GROUP_COLOR[g.id]}; --delay:350ms" title="${esc(g.name)}"></span>`).join('')}
            <span style="flex:${-liabilities}; background:var(--neg)" title="Liabilities"></span>
          </div>
          <div>
            ${sheetGroups.map((g) => `<div class="sheet-row">
              <span class="acct-ico">${ic(g.icon)}</span>
              <span class="name"><span style="font-weight:560">${g.name}</span><small>${g.accts.length} ${g.accts.length === 1 ? 'account' : 'accounts'}${g.liability ? ', liability' : ''}</small></span>
              <span class="amt ${g.liability ? 'neg' : ''}">${money(g.total)}</span></div>`).join('')}
          </div>
        </section>

        <section class="card span-8 rise" style="--i:3" aria-labelledby="cf-title">
          <div class="card-head" style="flex-wrap:wrap">
            <h2 class="card-title" id="cf-title">Income and spending</h2>${needsBackend('Monthly spending trend has no backend route yet')}
            <span class="spacer"></span>
            <div class="legend"><span><span class="key-rect" style="background:var(--chart-1)"></span>Income</span><span><span class="key-rect" style="background:var(--chart-2)"></span>Spend</span></div>
          </div>
          <div style="display:flex; gap:28px; margin-bottom:10px; flex-wrap:wrap">
            <div><div class="stat-label">Average saved per month</div><div class="stat-value sm">${money(avgSaved)}</div></div>
            <div><div class="stat-label">Savings rate, 12 months</div><div class="stat-value sm">${pct(rate)}</div></div>
            <div><div class="stat-label">September net</div><div class="stat-value sm pos">${signed(M.monthly[11].income - M.monthly[11].spend)}</div></div>
          </div>
          <div class="chart" id="cf-chart" style="height:210px" aria-describedby="cf-sum"></div>
          <p class="sr-only" id="cf-sum">Income and spend for the last 12 months. Spend peaked in December at ${money(5210)}. Use arrow keys to step through months.</p>
          ${srTable('Income and spend by month', ['Month', 'Income', 'Spend'], M.monthly.map((m) => [m.m, money(m.income), money(m.spend)]))}
        </section>

        <section class="card span-4 rise" style="--i:4" aria-labelledby="bu-title">
          <div class="card-head"><h2 class="card-title" id="bu-title">Budgets</h2><span class="spacer"></span><a class="card-link" href="budgets.html">All budgets ${ic('chev-r', 'ic-xs')}</a></div>
          <div class="legend" style="margin-bottom:6px">
            <span>${ic('check-circle', 'ic-sm pos')}${statusCounts.OK || 0} on track</span><span>${ic('alert', 'ic-sm warn')}${statusCounts.WARNING || 0} warning</span><span>${ic('alert-circle', 'ic-sm neg')}${statusCounts.EXCEEDED || 0} exceeded</span>
          </div>
          ${byPct.slice(0, 4).map((b, i) => {
            const s = statusOf(b), p = pctUsed(b);
            return `<a class="budget-mini" href="budgets.html?open=${b.id}">
              <div class="ring" style="width:48px;height:48px">${ringSvg(p, 48, 5, STATUS[s].color, !RM, 400 + i * 80)}<span class="ring-label" style="font-size:10.5px; letter-spacing:-0.02em">${Math.round(p)}%</span></div>
              <div style="min-width:0"><div class="nm">${esc(b.name)}</div><div class="sub">${money(b.spent)} of ${money(b.limit, 'EUR', { maximumFractionDigits: 0 })}, ${PERIOD_LABEL[b.period].toLowerCase()}</div></div>
              ${statusChip(s)}</a>`;
          }).join('')}
        </section>

        <section class="card span-5 rise card-col" style="--i:5" aria-labelledby="sc-title">
          <div class="card-head"><h2 class="card-title" id="sc-title">Spending by category</h2><span class="spacer"></span><span class="card-sub">September</span></div>
          <div class="donut-wrap">
            <div class="donut" id="donut">
              ${donutSvg(breakdown.map((b) => ({ value: b.total, color: b.color })), 184, 20, !RM, `Spending by category, total ${money(spendTotal)}`)}
              <div class="donut-center"><div class="stat-label" style="justify-content:center" id="donut-lbl">Total spent</div><div class="stat-value" id="donut-val">${money(spendTotal, 'EUR', { maximumFractionDigits: 0 })}</div></div>
            </div>
            <ul class="cat-legend" id="cat-legend">
              ${breakdown.map((b, i) => `<li data-i="${i}" tabindex="0"><span class="key-rect" style="background:${b.color}"></span><span>${esc(b.name)}</span><span class="amt">${money(b.total, 'EUR', { maximumFractionDigits: 0 })}</span><span class="pct">${pct(b.percentage)}</span></li>`).join('')}
            </ul>
          </div>
          <div class="insight">
            <div><div class="stat-label">Daily average</div><div class="stat-value sm">${money(spendTotal / 25)}</div></div>
            <div><div class="stat-label">Versus August</div><div class="stat-value sm">${signed(spendTotal - M.monthly[10].spend)}</div></div>
            <div><div class="stat-label">Rent and travel</div><div class="stat-value sm">${pct(breakdown[0].percentage + breakdown[1].percentage, 0)}</div></div>
          </div>
        </section>

        <section class="card span-7 rise" style="--i:6" aria-labelledby="rt-title">
          <div class="card-head"><h2 class="card-title" id="rt-title">Recent transactions</h2><span class="spacer"></span><a class="card-link" href="transactions.html">View all ${ic('chev-r', 'ic-xs')}</a></div>
          <div>
            ${recent.map((t) => `<a class="tx-row clickable" href="transactions.html?open=${t.id}">
              ${catIco(t.category_id, '', { transfer: !!t.transfer })}
              <div style="min-width:0"><div class="t-title">${esc(t.title)}</div>
                <div class="t-meta"><span>${esc(catName(t))}</span><span class="sep"></span><span>${esc(M.acct(t.account_id).name)}</span><span class="sep"></span><span>${fmtDate(t.date, { month: 'short', day: 'numeric' })}</span>${t.splits ? `<span class="badge badge-split">${ic('split')}${esc(t.splits[0].person)}</span>` : ''}${t.recurring ? `<span class="badge">${ic('repeat')}Recurring</span>` : ''}</div></div>
              ${amountHtml(t)}</a>`).join('')}
          </div>
        </section>

        <section class="card span-6 rise" style="--i:7" aria-labelledby="tc-title">
          <div class="card-head"><h2 class="card-title" id="tc-title">Top spending categories</h2><span class="spacer"></span><span class="card-sub">Share of September spend</span></div>
          <ol class="rank">
            ${top.map((b, i) => `<li>${catIco(b.category_id, 'sm')}<div><div class="nm"><span>${esc(b.name)}</span><span>${money(b.total)}</span></div><div class="bar-track"><span class="bar-fill ${RM ? '' : 'anim-grow-x-el'}" style="width:${(b.total / top[0].total) * 100}%; background:${b.color}; --delay:${500 + i * 70}ms"></span></div></div><span class="muted" style="font-size:12.5px; width:44px; text-align:end">${pct(b.percentage)}</span></li>`).join('')}
          </ol>
        </section>

        <section class="card span-6 rise" style="--i:8" aria-labelledby="db-title">
          <div class="card-head"><h2 class="card-title" id="db-title">Debts with people</h2><span class="spacer"></span><span class="card-sub">Net ${signed(owedToMe - iOwe)}</span></div>
          <div class="debt-summary">
            <div class="kpi"><div class="stat-label">${ic('arrow-in', 'ic-xs')}Owed to you</div><div class="stat-value sm pos">${money(owedToMe)}</div></div>
            <div class="kpi"><div class="stat-label">${ic('arrow-out', 'ic-xs')}You owe</div><div class="stat-value sm neg">${money(iOwe)}</div></div>
          </div>
          <ul class="debt-list" style="margin-top:6px">
            ${M.people.map((p) => {
              const owes = p.owes_me > 0;
              const v = owes ? p.owes_me : p.i_owe;
              const w = (v / maxDebt) * 100;
              return `<li><span class="avatar" aria-hidden="true" style="width:34px;height:34px">${initials(p.name)}</span>
                <div><div style="display:flex; justify-content:space-between; gap:8px; font-size:13.5px"><span style="font-weight:580">${esc(p.name)}</span><span class="${owes ? 'pos' : 'neg'}" style="font-weight:620">${owes ? 'Owes you' : 'You owe'} ${money(v)}</span></div>
                <div class="debt-bar" aria-hidden="true"><span class="l ${RM ? '' : 'anim-grow-x-el'}" style="width:${owes ? 0 : w}%; transform-origin:100% 50%; --delay:600ms"></span><span class="axis"></span><span class="r ${RM ? '' : 'anim-grow-x-el'}" style="width:${owes ? w : 0}%; --delay:600ms"></span></div></div>
                <button class="btn btn-sm" type="button" data-settle="${esc(p.name)}">Settle</button></li>`;
            }).join('')}
          </ul>
        </section>
      </div>`;
    renderShell(html);

    let range = 12;
    const nwHost = $('#nw-chart');
    const drawNw = () => areaChart(nwHost, {
      id: 'nw', values: hist.slice(-range), labels: months.slice(-range), color: 'var(--chart-1)', seriesName: 'Net worth',
      label: `Net worth, last ${range} months`, delay: 350, tipTitle: (i) => `${months.slice(-range)[i]} ${i + (12 - range) >= 3 ? 2026 : 2025}`,
    });
    drawNw();
    initSeg($('[data-seg="nw-range"]'), (v) => { range = +v; charts.length = 0; ENTERED = true; drawNw(); drawCf(); });
    const drawCf = () => groupedBars($('#cf-chart'), {
      labels: months, label: 'Income and spend by month',
      series: [{ name: 'Income', values: M.monthly.map((m) => m.income), color: 'var(--chart-1)' }, { name: 'Spend', values: M.monthly.map((m) => m.spend), color: 'var(--chart-2)' }],
      extra: (i) => ({ name: 'Saved', value: signed(M.monthly[i].income - M.monthly[i].spend) }),
      tipTitle: (i) => `${months[i]} ${i >= 3 ? 2026 : 2025}`,
    });
    drawCf();
    countUp($('#nw-figure'), M.netWorth, heroMoney, 1100, 300);

    // Donut and legend cross-highlight (quiet, no motion beyond opacity)
    const legend = $('#cat-legend'), donut = $('#donut');
    const hl = (i) => {
      $$('li', legend).forEach((li) => li.classList.toggle('dim', i !== null && +li.dataset.i !== i));
      $$('.seg-arc', donut).forEach((c) => (c.style.opacity = i === null || +c.dataset.i === i ? 1 : 0.25));
      $('#donut-lbl').textContent = i === null ? 'Total spent' : breakdown[i].name;
      $('#donut-val').textContent = money(i === null ? spendTotal : breakdown[i].total, 'EUR', { maximumFractionDigits: 0 });
    };
    $$('li', legend).forEach((li) => { li.addEventListener('pointerenter', () => hl(+li.dataset.i)); li.addEventListener('focus', () => hl(+li.dataset.i)); li.addEventListener('blur', () => hl(null)); });
    legend.addEventListener('pointerleave', () => hl(null));
    $$('.seg-arc', donut).forEach((c) => { c.addEventListener('pointerenter', () => hl(+c.dataset.i)); c.addEventListener('pointerleave', () => hl(null)); });
    $$('[data-settle]').forEach((b) => b.addEventListener('click', () => toast(`Settle up with ${b.dataset.settle} recorded`)));
  }

  /* ======================================================= TRANSACTIONS */
  function pageTransactions() {
    const TOTAL = 214; // real total count reported by the API for this month
    let txs = M.transactions.map((t) => ({ ...t }));
    const selected = new Set((params.get('select') || '').split(',').filter(Boolean));
    const expanded = new Set();
    let mockState = params.get('state') || 'live';
    const F = { q: '', account: '', category: '', person: '', from: '', to: '', min: '', max: '', sign: 'all', splits: false, transfer: false };
    const sep = M.monthly[11];
    const net = sep.income - sep.spend;

    // Daily spend for the month: known transactions per day plus a deterministic
    // spread of the unseen remainder (the list only holds 15 of 214 rows).
    const daily = (() => {
      const days = Array.from({ length: 30 }, () => 0);
      txs.filter((t) => t.amount < 0 && !t.transfer).forEach((t) => { days[+t.date.slice(8) - 1] += -txEur(t); });
      const known = sum(days);
      const rest = Math.max(0, sep.spend - known);
      const w = days.map((_, i) => (i < 25 ? 0.4 + ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1 : 0));
      const ws = sum(w);
      return days.map((d, i) => d + (i < 25 ? (rest * w[i]) / ws : 0));
    })();

    const html = `
      <div class="page-head rise" style="--i:0">
        <div><h1 class="page-title">Transactions</h1><p class="page-sub">Every account, one list. Search covers titles and notes.</p></div>
        <div class="actions">
          <button class="btn" type="button" data-action="import">${ic('import')}Import CSV</button>
          <button class="btn" type="button" data-action="transfer">${ic('transfer')}Transfer</button>
          <button class="btn btn-primary" type="button" data-action="add-tx">${ic('plus')}Add transaction</button>
        </div>
      </div>
      <section class="card month-bar rise" style="--i:1" aria-label="Month summary">
        <div class="month-nav">
          <button class="icon-btn raised" type="button" id="m-prev" aria-label="Previous month, August 2026">${ic('chev-l')}</button>
          <div class="month-label" aria-live="polite" id="m-label">September 2026</div>
          <button class="icon-btn raised" type="button" id="m-next" aria-label="Next month" disabled style="opacity:.45">${ic('chev-r')}</button>
        </div>
        <div class="chart daily" id="daily" aria-hidden="true"></div>
        <dl class="month-stats">
          <div><dt class="stat-label">${ic('arrow-in', 'ic-xs')}Income</dt><dd class="stat-value pos">${signed(sep.income)}</dd></div>
          <div><dt class="stat-label">${ic('arrow-out', 'ic-xs')}Spend</dt><dd class="stat-value">${signed(-sep.spend)}</dd></div>
          <div><dt class="stat-label">Net</dt><dd class="stat-value ${net >= 0 ? 'pos' : 'neg'}">${signed(net)}</dd></div>
        </dl>
      </section>

      <div class="toolbar rise" style="--i:2">
        <div class="field"><label for="q">Search</label><div class="input-icon">${ic('search', 'ic-sm')}<input class="input" id="q" type="search" placeholder="Title or notes" autocomplete="off"></div></div>
        <button class="btn" type="button" id="toggle-filters" aria-expanded="true" aria-controls="filters">${ic('filter')}Filters <span class="chip chip-accent" id="f-count" hidden style="height:18px; padding-inline:6px"></span></button>
        <div class="field" style="flex:0 0 170px"><label for="mock-state">Preview state</label><select class="select" id="mock-state">
          <option value="live">Live data</option><option value="loading">Loading</option><option value="empty">Empty</option><option value="error">Error</option></select></div>
      </div>

      <section class="card filters-panel rise" style="--i:3" id="filters" aria-label="Filters">
        <div class="filters-grid">
          <div class="field"><label for="f-account">Account</label><select class="select" id="f-account"><option value="">All accounts</option>${M.accounts.map((a) => `<option value="${a.id}">${esc(a.name)}</option>`).join('')}</select></div>
          <div class="field"><label for="f-category">Category</label><select class="select" id="f-category"><option value="">All categories</option><option value="none">Uncategorised</option>${M.categories.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></div>
          <div class="field"><label for="f-person">Person</label><select class="select" id="f-person"><option value="">Anyone</option>${M.people.map((p) => `<option>${esc(p.name)}</option>`).join('')}</select></div>
          <div class="field"><label for="f-from">From</label><input class="input" type="date" id="f-from" min="2026-09-01" max="2026-09-30"></div>
          <div class="field"><label for="f-to">To</label><input class="input" type="date" id="f-to" min="2026-09-01" max="2026-09-30"></div>
          <div class="field"><span class="field-label">Direction</span>${segHtml('sign', [['all', 'All'], ['in', 'In'], ['out', 'Out']], 'all', 'Direction')}</div>
          <div class="field"><label for="f-min">Min amount</label><div class="input-affix"><span class="affix">€</span><input class="input" id="f-min" inputmode="decimal" placeholder="0"></div></div>
          <div class="field"><label for="f-max">Max amount</label><div class="input-affix"><span class="affix">€</span><input class="input" id="f-max" inputmode="decimal" placeholder="Any"></div></div>
          <div class="field col-2" style="align-content:end"><div style="display:flex; gap:20px; flex-wrap:wrap">
            <label class="switch"><input type="checkbox" id="f-splits"><span class="track"></span>Has splits</label>
            <label class="switch"><input type="checkbox" id="f-transfer"><span class="track"></span>In a transfer</label></div></div>
          <div class="field col-2" style="align-content:end; justify-items:end"><button class="btn btn-ghost" type="button" id="f-reset">${ic('x', 'ic-sm')}Clear all</button></div>
        </div>
      </section>
      <div class="active-filters" id="pills" aria-live="polite"></div>

      <section class="card list-card rise" style="--i:4" aria-labelledby="list-title">
        <h2 class="sr-only" id="list-title">Transaction list</h2>
        <div class="list-head">
          <label class="check t-sel" title="Select all in view"><input type="checkbox" id="sel-all" aria-label="Select all transactions in view"><span class="box">${ic('check')}</span></label>
          <span class="count" id="count" role="status"></span>
          <span style="flex:1"></span>
          <span class="card-sub">Newest first</span>
        </div>
        <div id="list"></div>
        <div class="list-foot" id="foot"></div>
      </section>
      <div class="bulk-bar" id="bulk" role="region" aria-label="Bulk actions">
        <span class="count" id="bulk-count"></span>
        <button class="btn btn-sm" type="button" id="bulk-cat">${ic('tag')}Categorise</button>
        <button class="btn btn-sm btn-danger" type="button" id="bulk-del">${ic('trash')}Delete</button>
        <button class="icon-btn sm" type="button" id="bulk-clear" aria-label="Clear selection" style="color:#a8afbc">${ic('x')}</button>
      </div>`;
    renderShell(html);

    // Daily spend mini columns
    const dailyHost = $('#daily');
    registerChart((animate) => {
      const W = dailyHost.clientWidth, H = 44;
      if (!W) return;
      const max = Math.sqrt(Math.max(...daily));
      const bw = Math.min(10, W / 30 - 3);
      const gap = (W - bw * 30) / 29;
      const bars = daily.map((v, i) => {
        const h = i < 25 ? Math.max(3, (Math.sqrt(v) / max) * (H - 4)) : 3;
        const x = i * (bw + gap);
        return `<rect class="${animate ? 'anim-grow-y' : ''}" x="${x.toFixed(1)}" y="${H - h}" width="${bw.toFixed(1)}" height="${h}" rx="2" fill="${i === 24 ? 'var(--accent)' : i < 25 ? 'var(--chart-2)' : 'var(--surface-3)'}" opacity="${i < 25 && i !== 24 ? 0.55 : 1}" style="--delay:${250 + i * 18}ms"><title>Sep ${i + 1}: ${money(v)}</title></rect>`;
      }).join('');
      dailyHost.innerHTML = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true">${bars}</svg>`;
    });

    const filtersEl = $('#filters');
    const toggleBtn = $('#toggle-filters');
    const setFiltersOpen = (open) => { filtersEl.hidden = !open; toggleBtn.setAttribute('aria-expanded', String(open)); };
    setFiltersOpen(innerWidth > 760 && params.get('filters') !== '0');
    toggleBtn.addEventListener('click', () => setFiltersOpen(filtersEl.hidden));
    const signSeg = $('[data-seg="sign"]');
    const placeSign = initSeg(signSeg, (v) => { F.sign = v; draw(); });

    const matches = (t) => {
      const q = F.q.trim().toLowerCase();
      if (q && !(`${t.title} ${t.notes || ''}`.toLowerCase().includes(q))) return false;
      if (F.account && t.account_id !== F.account) return false;
      if (F.category === 'none' && (t.category_id || t.transfer)) return false;
      if (F.category && F.category !== 'none' && t.category_id !== F.category) return false;
      if (F.person && !((t.splits || []).some((s) => s.person === F.person) || t.debt?.paidBy === F.person)) return false;
      if (F.from && t.date < F.from) return false;
      if (F.to && t.date > F.to) return false;
      const abs = Math.abs(txEur(t));
      if (F.min !== '' && !isNaN(+F.min) && abs < +F.min) return false;
      if (F.max !== '' && !isNaN(+F.max) && abs > +F.max) return false;
      if (F.sign === 'in' && t.amount <= 0) return false;
      if (F.sign === 'out' && t.amount >= 0) return false;
      if (F.splits && !t.splits) return false;
      if (F.transfer && !t.transfer) return false;
      return true;
    };
    const activeFilters = () => {
      const a = [];
      if (F.q) a.push(['q', `Search: ${F.q}`]);
      if (F.account) a.push(['account', M.acct(F.account).name]);
      if (F.category) a.push(['category', F.category === 'none' ? 'Uncategorised' : M.cat(F.category).name]);
      if (F.person) a.push(['person', `With ${F.person}`]);
      if (F.from) a.push(['from', `From ${fmtDate(F.from, { month: 'short', day: 'numeric' })}`]);
      if (F.to) a.push(['to', `Until ${fmtDate(F.to, { month: 'short', day: 'numeric' })}`]);
      if (F.min) a.push(['min', `At least ${money(+F.min)}`]);
      if (F.max) a.push(['max', `At most ${money(+F.max)}`]);
      if (F.sign !== 'all') a.push(['sign', F.sign === 'in' ? 'Money in' : 'Money out']);
      if (F.splits) a.push(['splits', 'Has splits']);
      if (F.transfer) a.push(['transfer', 'In a transfer']);
      return a;
    };
    const resetKey = (k) => {
      if (k === 'sign') { F.sign = 'all'; $$('button', signSeg).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === 'all'))); placeSign(false); }
      else if (k === 'splits' || k === 'transfer') { F[k] = false; $(`#f-${k}`).checked = false; }
      else { F[k] = ''; const el = k === 'q' ? $('#q') : $(`#f-${k}`); if (el) el.value = ''; }
    };

    const rowHtml = (t) => {
      const acct = M.acct(t.account_id);
      const sel = selected.has(t.id);
      const canExpand = !!(t.splits || t.debt || t.transfer);
      const isExp = expanded.has(t.id);
      return `<div class="txl ${sel ? 'selected' : ''}" data-id="${t.id}" ${canExpand ? `aria-expanded="${isExp}"` : ''}>
        <label class="check t-sel" data-stop><input type="checkbox" ${sel ? 'checked' : ''} aria-label="Select ${esc(t.title)}"><span class="box">${ic('check')}</span></label>
        ${catIco(t.category_id, '', { transfer: !!t.transfer })}
        <div style="min-width:0">
          <div class="t-title"><button class="t-open" type="button" data-open style="all:unset; cursor:pointer; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; border-radius:4px">${esc(t.title)}</button>${t.notes ? `<span class="note-ic" title="Note: ${esc(t.notes)}">${ic('note', 'ic-sm')}<span class="sr-only">Has notes</span></span>` : ''}</div>
          <div class="t-badges">${txBadges(t) || `<span class="t-acct" style="display:none"></span>`}</div>
        </div>
        <div class="t-catcol" style="min-width:0"><div class="t-cat">${esc(catName(t))}</div><div class="t-acct">${esc(acct.name)}</div></div>
        ${amountHtml(t)}
        <div class="row-actions" data-stop>
          ${canExpand ? `<button class="icon-btn sm expand-btn" type="button" data-expand aria-label="${isExp ? 'Hide' : 'Show'} details for ${esc(t.title)}">${ic('chev-d', 'ic-sm')}</button>` : '<span style="width:28px"></span>'}
          <button class="icon-btn sm" type="button" data-menu aria-haspopup="menu" aria-expanded="false" aria-label="Actions for ${esc(t.title)}">${ic('more')}</button>
        </div>
      </div>
      ${canExpand && isExp ? `<div class="tx-expand"><div class="inner">${expandHtml(t)}</div></div>` : ''}`;
    };
    const expandHtml = (t) => {
      const cur = txCur(t);
      if (t.splits) {
        const others = sum(t.splits.map((s) => s.amount));
        return `${t.splits.map((s) => `<div class="split-line"><span class="mini-avatar">${initials(s.person)}</span>${esc(s.person)} owes you<span class="amt pos">${money(s.amount, cur)}</span></div>`).join('')}
          <div class="split-line"><span class="mini-avatar" style="background:var(--surface-3); color:var(--text-2)">${initials(M.user.name)}</span>Your share<span class="amt">${money(Math.abs(t.amount) - others, cur)}</span></div>`;
      }
      if (t.debt) return `<div class="split-line"><span class="mini-avatar">${initials(t.debt.paidBy)}</span>${esc(t.debt.paidBy)} paid ${money(t.debt.total)} in total<span class="amt neg">You owe ${money(Math.abs(t.amount))}</span></div>`;
      if (t.transfer) return `<div class="split-line">${ic('link', 'ic-sm')}Linked to a matching deposit in ${esc(t.transfer.linked)}<span class="amt">${money(Math.abs(t.amount))}</span></div>`;
      return '';
    };

    const listEl = $('#list'), countEl = $('#count'), footEl = $('#foot');
    let firstDraw = true;
    function draw() {
      const af = activeFilters();
      $('#pills').innerHTML = af.map(([k, l]) => `<span class="filter-pill">${esc(l)}<button type="button" data-clear="${k}" aria-label="Remove filter ${esc(l)}">${ic('x', 'ic-xs')}</button></span>`).join('');
      const fc = $('#f-count'); fc.hidden = af.length === 0; fc.textContent = af.length;
      if (mockState === 'loading') {
        countEl.innerHTML = 'Loading transactions';
        listEl.innerHTML = `<div aria-hidden="true">${Array.from({ length: 7 }, (_, i) => `<div class="skel-row"><span class="skel" style="width:16px;height:16px;border-radius:5px"></span><span class="skel" style="width:34px;height:34px;border-radius:10px"></span><span style="display:grid; gap:8px"><span class="skel b" style="width:${40 + ((i * 17) % 35)}%"></span><span class="skel b" style="width:${20 + ((i * 11) % 20)}%; height:8px"></span></span><span class="skel b" style="justify-self:end; width:${60 + ((i * 13) % 40)}px"></span></div>`).join('')}</div>`;
        footEl.innerHTML = ''; return;
      }
      if (mockState === 'error') {
        countEl.textContent = '';
        listEl.innerHTML = `<div class="state" role="alert"><span class="state-ico err">${ic('alert-circle', 'ic-lg')}</span><h3>Transactions did not load</h3><p>The server did not respond in time. Your data is safe, nothing was changed.</p><div class="actions"><button class="btn btn-primary" type="button" id="retry">${ic('sync')}Try again</button></div></div>`;
        footEl.innerHTML = '';
        $('#retry').addEventListener('click', () => { mockState = 'loading'; $('#mock-state').value = 'loading'; draw(); setTimeout(() => { mockState = 'live'; $('#mock-state').value = 'live'; draw(); }, 900); });
        return;
      }
      const rows = mockState === 'empty' ? [] : txs.filter(matches);
      if (!rows.length) {
        countEl.innerHTML = mockState === 'empty' ? 'No transactions' : `<strong>0</strong> matches`;
        listEl.innerHTML = mockState === 'empty'
          ? `<div class="state"><span class="state-ico">${ic('transactions', 'ic-lg')}</span><h3>No transactions in September yet</h3><p>Add one by hand, import a bank CSV, or connect a bank to sync them automatically.</p><div class="actions"><button class="btn" type="button" data-action="import">${ic('import')}Import CSV</button><button class="btn btn-primary" type="button" data-action="add-tx">${ic('plus')}Add transaction</button></div></div>`
          : `<div class="state"><span class="state-ico">${ic('search', 'ic-lg')}</span><h3>Nothing matches these filters</h3><p>Try a broader search or remove a filter. Search looks at titles and notes.</p><div class="actions"><button class="btn" type="button" id="clear-all-2">Clear filters</button></div></div>`;
        footEl.innerHTML = '';
        $('#clear-all-2')?.addEventListener('click', clearAll);
        return;
      }
      const filtered = af.length > 0;
      countEl.innerHTML = filtered ? `<strong>${rows.length}</strong> of ${txs.length} loaded match` : `Showing <strong>${rows.length}</strong> of <strong>${TOTAL + (txs.length - 15)}</strong>`;
      const days = [];
      rows.forEach((t) => { let d = days.find((x) => x.date === t.date); if (!d) days.push((d = { date: t.date, items: [] })); d.items.push(t); });
      let i = 0;
      listEl.innerHTML = days.map((d) => {
        const tot = sum(d.items.filter((t) => !t.transfer).map(txEur));
        const isToday = d.date === TODAY, yest = dayDiff(d.date, TODAY) === 1;
        return `<div class="day ${firstDraw && !RM ? 'rise' : ''}" style="--i:${5 + i++}" role="group" aria-label="${fmtDate(d.date, { weekday: 'long', month: 'long', day: 'numeric' })}">
          <div class="day-head"><span class="d">${fmtDate(d.date, { weekday: 'long', month: 'short', day: 'numeric' })}${isToday ? '<small>Today</small>' : yest ? '<small>Yesterday</small>' : ''}</span><span class="sub">${d.items.length} ${d.items.length === 1 ? 'item' : 'items'}, <strong>${signed(tot)}</strong></span></div>
          ${d.items.map(rowHtml).join('')}</div>`;
      }).join('');
      footEl.innerHTML = filtered ? `Filters apply to all ${TOTAL} transactions on the server` : `<span id="sentinel">Scroll for more, <strong>${TOTAL - 15}</strong> older transactions</span>`;
      firstDraw = false;
      syncSelection();
      observeSentinel();
    }

    let io;
    function observeSentinel() {
      io?.disconnect();
      const s = $('#sentinel');
      if (!s || !('IntersectionObserver' in window)) return;
      io = new IntersectionObserver((entries) => {
        if (!entries[0].isIntersecting) return;
        io.disconnect();
        footEl.innerHTML = `<div style="width:100%" aria-hidden="true">${Array.from({ length: 3 }, () => `<div class="skel-row"><span></span><span class="skel" style="width:34px;height:34px;border-radius:10px"></span><span class="skel b" style="width:40%"></span><span class="skel b" style="justify-self:end;width:70px"></span></div>`).join('')}</div><span class="sr-only">Loading more transactions</span>`;
        setTimeout(() => { footEl.innerHTML = `End of sample data. The live list keeps loading pages of 15 until all <strong>${TOTAL}</strong> are shown.`; }, 1100);
      }, { rootMargin: '0px 0px -40px 0px' });
      setTimeout(() => io && s.isConnected && io.observe(s), 1500); // do not trigger during the entrance
    }

    const syncSelection = () => {
      const visible = $$('.txl', listEl).map((r) => r.dataset.id);
      const selVis = visible.filter((id) => selected.has(id)).length;
      const all = $('#sel-all');
      all.checked = selVis > 0 && selVis === visible.length;
      all.indeterminate = selVis > 0 && selVis < visible.length;
      const bulk = $('#bulk');
      bulk.classList.toggle('show', selected.size > 0);
      bulk.inert = selected.size === 0;
      $('#bulk-count').textContent = `${selected.size} selected`;
    };
    function clearAll() { Object.keys(F).forEach(resetKey); draw(); }

    function removeTx(id, { silent = false } = {}) {
      const idx = txs.findIndex((t) => t.id === id);
      if (idx < 0) return;
      const [t] = txs.splice(idx, 1);
      selected.delete(id);
      const row = $(`.txl[data-id="${id}"]`, listEl);
      const finish = () => draw();
      if (row && !RM) { row.classList.add('removing'); setTimeout(finish, 280); } else finish();
      if (!silent) toast(`"${t.title}" moved to Trash`, { icon: 'trash', action: { label: 'Undo', fn: () => { txs.splice(idx, 0, t); draw(); toast('Restored'); } } });
      return { t, idx };
    }
    function duplicateTx(id) {
      const idx = txs.findIndex((t) => t.id === id);
      const copy = { ...txs[idx], id: `${id}-copy-${Date.now()}`, title: `${txs[idx].title} (copy)` };
      txs.splice(idx + 1, 0, copy);
      draw();
      toast(`Duplicated "${txs[idx].title}"`);
    }
    const rowMenu = (btn, t) => Menu.open(btn, [
      { label: 'Edit', icon: 'edit', kbd: 'E', action: () => openTxForm(t, 'edit') },
      { label: 'Duplicate', icon: 'copy', kbd: 'D', action: () => duplicateTx(t.id) },
      { label: t.transfer ? 'Unlink transfer' : 'Convert to transfer', icon: 'transfer', action: () => (t.transfer ? toast('Transfer unlinked') : openTransferForm(t)) },
      'sep',
      { label: 'Delete', icon: 'trash', danger: true, action: () => removeTx(t.id) },
    ]);

    function openDetail(t) {
      const acct = M.acct(t.account_id);
      const cur = txCur(t);
      const out = t.amount < 0;
      Drawer.open({
        eyebrow: fmtDate(t.date, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
        title: t.title,
        body: `<div class="d-stagger">
          <div style="--i:0; display:flex; align-items:center; gap:14px; margin-top:4px">
            ${catIco(t.category_id, 'lg', { transfer: !!t.transfer })}
            <div><div class="d-amount ${out ? '' : 'pos'}"><span class="sr-only">${out ? 'Money out' : 'Money in'}, </span>${signed(t.amount, cur)}</div>
            ${cur !== 'EUR' ? `<div class="muted" style="font-size:13px">${signed(txEur(t))} at 1 ${cur} = ${money(M.fx[cur], 'EUR', { maximumFractionDigits: 4 })}</div>` : `<div class="muted" style="font-size:13px">${out ? 'Money out' : 'Money in'}</div>`}</div>
          </div>
          <div style="--i:1; display:flex; gap:6px; flex-wrap:wrap; margin-top:14px">${txBadges(t)}${t.notes ? `<span class="badge">${ic('note')}Has notes</span>` : ''}</div>
          <div class="d-section" style="--i:2"><dl class="kv">
            <div><dt>Account</dt><dd><span class="dot" style="background:${ACC_COLOR[acct.id]}"></span>${esc(acct.name)} <span class="muted">${TYPE_LABEL[acct.account_type]}, ${acct.currency}</span></dd></div>
            <div><dt>Category</dt><dd>${t.category_id ? `<span class="dot" style="background:${M.cat(t.category_id).color}"></span>` : ''}${esc(catName(t))}</dd></div>
            <div><dt>Date</dt><dd>${fmtDate(t.date, { month: 'long', day: 'numeric', year: 'numeric' })}</dd></div>
            <div><dt>Notes</dt><dd>${t.notes ? esc(t.notes) : '<span class="muted">None</span>'}</dd></div>
          </dl></div>
          ${t.splits ? `<div class="d-section" style="--i:3"><div class="d-section-title">${ic('split', 'ic-sm')}Split</div><div class="well" style="display:grid; gap:10px">${expandHtml(t)}</div></div>` : ''}
          ${t.debt ? `<div class="d-section" style="--i:3"><div class="d-section-title">${ic('user', 'ic-sm')}Paid by someone else</div><div class="well">${expandHtml(t)}</div></div>` : ''}
          ${t.transfer ? `<div class="d-section" style="--i:3"><div class="d-section-title">${ic('transfer', 'ic-sm')}Transfer</div><div class="well" style="display:grid; gap:8px"><div class="split-line"><span class="dot" style="background:${ACC_COLOR[acct.id]}"></span>${esc(acct.name)}<span class="amt">${signed(t.amount)}</span></div><div class="split-line"><span class="dot" style="background:${ACC_COLOR['a-save']}"></span>${esc(t.transfer.linked)}<span class="amt pos">${signed(-t.amount)}</span></div></div></div>` : ''}
          <div class="d-section" style="--i:4"><div class="d-section-title">${ic('clock', 'ic-sm')}History</div>
            <ol style="display:grid; gap:8px; font-size:13px; color:var(--text-2)">
              <li style="display:flex; gap:10px"><span class="dot" style="background:var(--line-strong); margin-top:6px"></span>${acct.provider ? `Synced from ${esc(acct.provider)}` : 'Added by hand'}, ${fmtDate(t.date, { month: 'short', day: 'numeric' })}</li>
              ${t.splits ? `<li style="display:flex; gap:10px"><span class="dot" style="background:var(--accent); margin-top:6px"></span>Split sent to SplitPro</li>` : ''}
            </ol></div>
        </div>`,
        foot: `<div class="left"><button class="btn btn-ghost btn-danger" type="button" id="d-del">${ic('trash', 'ic-sm')}Delete</button></div>
          <button class="btn" type="button" id="d-dup">${ic('copy')}Duplicate</button>
          ${t.transfer ? '' : `<button class="btn" type="button" id="d-conv">${ic('transfer')}Convert</button>`}
          <button class="btn btn-primary" type="button" id="d-edit">${ic('edit')}Edit</button>`,
        onMount: (d) => {
          $('#d-del', d).onclick = () => { Drawer.close(); removeTx(t.id); };
          $('#d-dup', d).onclick = () => { Drawer.close(); duplicateTx(t.id); };
          $('#d-edit', d).onclick = () => openTxForm(t, 'edit');
          const cv = $('#d-conv', d); if (cv) cv.onclick = () => openTransferForm(t);
        },
      });
    }

    listEl.addEventListener('click', (e) => {
      const row = e.target.closest('.txl');
      if (!row) return;
      const t = txs.find((x) => x.id === row.dataset.id);
      if (e.target.closest('input[type="checkbox"]')) {
        const cb = e.target.closest('input');
        cb.checked ? selected.add(t.id) : selected.delete(t.id);
        row.classList.toggle('selected', cb.checked);
        syncSelection(); return;
      }
      if (e.target.closest('[data-menu]')) { e.stopPropagation(); rowMenu(e.target.closest('[data-menu]'), t); return; }
      if (e.target.closest('[data-expand]')) {
        expanded.has(t.id) ? expanded.delete(t.id) : expanded.add(t.id);
        draw();
        $(`.txl[data-id="${t.id}"] [data-expand]`, listEl)?.focus({ preventScroll: true });
        return;
      }
      if (e.target.closest('[data-stop]')) return;
      openDetail(t);
    });
    $('#sel-all').addEventListener('change', (e) => {
      $$('.txl', listEl).forEach((r) => (e.target.checked ? selected.add(r.dataset.id) : selected.delete(r.dataset.id)));
      draw();
    });
    $('#bulk-clear').addEventListener('click', () => { selected.clear(); draw(); });
    $('#bulk-del').addEventListener('click', () => {
      const ids = [...selected];
      const removed = ids.map((id) => ({ t: txs.find((x) => x.id === id), idx: txs.findIndex((x) => x.id === id) }));
      txs = txs.filter((t) => !selected.has(t.id));
      selected.clear(); draw();
      toast(`${ids.length} transactions moved to Trash`, { icon: 'trash', action: { label: 'Undo', fn: () => { removed.sort((a, b) => a.idx - b.idx).forEach(({ t, idx }) => txs.splice(idx, 0, t)); draw(); } } });
    });
    $('#bulk-cat').addEventListener('click', () => toast(`Pick a category for ${selected.size} transactions`, { icon: 'tag' }));
    $('#pills').addEventListener('click', (e) => { const b = e.target.closest('[data-clear]'); if (b) { resetKey(b.dataset.clear); draw(); } });
    $('#f-reset').addEventListener('click', clearAll);
    $('#q').addEventListener('input', debounce((e) => { F.q = e.target.value; draw(); }, 120));
    ['account', 'category', 'person', 'from', 'to', 'min', 'max'].forEach((k) => $(`#f-${k}`).addEventListener(k === 'min' || k === 'max' ? 'input' : 'change', debounce((e) => { F[k] = e.target.value; draw(); }, 150)));
    ['splits', 'transfer'].forEach((k) => $(`#f-${k}`).addEventListener('change', (e) => { F[k] = e.target.checked; draw(); }));
    $('#mock-state').value = mockState;
    $('#mock-state').addEventListener('change', (e) => { mockState = e.target.value; draw(); });
    $('#m-prev').addEventListener('click', () => toast('August 2026 would load here', { icon: 'calendar' }));

    draw();
    const openId = params.get('open');
    if (openId) { const t = txs.find((x) => x.id === openId); if (t) setTimeout(() => openDetail(t), RM ? 0 : 450); }
    if (params.get('expand')) { expanded.add(params.get('expand')); draw(); }
  }

  /* =========================================================== ACCOUNTS */
  function pageAccounts() {
    const currencies = [...new Set(M.accounts.map((a) => a.currency))];
    const assetGroups = GROUPS.filter((g) => !g.liability).map((g) => ({ ...g, total: sum(groupAccounts(g).map(M.toEur)) }));
    // Illustrative 7 day series for the investment sparkline, ending at today's balance
    const investSpark = (a) => { const base = a.balance / (1 + a.dayChange / 100); return [0.975, 0.982, 0.978, 0.99, 0.986, 0.995, 1].map((f) => base * f).concat([a.balance]); };

    const card = (a, i) => {
      const liab = isLiab(a);
      const eur = M.toEur(a);
      const logo = a.account_type === 'CASH' || a.account_type === 'GIFT_CARD' || a.account_type === 'DEBT' ? ic(TYPE_ICON[a.account_type]) : initials(a.name).slice(0, 2);
      let foot;
      if (a.provider) {
        const stale = /h ago/.test(a.synced) && parseInt(a.synced, 10) >= 3;
        foot = `<div class="acc-foot" data-sync-foot>
          <span class="sync-dot ${stale ? 'stale' : ''}" aria-hidden="true"></span>
          <span class="sync-text" title="Last synced by ${esc(a.provider)}">${esc(a.provider)}, ${esc(a.synced)}</span>
          <button class="btn btn-sm" type="button" data-sync="${a.id}">${ic('sync', 'ic-sm ic-spin')}<span>Sync now</span></button></div>`;
      } else {
        foot = `<div class="acc-foot plain">${ic(liab ? 'alert' : 'edit', 'ic-sm')}<span>${liab ? 'Liability, updated by hand' : 'Manual, no provider sync'}</span></div>`;
      }
      return `<article class="acc-card ${liab ? 'liability' : ''} rise" style="--i:${3 + i}" data-acc="${a.id}" aria-label="${esc(a.name)}">
        <span class="sheen" aria-hidden="true"></span>
        <div class="acc-top">
          <span class="acc-logo" style="background:${ACC_COLOR[a.id]}" aria-hidden="true">${logo}</span>
          <div style="min-width:0"><h3 class="acc-name">${esc(a.name)}</h3><div class="acc-type">${TYPE_LABEL[a.account_type]}<span class="dot" style="width:3px;height:3px;background:currentColor"></span>${a.currency}</div></div>
          <button class="icon-btn sm" type="button" data-acc-menu="${a.id}" aria-haspopup="menu" aria-expanded="false" aria-label="Actions for ${esc(a.name)}">${ic('more')}</button>
        </div>
        <div class="acc-bal">
          <div class="v">${money(a.balance, a.currency)}${liab ? `<span class="owed">${ic('arrow-out', 'ic-xs')}Owed</span>` : ''}</div>
          ${a.currency !== 'EUR' ? `<div class="eq">${ic('globe', 'ic-xs')}${money(eur)} at ${money(M.fx[a.currency], 'EUR', { maximumFractionDigits: 4 })} per ${a.currency}</div>` : a.dayChange != null ? `<div class="eq"><span class="day-change ${a.dayChange >= 0 ? 'pos' : 'neg'}">${ic(a.dayChange >= 0 ? 'trend-up' : 'trend-down', 'ic-xs')}${a.dayChange >= 0 ? '+' : MINUS}${Math.abs(a.dayChange).toFixed(2)}% today</span><span style="white-space:nowrap">${signed(a.balance - a.balance / (1 + a.dayChange / 100))}</span><span class="spark" style="margin-inline-start:auto">${sparkSvg(investSpark(a), 64, 24, 'var(--pos)', !RM, 600 + i * 40)}</span></div>` : `<div class="eq">${liab ? `${Math.abs(eur / liabilities * 100).toFixed(0)}% of what you owe` : `${(eur / assets * 100).toFixed(1)}% of assets`}</div>`}
        </div>
        ${foot}
      </article>`;
    };

    let ci = 0;
    const section = (title, list, total, extra = '', note = '') => `<section class="acc-section" aria-label="${esc(title)}">
      <div class="acc-section-head rise" style="--i:3"><h2>${title}</h2><span class="card-sub">${list.length} ${list.length === 1 ? 'account' : 'accounts'}${note}</span><span class="total ${total < 0 ? 'neg' : ''}">${money(total)}</span></div>
      <div class="acc-grid">${list.map((a) => card(a, ci++)).join('')}${extra}</div></section>`;

    const everyday = M.accounts.filter((a) => ['CHECKING', 'CASH'].includes(a.account_type));
    const growth = M.accounts.filter((a) => ['SAVINGS', 'INVESTMENT', 'GIFT_CARD'].includes(a.account_type));
    const liabs = M.accounts.filter(isLiab);

    const html = `
      <div class="page-head rise" style="--i:0">
        <div><h1 class="page-title">Accounts</h1><p class="page-sub">${M.accounts.length} accounts in ${currencies.length} currencies, totals converted to EUR.</p></div>
        <div class="actions">
          <button class="btn" type="button" id="connect">${ic('link')}Connect provider</button>
          <button class="btn btn-primary" type="button" id="add-acc">${ic('plus')}Add account</button>
        </div>
      </div>
      <section class="card acc-hero rise" style="--i:1" aria-labelledby="tb-title">
        <div>
          <div class="stat-label" id="tb-title">Total balance, EUR</div>
          <div class="hero-figure" id="tb-figure">${heroMoney(M.netWorth)}</div>
          <div class="hero-delta" style="gap:8px">
            <span class="chip">${ic('arrow-in')}Assets ${money(assets)}</span>
            <span class="chip chip-neg">${ic('arrow-out')}Liabilities ${money(liabilities)}</span>
          </div>
          <div class="fx-row" style="margin-top:14px">${currencies.filter((c) => c !== 'EUR').map((c) => `<span class="badge">${ic('globe')}1 ${c} = ${money(M.fx[c], 'EUR', { maximumFractionDigits: 4 })}</span>`).join('')}<span class="badge">${ic('clock')}Rates cached today</span></div>
        </div>
        <div class="alloc">
          <div style="display:flex; justify-content:space-between"><span class="card-title">Where your assets are</span><span class="card-sub">${money(assets, 'EUR', { maximumFractionDigits: 0 })}</span></div>
          <div class="alloc-bar" role="img" aria-label="Asset allocation: ${assetGroups.map((g) => `${g.name} ${pct((g.total / assets) * 100, 0)}`).join(', ')}">
            ${assetGroups.map((g, i) => `<span class="${RM ? '' : 'anim-grow-x-el'}" style="flex:${g.total}; background:${GROUP_COLOR[g.id]}; --delay:${400 + i * 80}ms"></span>`).join('')}
          </div>
          <ul class="alloc-legend">${assetGroups.map((g) => `<li><span class="key-rect" style="background:${GROUP_COLOR[g.id]}"></span>${g.name}<span class="v">${pct((g.total / assets) * 100)}</span></li>`).join('')}</ul>
          <hr class="divider" style="margin:4px 0">
          <div style="display:flex; justify-content:space-between; font-size:13px"><span class="muted">Liabilities as a share of assets</span><strong class="neg">${pct((-liabilities / assets) * 100)}</strong></div>
          <div class="alloc-bar" style="height:6px; background:var(--surface-3); border-radius:3px"><span class="${RM ? '' : 'anim-grow-x-el'}" style="width:${(-liabilities / assets) * 100}%; background:var(--neg); --delay:700ms"></span></div>
        </div>
      </section>
      ${section('Everyday', everyday, sum(everyday.map(M.toEur)))}
      ${section('Savings and investments', growth, sum(growth.map(M.toEur)))}
      ${section('Liabilities', liabs, sum(liabs.map(M.toEur)), `<button class="add-card rise" style="--i:14" type="button" id="add-acc-2"><span class="plus">${ic('plus')}</span>Add an account<small>Bank, card, cash, investment or debt</small></button>`, ', shown as money you owe')}`;
    renderShell(html);
    countUp($('#tb-figure'), M.netWorth, heroMoney, 1100, 300);

    const accForm = (a = null) => Drawer.open({
      eyebrow: a ? 'Edit account' : 'New account', title: a ? a.name : 'Add an account',
      body: `<form class="form-grid d-stagger" id="acc-form">
        <div class="field full" style="--i:0"><label for="a-name">Name</label><input class="input" id="a-name" value="${esc(a?.name || '')}" placeholder="e.g. Revolut Main"></div>
        <div class="field" style="--i:1"><label for="a-type">Type</label><select class="select" id="a-type">${Object.entries(TYPE_LABEL).map(([k, l]) => `<option value="${k}" ${a?.account_type === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        <div class="field" style="--i:1"><label for="a-cur">Currency</label><select class="select" id="a-cur">${['EUR', 'GBP', 'INR', 'USD'].map((c) => `<option ${a?.currency === c ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
        <div class="field" style="--i:2"><label for="a-bal">${a ? 'Current balance' : 'Opening balance'}</label><input class="input" id="a-bal" inputmode="decimal" value="${a ? a.balance.toFixed(2) : ''}"><span class="hint">Use a negative number for money you owe.</span></div>
        <div class="field full" style="--i:3"><label for="a-notes">Notes</label><textarea class="input" id="a-notes" placeholder="Optional"></textarea></div>
        ${a ? `<div class="well full" style="--i:4; display:flex; align-items:center; gap:10px; font-size:13px">${ic('archive', 'ic-sm')}<span style="flex:1">Archive hides the account but keeps its history.</span>${needsBackend('Account archive is not supported by the backend yet')}</div>` : ''}
      </form>`,
      foot: `${a ? `<div class="left"><button class="btn btn-ghost btn-danger" type="button" id="a-del">${ic('trash', 'ic-sm')}Delete</button></div>` : ''}<button class="btn btn-ghost" type="button" data-close>Cancel</button><button class="btn btn-primary" type="submit" form="acc-form">${a ? 'Save changes' : 'Add account'}</button>`,
      onMount: (d) => {
        $('#acc-form', d).addEventListener('submit', (e) => { e.preventDefault(); Drawer.close(); toast(a ? 'Account updated' : 'Account added'); });
        const del = $('#a-del', d); if (del) del.onclick = () => { Drawer.close(); toast(`"${a.name}" deleted`, { icon: 'trash', action: { label: 'Undo', fn: () => toast('Restored') } }); };
      },
    });
    const connect = () => Drawer.open({
      eyebrow: 'Connect provider', title: 'Sync balances and transactions',
      body: `<div class="d-stagger" style="display:grid; gap:10px" role="radiogroup" aria-label="Provider">
        ${[['TrueLayer', 'Open Banking for UK and EU banks. Read-only, renews every 90 days.', 'accounts', '#1d2129'], ['Trading 212', 'Investment portfolio and daily valuation, with an API key.', 'trend-up', '#1b78c9']].map(([n, d, i, c], k) => `
          <label class="well" style="--i:${k}; display:flex; gap:14px; align-items:center; cursor:pointer; box-shadow: inset 0 0 0 1px var(--line)">
            <span class="acc-logo" style="background:${c}">${ic(i)}</span><span style="flex:1"><strong style="display:block">${n}</strong><span class="muted" style="font-size:13px">${d}</span></span>
            <span class="check"><input type="radio" name="prov" ${k === 0 ? 'checked' : ''} aria-label="${n}"><span class="box" style="border-radius:99px">${ic('check')}</span></span></label>`).join('')}
        <p class="hint" style="--i:2; margin-top:6px">Credentials are encrypted at rest. Syncs run as background jobs you can follow on the Jobs page.</p></div>`,
      foot: `<button class="btn btn-ghost" type="button" data-close>Cancel</button><button class="btn btn-primary" type="button" id="prov-go">Continue</button>`,
      onMount: (d) => ($('#prov-go', d).onclick = () => { Drawer.close(); toast('Opening the provider consent screen'); }),
    });
    $('#add-acc').onclick = () => accForm();
    $('#add-acc-2').onclick = () => accForm();
    $('#connect').onclick = connect;

    document.addEventListener('click', (e) => {
      const s = e.target.closest('[data-sync]');
      if (s) {
        const foot = s.closest('[data-sync-foot]');
        const a = M.acct(s.dataset.sync);
        if (foot.classList.contains('syncing')) return;
        foot.classList.add('syncing');
        s.setAttribute('aria-disabled', 'true');
        $('span', s).textContent = 'Syncing';
        setTimeout(() => {
          foot.classList.remove('syncing');
          s.removeAttribute('aria-disabled');
          $('span', s).textContent = 'Sync now';
          $('.sync-text', foot).textContent = `${a.provider}, just now`;
          $('.sync-dot', foot).classList.remove('stale');
          toast(`${a.name} is up to date`);
        }, RM ? 400 : 1600);
        return;
      }
      const m = e.target.closest('[data-acc-menu]');
      if (m) {
        const a = M.acct(m.dataset.accMenu);
        Menu.open(m, [
          { label: 'Edit', icon: 'edit', action: () => accForm(a) },
          ...(a.provider ? [{ label: 'Sync now', icon: 'sync', action: () => $(`[data-sync="${a.id}"]`).click() }] : [{ label: 'Connect provider', icon: 'link', action: connect }]),
          { label: 'View transactions', icon: 'transactions', action: () => (location.href = `transactions.html`) },
          { label: 'Archive (needs backend)', icon: 'archive', action: () => toast('Archive needs backend support first', { icon: 'plug' }) },
          'sep',
          { label: 'Delete', icon: 'trash', danger: true, action: () => toast(`"${a.name}" deleted`, { icon: 'trash', action: { label: 'Undo', fn: () => toast('Restored') } }) },
        ]);
      }
    });

    // Pointer tilt with spring-like smoothing. Decorative, fine pointers only.
    if (FINE && !RM) {
      $$('.acc-card').forEach((c) => {
        const sheen = $('.sheen', c);
        let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0, active = false;
        const loop = () => {
          cx += (tx - cx) * 0.14; cy += (ty - cy) * 0.14;
          c.style.transform = `perspective(900px) rotateX(${cy.toFixed(3)}deg) rotateY(${cx.toFixed(3)}deg) translateY(${active ? -2 : 0}px)`;
          if (Math.abs(tx - cx) > 0.01 || Math.abs(ty - cy) > 0.01 || active) raf = requestAnimationFrame(loop);
          else { raf = 0; if (!active) c.style.transform = ''; }
        };
        c.addEventListener('pointermove', (e) => {
          const r = c.getBoundingClientRect();
          const px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
          tx = px * 5; ty = -py * 4; active = true;
          sheen.style.transform = `translate(${e.clientX - r.left}px, ${e.clientY - r.top}px)`;
          if (!raf) raf = requestAnimationFrame(loop);
        });
        c.addEventListener('pointerleave', () => { tx = 0; ty = 0; active = false; if (!raf) raf = requestAnimationFrame(loop); });
      });
    }
    if (params.get('open') === 'connect') setTimeout(connect, 450);
    if (params.get('open') === 'edit') setTimeout(() => accForm(M.acct('a-uk')), 450);
  }

  /* ============================================================ BUDGETS */
  function pageBudgets() {
    const monthly = M.budgets.filter((b) => b.period === 'MONTHLY');
    const mLimit = sum(monthly.map((b) => b.limit)), mSpent = sum(monthly.map((b) => b.spent));
    const mPct = (mSpent / mLimit) * 100;
    const mt = budgetTime({ start: '2026-09-01', end: '2026-09-30', limit: mLimit, spent: mSpent });
    const counts = M.budgets.reduce((a, b) => ((a[statusOf(b)] = (a[statusOf(b)] || 0) + 1), a), {});
    let period = 'ALL';

    const card = (b, i) => {
      const s = statusOf(b), p = pctUsed(b), tm = budgetTime(b), cat = M.cat(b.category_id);
      const rem = b.limit - b.spent;
      return `<article class="card bud-card rise" style="--i:${4 + i}" data-bud="${b.id}">
        <div class="bud-top">
          <div class="ring" style="width:64px;height:64px">${ringSvg(p, 64, 6, STATUS[s].color, !RM, 350 + i * 70)}<span class="ring-label" style="font-size:13px">${Math.round(p)}%</span></div>
          <div style="min-width:0"><h3 class="nm"><button type="button" data-open-bud="${b.id}" style="all:unset; cursor:pointer; border-radius:4px">${esc(b.name)}</button></h3>
            <div class="sub"><span class="dot" style="background:${cat.color}"></span>${esc(cat.name)}<span class="chip" style="height:20px; font-size:11px">${PERIOD_LABEL[b.period]}</span></div></div>
          <div style="display:grid; justify-items:end; gap:6px; align-self:start">
            <button class="icon-btn sm" type="button" data-bud-menu="${b.id}" aria-haspopup="menu" aria-expanded="false" aria-label="Actions for ${esc(b.name)} budget">${ic('more')}</button>
          </div>
        </div>
        <div class="bud-nums">
          <div><div class="stat-label">Spent</div><div class="stat-value">${money(b.spent)}</div></div>
          <div><div class="stat-label">Limit</div><div class="stat-value">${money(b.limit, 'EUR', { maximumFractionDigits: 0 })}</div></div>
          <div><div class="stat-label">${rem >= 0 ? 'Remaining' : 'Over by'}</div><div class="stat-value ${rem < 0 ? 'neg' : ''}">${money(Math.abs(rem))}</div></div>
        </div>
        <div style="display:grid; gap:8px">
          <div class="pace-track" role="img" aria-label="${Math.round(p)}% of the limit used with ${Math.round(tm.timePct)}% of the period gone">
            <span class="pace-fill ${RM ? '' : 'anim-grow-x-el'}" style="width:${Math.min(100, p)}%; background:${STATUS[s].color}; --delay:${450 + i * 70}ms"></span>
            <span class="pace-mark" style="left:calc(${tm.timePct}% - 1px)" title="Today"></span>
          </div>
          <div class="pace-row"><span>${statusChip(s)}</span><span class="pace ${tm.ahead ? 'warn' : 'pos'}">${ic(tm.ahead ? 'trend-up' : 'check', 'ic-sm')}${tm.ahead ? 'Ahead of pace' : 'On track'}</span><span class="muted">${tm.left} ${tm.left === 1 ? 'day' : 'days'} left</span></div>
        </div>
      </article>`;
    };

    const html = `
      <div class="page-head rise" style="--i:0">
        <div><h1 class="page-title">Budgets</h1><p class="page-sub">September 2026, ${mt.left} days left in the month.</p></div>
        <div class="actions"><button class="btn btn-primary" type="button" id="new-bud">${ic('plus')}New budget</button></div>
      </div>
      <section class="card bud-hero rise" style="--i:1" aria-labelledby="ov-title">
        <div class="ring big-ring">${ringSvg(mPct, 148, 12, STATUS[mPct > 100 ? 'EXCEEDED' : mPct >= 80 ? 'WARNING' : 'OK'].color, !RM, 300)}<span class="ring-label"><span style="display:grid; justify-items:center"><span class="stat-value" id="ov-pct">${Math.round(mPct)}%</span>used</span></span></div>
        <div style="min-width:0">
          <div class="eyebrow" id="ov-title">Monthly budgets, this period</div>
          <div class="stat-value" style="font-size:30px; margin-top:6px">${money(mSpent)} <span class="muted" style="font-size:17px; font-weight:520">of ${money(mLimit, 'EUR', { maximumFractionDigits: 0 })}</span></div>
          <p style="color:var(--text-2); margin-top:6px; text-wrap:pretty">${money(mLimit - mSpent)} left for ${mt.left} days, about <strong style="color:var(--text)">${money((mLimit - mSpent) / mt.left)} a day</strong>. At today's pace you would finish at ${money((mSpent / mt.elapsed) * mt.total, 'EUR', { maximumFractionDigits: 0 })}.</p>
          <div class="pace-track" style="margin-top:14px; height:10px" role="img" aria-label="${Math.round(mPct)}% used, ${Math.round(mt.timePct)}% of the month gone">
            <span class="pace-fill ${RM ? '' : 'anim-grow-x-el'}" style="width:${Math.min(100, mPct)}%; background:var(--accent); --delay:450ms"></span>
            <span class="pace-mark" style="left:calc(${mt.timePct}% - 1px)"></span>
          </div>
          <div class="pace-legend"><span><span class="key-rect" style="background:var(--accent)"></span>Spent</span><span><span style="width:2px;height:12px;background:var(--text);border-radius:2px"></span>Today, day ${mt.elapsed} of ${mt.total}</span></div>
        </div>
        <div class="bud-side" style="min-width:250px">
          <div class="bud-stats" style="grid-template-columns:1fr 1fr">
            <div class="kpi"><div class="stat-label">${ic('check-circle', 'ic-xs pos')}On track</div><div class="stat-value sm">${counts.OK || 0}</div></div>
            <div class="kpi"><div class="stat-label">${ic('alert', 'ic-xs warn')}Warning</div><div class="stat-value sm">${counts.WARNING || 0}</div></div>
            <div class="kpi"><div class="stat-label">${ic('alert-circle', 'ic-xs neg')}Exceeded</div><div class="stat-value sm">${counts.EXCEEDED || 0}</div></div>
            <div class="kpi"><div class="stat-label">${ic('calendar', 'ic-xs')}Days left</div><div class="stat-value sm">${mt.left}</div></div>
          </div>
        </div>
      </section>
      <div class="bud-tools rise" style="--i:2">
        ${segHtml('period', [['ALL', 'All'], ['WEEKLY', 'Weekly'], ['MONTHLY', 'Monthly'], ['YEARLY', 'Yearly']], 'ALL', 'Filter by period')}
        <span class="card-sub">Sorted by share of limit used</span>
      </div>
      <div class="bud-grid" id="bud-grid"></div>`;
    renderShell(html);

    const grid = $('#bud-grid');
    let first = true;
    const drawGrid = () => {
      const list = [...M.budgets].filter((b) => period === 'ALL' || b.period === period).sort((a, b) => pctUsed(b) - pctUsed(a));
      grid.innerHTML = list.map(card).join('');
      if (!first) $$('.rise', grid).forEach((el) => el.classList.remove('rise'));
      if (!first) $$('.anim-draw, .anim-grow-x-el', grid).forEach((el) => el.classList.remove('anim-draw', 'anim-grow-x-el'));
      first = false;
    };
    drawGrid();
    initSeg($('[data-seg="period"]'), (v) => { period = v; drawGrid(); });

    const budForm = (b = null) => Drawer.open({
      eyebrow: b ? 'Edit budget' : 'New budget', title: b ? b.name : 'Create a budget',
      body: `<form class="form-grid d-stagger" id="bud-form">
        <div class="field full" style="--i:0"><label for="b-name">Name</label><input class="input" id="b-name" value="${esc(b?.name || '')}" placeholder="e.g. Groceries"></div>
        <div class="field" style="--i:1"><label for="b-cat">Category</label><select class="select" id="b-cat">${M.categories.map((c) => `<option value="${c.id}" ${b?.category_id === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
        <div class="field" style="--i:1"><label for="b-per">Period</label><select class="select" id="b-per">${Object.entries(PERIOD_LABEL).map(([k, l]) => `<option value="${k}" ${(b?.period || 'MONTHLY') === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        <div class="field" style="--i:2"><label for="b-lim">Limit</label><div class="input-affix"><span class="affix">€</span><input class="input" id="b-lim" inputmode="decimal" value="${b ? b.limit.toFixed(2) : ''}"></div></div>
        <div class="field" style="--i:2"><label for="b-start">Starts</label><input class="input" type="date" id="b-start" value="${b?.start || '2026-10-01'}"></div>
        <div class="field full" style="--i:3"><label class="switch"><input type="checkbox" checked><span class="track"></span>Warn me at 80% of the limit</label></div>
      </form>`,
      foot: `${b ? `<div class="left"><button class="btn btn-ghost btn-danger" type="button" id="b-del">${ic('trash', 'ic-sm')}Delete</button></div>` : ''}<button class="btn btn-ghost" type="button" data-close>Cancel</button><button class="btn btn-primary" type="submit" form="bud-form">${b ? 'Save changes' : 'Create budget'}</button>`,
      onMount: (d) => {
        $('#bud-form', d).addEventListener('submit', (e) => { e.preventDefault(); Drawer.close(); toast(b ? 'Budget updated' : 'Budget created'); });
        const del = $('#b-del', d); if (del) del.onclick = () => { Drawer.close(); toast(`"${b.name}" budget deleted`, { icon: 'trash', action: { label: 'Undo', fn: () => toast('Restored') } }); };
      },
    });

    // Derived range history: earlier periods of the same budget (illustrative until the backend exposes ranges)
    const history = (b) => {
      const factors = [0.82, 1.04, 0.91, 0.77, 1.12];
      const lbl = b.period === 'MONTHLY' ? ['Aug', 'Jul', 'Jun', 'May', 'Apr'] : b.period === 'WEEKLY' ? ['Sep 14', 'Sep 7', 'Aug 31', 'Aug 24', 'Aug 17'] : ['2025', '2024', '2023', '2022', '2021'];
      return factors.map((f, i) => ({ label: lbl[i], limit: i >= 3 ? b.limit * 0.9 : b.limit, spent: b.limit * f * (i >= 3 ? 0.9 : 1) }));
    };

    function openBudget(b) {
      const s = statusOf(b), p = pctUsed(b), tm = budgetTime(b), cat = M.cat(b.category_id);
      const txs = M.transactions.filter((t) => t.category_id === b.category_id && t.date >= b.start && t.date <= b.end);
      Drawer.open({
        wide: true,
        eyebrow: `${PERIOD_LABEL[b.period]} budget, ${fmtDate(b.start, { month: 'short', day: 'numeric' })} to ${fmtDate(b.end, { month: 'short', day: 'numeric', year: 'numeric' })}`,
        title: b.name,
        body: `<div class="d-stagger">
          <div style="--i:0; display:grid; grid-template-columns:auto 1fr; gap:20px; align-items:center">
            <div class="ring" style="width:108px;height:108px">${ringSvg(p, 108, 10, STATUS[s].color, !RM, 250)}<span class="ring-label"><span style="display:grid; justify-items:center; font-size:12px; color:var(--text-3); font-weight:500"><span class="stat-value" style="font-size:22px; color:var(--text)">${Math.round(p)}%</span>used</span></span></div>
            <div style="display:grid; gap:8px">
              <div style="display:flex; gap:6px; flex-wrap:wrap">${statusChip(s)}<span class="status ${tm.ahead ? 'status-warning' : 'status-ok'}">${ic(tm.ahead ? 'trend-up' : 'check')}${tm.ahead ? 'Ahead of pace' : 'On track'}</span><span class="chip"><span class="dot" style="background:${cat.color}"></span>${esc(cat.name)}</span></div>
              <div class="stat-value" style="font-size:24px">${money(b.spent)} <span class="muted" style="font-size:15px; font-weight:520">of ${money(b.limit, 'EUR', { maximumFractionDigits: 0 })}</span></div>
              <div class="muted" style="font-size:13px">${b.limit - b.spent >= 0 ? `${money(b.limit - b.spent)} remaining` : `Over by ${money(b.spent - b.limit)}`}, ${tm.left} days left. Expected by today: ${money(tm.expected)}.</div>
            </div>
          </div>
          <div class="d-section" style="--i:1"><div class="d-section-title">${ic('pace', 'ic-sm')}Spending pace</div>
            <div class="well" style="padding:12px 10px 6px"><div class="chart" id="pace-chart" style="height:150px" aria-describedby="pace-sum"></div>
            <div class="legend" style="padding:4px 6px 6px"><span><span class="key-line" style="background:${STATUS[s].color}"></span>Actual</span><span><span class="key-line" style="background:var(--text-3)"></span>Even pace to the limit</span></div></div>
            <p class="sr-only" id="pace-sum">Cumulative spend reached ${money(b.spent)} by day ${tm.elapsed} of ${tm.total}, against an even pace of ${money(tm.expected)}.</p>
          </div>
          <div class="d-section" style="--i:2"><div class="d-section-title">${ic('transactions', 'ic-sm')}Counting toward this budget</div>
            ${txs.length ? txs.map((t) => `<a class="tx-row clickable" href="transactions.html?open=${t.id}" style="margin-inline:0">${catIco(t.category_id, 'sm')}<div style="min-width:0"><div class="t-title">${esc(t.title)}</div><div class="t-meta">${fmtDate(t.date, { month: 'short', day: 'numeric' })}<span class="sep"></span>${esc(M.acct(t.account_id).name)}</div></div>${amountHtml(t)}</a>`).join('') + `<p class="hint" style="padding:8px 0 0">Latest ${txs.length} shown. ${money(b.spent)} counted in total.</p>` : `<p class="muted">No transactions in this period yet.</p>`}
          </div>
          <div class="d-section" style="--i:3"><div class="d-section-title">${ic('clock', 'ic-sm')}Range history ${needsBackend('Budget ranges cannot be read or edited through the API yet')}</div>
            <table class="hist-table"><thead><tr><th scope="col">Period</th><th scope="col" class="r">Limit</th><th scope="col" class="r">Spent</th><th scope="col">Used</th></tr></thead><tbody>
              ${history(b).map((h) => { const hp = (h.spent / h.limit) * 100; const hs = hp > 100 ? 'EXCEEDED' : hp >= 80 ? 'WARNING' : 'OK'; return `<tr><td>${h.label}</td><td class="r">${money(h.limit, 'EUR', { maximumFractionDigits: 0 })}</td><td class="r">${money(h.spent)}</td><td><span style="display:flex; align-items:center; gap:8px"><span class="hist-bar"><i style="width:${Math.min(100, hp)}%; background:${STATUS[hs].color}"></i></span><span class="${hs === 'EXCEEDED' ? 'neg' : ''}" style="font-size:12.5px">${Math.round(hp)}%</span></span></td></tr>`; }).join('')}
            </tbody></table>
            <button class="btn btn-sm" type="button" disabled style="margin-top:10px">${ic('edit', 'ic-sm')}Edit ranges</button>
          </div>
          <div class="d-section" style="--i:4"><div class="d-section-title"><label for="bud-notes" style="all:inherit; margin:0">Notes</label> ${needsBackend('Budget notes are not stored by the backend yet')}</div>
            <textarea class="input" id="bud-notes" disabled placeholder="Why this limit, what counts"></textarea></div>
        </div>`,
        foot: `<div class="left"><button class="btn btn-ghost btn-danger" type="button" id="bd-del">${ic('trash', 'ic-sm')}Delete</button></div><button class="btn btn-primary" type="button" id="bd-edit">${ic('edit')}Edit budget</button>`,
        onMount: (d) => {
          $('#bd-edit', d).onclick = () => budForm(b);
          $('#bd-del', d).onclick = () => { Drawer.close(); toast(`"${b.name}" budget deleted`, { icon: 'trash', action: { label: 'Undo', fn: () => toast('Restored') } }); };
          // Pace chart: cumulative actual vs even pace, one axis
          const host = $('#pace-chart', d);
          requestAnimationFrame(() => {
            const W = host.clientWidth, H = 150, pad = { l: 6, r: 44, t: 10, b: 20 };
            const n = tm.total;
            const top = Math.max(b.limit, b.spent) * 1.08;
            const X = (day) => pad.l + (day / n) * (W - pad.l - pad.r);
            const Y = (v) => pad.t + (1 - v / top) * (H - pad.t - pad.b);
            const shape = [0, 0.06, 0.18, 0.27, 0.41, 0.52, 0.63, 0.78, 0.9, 1];
            const act = shape.map((f, i) => [X((tm.elapsed * i) / (shape.length - 1)), Y(b.spent * f)]);
            const line = act.reduce((s, pt, i) => s + (i ? 'L' : 'M') + pt[0].toFixed(1) + ',' + pt[1].toFixed(1), '');
            host.innerHTML = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Spending pace">
              <line class="grid-line" x1="${pad.l}" x2="${W - pad.r + 6}" y1="${Y(b.limit)}" y2="${Y(b.limit)}"/><text x="${W - pad.r + 10}" y="${Y(b.limit) + 3.5}">${compact(b.limit)}</text>
              <line class="baseline" x1="${pad.l}" x2="${W - pad.r + 6}" y1="${Y(0)}" y2="${Y(0)}"/><text x="${W - pad.r + 10}" y="${Y(0) + 3.5}">${compact(0)}</text>
              <line x1="${X(0)}" y1="${Y(0)}" x2="${X(n)}" y2="${Y(b.limit)}" stroke="var(--text-3)" stroke-width="1.5" stroke-linecap="round" opacity="0.7"/>
              <line class="grid-line" x1="${X(tm.elapsed)}" x2="${X(tm.elapsed)}" y1="${pad.t}" y2="${Y(0)}"/>
              <path class="line ${RM ? '' : 'anim-draw'}" d="${line}" stroke="${STATUS[s].color}" pathLength="1" stroke-dasharray="1" style="--from:1; --delay:350ms"/>
              <circle class="${RM ? '' : 'anim-pop'}" cx="${act[act.length - 1][0]}" cy="${act[act.length - 1][1]}" r="4.5" fill="${STATUS[s].color}" stroke="var(--surface-2)" stroke-width="2" style="--delay:1100ms"/>
              <text x="${X(0)}" y="${H - 4}">${fmtDate(b.start, { month: 'short', day: 'numeric' })}</text><text x="${X(tm.elapsed)}" y="${H - 4}" text-anchor="middle">Today</text><text x="${X(n)}" y="${H - 4}" text-anchor="end">${fmtDate(b.end, { month: 'short', day: 'numeric' })}</text>
            </svg>`;
          });
        },
      });
    }

    grid.addEventListener('click', (e) => {
      const m = e.target.closest('[data-bud-menu]');
      if (m) {
        e.stopPropagation();
        const b = M.budgets.find((x) => x.id === m.dataset.budMenu);
        Menu.open(m, [
          { label: 'Open details', icon: 'budgets', action: () => openBudget(b) },
          { label: 'Edit', icon: 'edit', action: () => budForm(b) },
          { label: 'Edit ranges (needs backend)', icon: 'clock', action: () => toast('Range editing needs backend support first', { icon: 'plug' }) },
          'sep',
          { label: 'Delete', icon: 'trash', danger: true, action: () => toast(`"${b.name}" budget deleted`, { icon: 'trash', action: { label: 'Undo', fn: () => toast('Restored') } }) },
        ]);
        return;
      }
      const c = e.target.closest('[data-bud]');
      if (c) openBudget(M.budgets.find((x) => x.id === c.dataset.bud));
    });
    $('#new-bud').onclick = () => budForm();
    const openId = params.get('open');
    if (openId) { const b = M.budgets.find((x) => x.id === openId); if (b) setTimeout(() => openBudget(b), RM ? 0 : 450); }
  }

  /* =============================================================== boot */
  const pages = { dashboard: pageDashboard, transactions: pageTransactions, accounts: pageAccounts, budgets: pageBudgets };
  (pages[PAGE] || pageDashboard)();
  // Entrances play once per load; afterwards re-renders are static.
  setTimeout(() => { ENTERED = true; root.classList.add('entered'); }, RM ? 0 : 1900);
})();
