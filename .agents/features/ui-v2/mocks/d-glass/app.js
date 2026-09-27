/* Master of Coin v2, direction D: Glass. Vanilla JS, renders every page from window.MOC. */
(() => {
  'use strict';
  const M = window.MOC;
  const doc = document.documentElement;
  const params = new URLSearchParams(location.search);
  const TODAY = new Date('2026-09-26T12:00:00'); // mock "today", matches the sample data
  const SERVER_TOTAL = 214; // mock server total for the transactions list
  const mqReduce = matchMedia('(prefers-reduced-motion: reduce)');
  const reduce = () => mqReduce.matches || params.has('rm');
  const fine = matchMedia('(hover: hover) and (pointer: fine)');

  /* ---------------- theme + options (applied before paint) ---------------- */
  const THEME_KEY = 'moc-glass-theme';
  const theme0 = params.get('theme') || localStorage.getItem(THEME_KEY) || 'dark';
  doc.dataset.theme = theme0;
  if (params.has('solid')) doc.classList.add('force-solid');

  /* spring as CSS linear(), for layout motion (collapse, row expand/collapse) */
  (function spring(damping = 0.82, response = 0.42) {
    const w = (2 * Math.PI) / response, z = damping, wd = w * Math.sqrt(1 - z * z);
    let T = 0; while (Math.exp(-z * w * T) > 0.002 && T < 3) T += 0.01;
    const pts = [];
    for (let i = 0; i <= 40; i++) {
      const t = (T * i) / 40;
      const x = 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + ((z * w) / wd) * Math.sin(wd * t));
      pts.push(+x.toFixed(4));
    }
    pts[40] = 1;
    doc.style.setProperty('--spring', `linear(${pts.join(', ')})`);
    doc.style.setProperty('--spring-dur', `${Math.round(T * 1000)}ms`);
  })();

  /* ---------------- helpers ---------------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  const MINUS = '−';
  const money = (n, cur = 'EUR', o = {}) => {
    const v = o.abs ? Math.abs(n) : n;
    let s = M.fmt(v, cur, o.fmt || {}).replace('-', MINUS);
    if (o.sign && n > 0) s = '+' + s;
    return s;
  };
  const compact = (n) => M.fmt(n, 'EUR', { notation: 'compact', maximumFractionDigits: 0 });
  const eurOf = (amount, cur) => amount * (M.fx[cur] || 1);
  const pct = (n, d = 0) => `${n.toFixed(d)}%`;
  const dayMs = 86400000;
  const parseD = (s) => new Date(s + 'T12:00:00');
  const fmtDate = (s, o = { month: 'short', day: 'numeric' }) => parseD(s).toLocaleDateString('en-US', o);
  const uid = (() => { let i = 0; return (p = 'g') => `${p}${++i}`; })();
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  /* ---------------- icons (24px, stroke) ---------------- */
  const P = {
    dashboard: '<rect x="3" y="3" width="7.5" height="9" rx="2"/><rect x="13.5" y="3" width="7.5" height="5.5" rx="2"/><rect x="13.5" y="11.5" width="7.5" height="9.5" rx="2"/><rect x="3" y="15" width="7.5" height="6" rx="2"/>',
    list: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>',
    wallet: '<path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18a1 1 0 0 1 1 1v2"/><rect x="3.5" y="7.5" width="17" height="12" rx="2.5"/><path d="M16 13.5h1.5"/>',
    target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r=".75"/>',
    tag: '<path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3a1.5 1.5 0 0 1 0 2.1l-6.2 6.2a1.5 1.5 0 0 1-2.1 0z"/><circle cx="8.5" cy="8.5" r="1.4"/>',
    users: '<circle cx="9" cy="8.5" r="3.5"/><path d="M2.8 20a6.2 6.2 0 0 1 12.4 0"/><path d="M15.5 5.2a3.4 3.4 0 0 1 0 6.6M18 14.2a6 6 0 0 1 3.2 5.8"/>',
    chart: '<path d="M3.5 20.5h17"/><rect x="5" y="11" width="3" height="7" rx="1"/><rect x="10.5" y="6" width="3" height="12" rx="1"/><rect x="16" y="13" width="3" height="5" rx="1"/>',
    jobs: '<rect x="6" y="6" width="12" height="12" rx="2.5"/><path d="M9.5 2.5v3.5M14.5 2.5v3.5M9.5 18v3.5M14.5 18v3.5M2.5 9.5H6M2.5 14.5H6M18 9.5h3.5M18 14.5h3.5"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/><path d="M12 13.5v2.5l1.5 1"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l.9 11.6a2 2 0 0 0 2 1.9h6.2a2 2 0 0 0 2-1.9L18 7M9 7V4.5h6V7"/>',
    settings: '<path d="M4 7h9M17 7h3M4 12h3M11 12h9M4 17h11M19 17h1"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="17" r="2"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    transfer: '<path d="M4 8h14.5M15 4.5 18.5 8 15 11.5M20 16H5.5M9 12.5 5.5 16 9 19.5"/>',
    import: '<path d="M12 3.5v11M7.5 10.5 12 15l4.5-4.5M4.5 16v2.5a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V16"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
    left: '<path d="M14.5 6 8.5 12l6 6"/>',
    right: '<path d="m9.5 6 6 6-6 6"/>',
    down: '<path d="m6 9.5 6 6 6-6"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"/>',
    moon: '<path d="M19.5 14.6A8 8 0 0 1 9.4 4.5a8 8 0 1 0 10.1 10.1z"/>',
    more: '<circle cx="12" cy="5.5" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="12" cy="18.5" r="1.3"/>',
    grid: '<circle cx="6" cy="6" r="1.5"/><circle cx="12" cy="6" r="1.5"/><circle cx="18" cy="6" r="1.5"/><circle cx="6" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="18" cy="12" r="1.5"/><circle cx="6" cy="18" r="1.5"/><circle cx="12" cy="18" r="1.5"/><circle cx="18" cy="18" r="1.5"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    okc: '<circle cx="12" cy="12" r="8.5"/><path d="m8.5 12.2 2.4 2.4 4.6-4.8"/>',
    alert: '<path d="M10.3 4.2 2.9 17.5A2 2 0 0 0 4.6 20.5h14.8a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0z"/><path d="M12 9.5v4M12 17h.01"/>',
    over: '<circle cx="12" cy="12" r="8.5"/><path d="m9 9 6 6M15 9l-6 6"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    sync: '<path d="M19.5 10A7.8 7.8 0 0 0 5.8 7.2L4.5 8.5M4.5 4.5v4h4M4.5 14a7.8 7.8 0 0 0 13.7 2.8l1.3-1.3M19.5 19.5v-4h-4"/>',
    split: '<circle cx="7" cy="7" r="3"/><circle cx="17" cy="7" r="3"/><path d="M7 10v2.5a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V10M12 14.5v6"/>',
    repeat: '<path d="m17 3 3.5 3.5L17 10"/><path d="M3.5 12v-1.5a4 4 0 0 1 4-4h13"/><path d="m7 21-3.5-3.5L7 14"/><path d="M20.5 12v1.5a4 4 0 0 1-4 4h-13"/>',
    note: '<path d="M6 3.5h8l4 4v13H6z"/><path d="M14 3.5v4h4M9 12h6M9 16h4"/>',
    globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.4 2.4 3.5 5.3 3.5 8.5s-1.1 6.1-3.5 8.5c-2.4-2.4-3.5-5.3-3.5-8.5S9.6 5.9 12 3.5z"/>',
    paidby: '<circle cx="9" cy="8.5" r="3.5"/><path d="M2.8 20a6.2 6.2 0 0 1 12.4 0"/><path d="m15.5 11.5 2 2 4-4"/>',
    edit: '<path d="M4 20h4L19.2 8.8a2 2 0 0 0 0-2.8l-1.2-1.2a2 2 0 0 0-2.8 0L4 16z"/><path d="m13.5 6.5 4 4"/>',
    copy: '<rect x="8.5" y="8.5" width="12" height="12" rx="2.5"/><path d="M15.5 8.5V6a2.5 2.5 0 0 0-2.5-2.5H6A2.5 2.5 0 0 0 3.5 6v7A2.5 2.5 0 0 0 6 15.5h2.5"/>',
    filter: '<path d="M3.5 5h17l-6.5 7.5v5.5l-4 2v-7.5z"/>',
    panel: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9 4v16"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-.9.9M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l.9-.9"/>',
    archive: '<rect x="3" y="4" width="18" height="5" rx="1.5"/><path d="M5 9v9.5a1.5 1.5 0 0 0 1.5 1.5h11a1.5 1.5 0 0 0 1.5-1.5V9M10 13h4"/>',
    up: '<path d="M3.5 16.5 9 11l4 4 7.5-7.5M15 7.5h5.5V13"/>',
    plug: '<path d="M9 3v5M15 3v5M6.5 8h11v3.5a5.5 5.5 0 0 1-11 0zM12 17v4"/>',
    arrin: '<path d="M17 7 7 17M7 9.5V17h7.5"/>',
    arrout: '<path d="M7 17 17 7M9.5 7H17v7.5"/>',
    bank: '<path d="M3.5 9.5 12 4l8.5 5.5M5 10v8M9.7 10v8M14.3 10v8M19 10v8M3.5 20h17"/>',
    piggy: '<path d="M5 11a7 6 0 0 1 12.5-3.7L20 6.5v4l1 .5v3l-2 .5a7 7 0 0 1-2.5 2.5V20h-3v-2a8 8 0 0 1-3 0v2h-3v-3A6.3 6.3 0 0 1 5 11z"/><circle cx="15.5" cy="10.5" r=".6"/>',
    card: '<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M3 10h18M7 15h3"/>',
    invest: '<path d="M3.5 20.5h17"/><path d="m5 15 4.5-4.5 3.5 3.5L19 8"/><path d="M15 8h4v4"/>',
    cash: '<rect x="2.5" y="6" width="19" height="12" rx="2.5"/><circle cx="12" cy="12" r="2.5"/><path d="M6 9.5v.01M18 14.5v.01"/>',
    gift: '<rect x="3.5" y="8" width="17" height="12.5" rx="2"/><path d="M3.5 12h17M12 8v12.5M12 8S10.5 3.5 8 4.2 8.8 8 12 8zm0 0s1.5-4.5 4-3.8S15.2 8 12 8z"/>',
    debt: '<path d="M4 20.5h16M5.5 17V11M10 17v-6M14 17v-6M18.5 17v-6M3 9.5 12 4l9 5.5z"/>',
    coin: '<circle cx="12" cy="12" r="8"/><path d="M14.8 9.2a3.2 3.2 0 1 0 0 5.6M8 11h5M8 13h5"/>',
    info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8h.01"/>',
    cart: '<circle cx="9.5" cy="19.5" r="1.4"/><circle cx="17.5" cy="19.5" r="1.4"/><path d="M2.5 3.5h2.8l2.4 11.2a1.5 1.5 0 0 0 1.5 1.3h8.5a1.5 1.5 0 0 0 1.5-1.2L20.5 7.5H6"/>',
    fork: '<path d="M7 3v7a2 2 0 0 0 4 0V3M9 12v9M17.5 3C15.5 4 14.5 7 14.5 10.5h3V21"/>',
    home: '<path d="M3.5 10.8 12 4l8.5 6.8V19a1.5 1.5 0 0 1-1.5 1.5h-4.5v-6h-5v6H5A1.5 1.5 0 0 1 3.5 19z"/>',
    bolt: '<path d="M13 2.5 4.5 13.5H11L10 21.5 19.5 10H13z"/>',
    train: '<rect x="5.5" y="3" width="13" height="13.5" rx="3"/><path d="M5.5 10.5h13M9 21l1.5-4.5M15 21l-1.5-4.5"/><circle cx="9" cy="13.5" r=".6"/><circle cx="15" cy="13.5" r=".6"/>',
    bag: '<path d="M5 8h14l-1.1 11.1a1.5 1.5 0 0 1-1.5 1.4H7.6a1.5 1.5 0 0 1-1.5-1.4z"/><path d="M9 10.5V6.5a3 3 0 0 1 6 0v4"/>',
    film: '<rect x="3.5" y="4" width="17" height="16" rx="2.5"/><path d="M7.5 4v16M16.5 4v16M3.5 9h4M3.5 15h4M16.5 9h4M16.5 15h4"/>',
    heart: '<path d="M12 20s-7.5-4.6-8.9-9.4A4.6 4.6 0 0 1 12 7.3a4.6 4.6 0 0 1 8.9 3.3C19.5 15.4 12 20 12 20z"/>',
    plane: '<path d="M10.2 13.8 3 11l1.5-1.6 7.8.8 4.4-4.9a2 2 0 0 1 2.9 2.8l-4.9 4.4.8 7.8L14 21.8l-2.8-7.2z"/>',
    briefcase: '<rect x="3" y="7" width="18" height="13" rx="2.5"/><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3 12.5h18"/>',
  };
  const icon = (n, cls = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false" class="${cls}">${P[n] || P.info}</svg>`;
  const nb = (what = '') => `<span class="nb" title="${esc(what || 'This panel needs data the backend does not expose yet')}">${icon('plug')}Needs backend</span>`;

  const catOf = (id) => (id ? M.cat(id) : null);
  const catIcon = (c, extra = '') => c
    ? `<span class="cat-ic ${extra}" style="--c:${c.color}">${icon(c.icon)}</span>`
    : `<span class="cat-ic none ${extra}">${icon('tag')}</span>`;

  const TYPES = {
    CHECKING: { label: 'Checking', plural: 'Everyday accounts', icon: 'bank', color: '#7d6bff' },
    SAVINGS: { label: 'Savings', plural: 'Savings', icon: 'piggy', color: '#2fc0d6' },
    INVESTMENT: { label: 'Investment', plural: 'Investments', icon: 'invest', color: '#d77ad9' },
    CASH: { label: 'Cash', plural: 'Cash and gift cards', icon: 'cash', color: '#8fa7d6' },
    GIFT_CARD: { label: 'Gift card', plural: 'Cash and gift cards', icon: 'gift', color: '#8fa7d6' },
    CREDIT_CARD: { label: 'Credit card', plural: 'Credit cards', icon: 'card', color: '#ff8189', liab: true },
    DEBT: { label: 'Debt', plural: 'Loans and debt', icon: 'debt', color: '#ff8189', liab: true },
  };
  const isLiab = (a) => TYPES[a.account_type].liab || a.balance < 0;
  const assets = M.accounts.filter((a) => !isLiab(a)).reduce((s, a) => s + M.toEur(a), 0);
  const liabs = M.accounts.filter(isLiab).reduce((s, a) => s + M.toEur(a), 0);

  /* ---------------- budgets math ---------------- */
  const budgetInfo = (b) => {
    const p = (b.spent / b.limit) * 100;
    const status = p > 100 ? 'EXCEEDED' : p >= 80 ? 'WARNING' : 'OK';
    const s = parseD(b.start), e = parseD(b.end);
    const total = Math.round((e - s) / dayMs) + 1;
    const elapsed = clamp(Math.round((TODAY - s) / dayMs) + 1, 0, total);
    const daysLeft = Math.max(0, Math.round((e - TODAY) / dayMs));
    const expected = (elapsed / total) * 100;
    const ahead = p > expected + 3;
    return { p, status, daysLeft, expected, ahead, remaining: b.limit - b.spent };
  };
  const STATUS = {
    OK: { cls: 'ok', label: 'OK', icon: 'okc', color: 'var(--pos)' },
    WARNING: { cls: 'warning', label: 'Warning', icon: 'alert', color: 'var(--warn)' },
    EXCEEDED: { cls: 'exceeded', label: 'Exceeded', icon: 'over', color: 'var(--neg)' },
  };
  const statusChip = (s) => `<span class="status ${STATUS[s].cls}">${icon(STATUS[s].icon)}${STATUS[s].label}</span>`;

  /* ---------------- shell ---------------- */
  const NAV_ICON = { Dashboard: 'dashboard', Transactions: 'list', Accounts: 'wallet', Budgets: 'target', Categories: 'tag', People: 'users', Reports: 'chart', Jobs: 'jobs', Schedules: 'calendar', Trash: 'trash', Settings: 'settings' };
  const MOCKED = ['Dashboard', 'Transactions', 'Accounts', 'Budgets'];
  const initials = M.user.name.split(' ').map((w) => w[0]).join('').slice(0, 2);

  function navItems(page, withSeps = true) {
    return M.nav.map((n, i) => {
      const sep = withSeps && (i === 4 || i === 7) ? '<div class="nav-sep" role="presentation"></div>' : '';
      if (MOCKED.includes(n)) {
        const cur = n.toLowerCase() === page ? ' aria-current="page"' : '';
        return `${sep}<a href="${n.toLowerCase()}.html"${cur} title="${n}">${icon(NAV_ICON[n])}<span class="label-fade">${n}</span></a>`;
      }
      return `${sep}<span class="nav-item" title="${n} (not part of this mock)">${icon(NAV_ICON[n])}<span class="label-fade">${n}</span></span>`;
    }).join('');
  }

  function shell(page, { title, sub, actions = '' }) {
    const collapsed = localStorage.getItem('moc-glass-collapsed') === '1';
    document.body.insertAdjacentHTML('afterbegin', `
      <a class="skip" href="#content">Skip to content</a>
      <div class="ambient" aria-hidden="true"><i class="f1"></i><i class="f2"></i><i class="f3"></i><i class="f4"></i><div class="vignette"></div><div class="grain"></div></div>
      <div class="app${collapsed ? ' collapsed' : ''}" id="app">
        <aside class="sidebar" aria-label="Primary">
          <div class="brand"><span class="brand-mark">${icon('coin')}</span><span class="brand-name label-fade">Master of Coin<small>Personal finance</small></span></div>
          <nav class="nav" aria-label="Main">${navItems(page)}</nav>
          <div class="side-foot">
            <div class="user" title="${esc(M.user.name)}"><span class="avatar" aria-hidden="true">${initials}</span><div class="user-meta label-fade"><b>${esc(M.user.name)}</b><span>${esc(M.user.email)}</span></div></div>
            <div class="side-row"><span class="version label-fade">v${esc(M.user.version)}</span>
              <button class="icon-btn sm bare" id="collapse" aria-label="${collapsed ? 'Expand' : 'Collapse'} sidebar" aria-expanded="${!collapsed}">${icon('panel')}</button></div>
          </div>
        </aside>
        <div class="main" id="main">
          <header class="topbar">
            <div class="mobile-top"><span class="brand-mark">${icon('coin')}</span><b>Master of Coin</b></div>
            <div class="titles"><h1>${esc(title)}</h1>${sub ? `<p class="sub">${sub}</p>` : ''}</div>
            <div class="actions">${actions}
              <button class="icon-btn theme-toggle" id="theme" aria-label="Switch to ${theme0 === 'dark' ? 'light' : 'dark'} theme"><span class="ic ic-sun">${icon('sun')}</span><span class="ic ic-moon">${icon('moon')}</span></button>
            </div>
          </header>
          <main id="content" tabindex="-1" class="mounting"></main>
        </div>
        <nav class="tabbar" aria-label="Main">
          ${MOCKED.map((n) => `<a href="${n.toLowerCase()}.html"${n.toLowerCase() === page ? ' aria-current="page"' : ''}>${icon(NAV_ICON[n])}<span>${n}</span></a>`).join('')}
          <button id="more-nav" aria-haspopup="dialog">${icon('grid')}<span>More</span></button>
        </nav>
      </div>
      <div class="toasts" role="status" aria-live="polite"></div>`);

    $('#theme').addEventListener('click', (e) => toggleTheme(e.currentTarget));
    $('#collapse').addEventListener('click', toggleCollapse);
    $('#more-nav').addEventListener('click', openMoreNav);
    return $('#content');
  }

  function toggleCollapse() {
    const app = $('#app'), main = $('#main');
    const before = main.getBoundingClientRect().left;
    const on = !app.classList.contains('collapsed');
    app.classList.toggle('collapsed', on);
    localStorage.setItem('moc-glass-collapsed', on ? '1' : '0');
    const btn = $('#collapse');
    btn.setAttribute('aria-expanded', String(!on));
    btn.setAttribute('aria-label', `${on ? 'Expand' : 'Collapse'} sidebar`);
    if (reduce()) return;
    const dx = before - main.getBoundingClientRect().left;
    const cs = getComputedStyle(doc);
    main.animate([{ transform: `translateX(${dx}px)` }, { transform: 'none' }], { duration: parseInt(cs.getPropertyValue('--spring-dur')), easing: cs.getPropertyValue('--spring').trim() });
    $('.sidebar').animate([{ transform: `scaleX(${on ? 1.06 : 0.94})`, transformOrigin: 'left center' }, { transform: 'none', transformOrigin: 'left center' }], { duration: parseInt(cs.getPropertyValue('--spring-dur')), easing: cs.getPropertyValue('--spring').trim() });
    resizeCharts();
  }

  function toggleTheme(btn) {
    const next = doc.dataset.theme === 'dark' ? 'light' : 'dark';
    const apply = () => {
      doc.dataset.theme = next;
      localStorage.setItem(THEME_KEY, next);
      btn.setAttribute('aria-label', `Switch to ${next === 'dark' ? 'light' : 'dark'} theme`);
    };
    // snap every colour transition for the swap, the reveal does the motion
    const snap = () => {
      const st = document.createElement('style');
      st.textContent = '*,*::before,*::after{transition:none!important}';
      document.head.appendChild(st); apply(); void doc.offsetWidth;
      requestAnimationFrame(() => requestAnimationFrame(() => st.remove()));
    };
    if (!document.startViewTransition || reduce()) { snap(); return; }
    const r = btn.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const rad = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    const vt = document.startViewTransition(snap);
    vt.ready.then(() => {
      doc.animate({ clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${rad}px at ${x}px ${y}px)`] },
        { duration: 600, easing: 'cubic-bezier(0.22, 0, 0.12, 1)', pseudoElement: '::view-transition-new(root)' });
    });
  }

  function openMoreNav() {
    openDrawer({
      title: 'Menu',
      body: `<nav class="nav" aria-label="All pages" style="margin:0">${navItems(location.pathname.split('/').pop().replace('.html', ''), false)}</nav>
        <div class="user" style="margin-top:16px"><span class="avatar" aria-hidden="true">${initials}</span><div class="user-meta"><b>${esc(M.user.name)}</b><span>${esc(M.user.email)}</span></div></div>
        <p class="version" style="margin-top:12px;padding:0 4px">v${esc(M.user.version)}</p>`,
    });
  }

  /* ---------------- entrance, count-up, draw-in ---------------- */
  function mount(root) {
    $$('.rv', root).forEach((n, i) => n.style.setProperty('--i', Math.min(i, 14)));
    setTimeout(() => root.classList.remove('mounting'), 2400);
    const io = new IntersectionObserver((ents) => {
      ents.forEach((en) => {
        if (!en.isIntersecting) return;
        io.unobserve(en.target);
        const host = en.target.closest('.rv');
        const i = host ? +getComputedStyle(host).getPropertyValue('--i') || 0 : 0;
        const delay = reduce() ? 0 : Math.max(0, i * 55 + 220 - (performance.now() - t0));
        setTimeout(() => {
          en.target.classList.add('drawn');
          $$('[data-count]', en.target).concat(en.target.matches('[data-count]') ? [en.target] : []).forEach(countUp);
        }, delay);
      });
    }, { threshold: 0.2 });
    $$('.drawable', root).forEach((n) => io.observe(n));
  }
  const t0 = performance.now();

  function countUp(node) {
    if (node.dataset.counted) return; node.dataset.counted = '1';
    const to = +node.dataset.count, cur = node.dataset.cur || 'EUR';
    const fmt = (v) => money(v, cur, { sign: node.dataset.sign === '1' });
    if (reduce()) { node.textContent = fmt(to); return; }
    const dur = +(node.dataset.dur || 1100), start = performance.now();
    const ease = (t) => 1 - Math.pow(2, -10 * t);
    const tick = (now) => {
      const t = Math.min(1, (now - start) / dur);
      node.textContent = fmt(t >= 1 ? to : to * ease(t));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
  // A count-up figure: visible span animates, sr text holds the final value
  const countFig = (v, cls, o = {}) => `<span class="${cls}"><span class="sr-only">${money(v, o.cur || 'EUR', o)}</span><span aria-hidden="true" data-count="${v}" data-cur="${o.cur || 'EUR'}" data-sign="${o.sign ? 1 : 0}">${money(reduce() ? v : 0, o.cur || 'EUR')}</span></span>`;

  /* pointer sheen + tilt (spring-smoothed with rAF), fine pointers only */
  function attachSheen(node, { tilt = false } = {}) {
    node.classList.add('has-sheen');
    const clip = el('<span class="sheen-clip" aria-hidden="true"><span class="sheen"></span></span>');
    node.prepend(clip);
    if (!fine.matches) return;
    const sheen = clip.firstChild;
    let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0;
    const loop = () => {
      cx += (tx - cx) * 0.14; cy += (ty - cy) * 0.14;
      node.style.transform = `perspective(900px) rotateX(${cy.toFixed(3)}deg) rotateY(${cx.toFixed(3)}deg)`;
      if (Math.abs(tx - cx) > 0.01 || Math.abs(ty - cy) > 0.01) raf = requestAnimationFrame(loop);
      else { raf = 0; if (!tx && !ty) node.style.transform = ''; }
    };
    node.addEventListener('pointermove', (e) => {
      const r = node.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      sheen.style.transform = `translate(${e.clientX - r.left}px, ${e.clientY - r.top}px)`;
      if (tilt && !reduce()) { tx = (px - 0.5) * 7; ty = (0.5 - py) * 6; if (!raf) raf = requestAnimationFrame(loop); }
    });
    node.addEventListener('pointerleave', () => { if (tilt) { tx = 0; ty = 0; if (!raf) raf = requestAnimationFrame(loop); } });
  }

  /* ---------------- charts ---------------- */
  const charts = [];
  let rsT;
  function resizeCharts() { clearTimeout(rsT); rsT = setTimeout(() => charts.forEach((c) => c()), 180); }
  addEventListener('resize', resizeCharts);

  function niceTicks(lo, hi, n = 4) {
    const span = hi - lo, raw = span / n, mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = [1, 2, 2.5, 5, 10].map((s) => s * mag).find((s) => span / s <= n) || 10 * mag;
    const a = Math.floor(lo / step) * step, b = Math.ceil(hi / step) * step, out = [];
    for (let v = a; v <= b + 1e-6; v += step) out.push(v);
    return out;
  }
  function monoPath(pts) {
    const n = pts.length, m = [], t = [];
    for (let i = 0; i < n - 1; i++) m[i] = (pts[i + 1].y - pts[i].y) / (pts[i + 1].x - pts[i].x);
    t[0] = m[0]; t[n - 1] = m[n - 2];
    for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
    for (let i = 0; i < n - 1; i++) {
      if (m[i] === 0) { t[i] = t[i + 1] = 0; continue; }
      const a = t[i] / m[i], b = t[i + 1] / m[i], s = a * a + b * b;
      if (s > 9) { const k = 3 / Math.sqrt(s); t[i] = k * a * m[i]; t[i + 1] = k * b * m[i]; }
    }
    let d = `M${pts[0].x},${pts[0].y}`;
    for (let i = 0; i < n - 1; i++) {
      const h = (pts[i + 1].x - pts[i].x) / 3;
      d += ` C${pts[i].x + h},${pts[i].y + t[i] * h} ${pts[i + 1].x - h},${pts[i + 1].y - t[i + 1] * h} ${pts[i + 1].x},${pts[i + 1].y}`;
    }
    return d;
  }

  /* hover/keyboard layer shared by line + bars */
  function hoverLayer(host, svg, n, xAt, show, hide) {
    let idx = -1;
    const set = (i) => { idx = clamp(i, 0, n - 1); host.classList.add('hovering'); show(idx); };
    const off = () => { idx = -1; host.classList.remove('hovering'); hide(); };
    svg.addEventListener('pointermove', (e) => {
      const r = svg.getBoundingClientRect(); const x = e.clientX - r.left;
      let best = 0, bd = Infinity; for (let i = 0; i < n; i++) { const d = Math.abs(xAt(i) - x); if (d < bd) { bd = d; best = i; } }
      set(best);
    });
    svg.addEventListener('pointerleave', off);
    host.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); set(idx < 0 ? n - 1 : idx + (e.key === 'ArrowRight' ? 1 : -1)); }
      if (e.key === 'Escape' || e.key === 'Home') off();
    });
    host.addEventListener('blur', off);
  }
  function placeTip(host, tip, x, y) {
    const w = tip.offsetWidth, hw = host.clientWidth;
    let left = x + 14; if (left + w > hw) left = x - w - 14;
    tip.style.left = `${clamp(left, 0, hw - w)}px`; tip.style.top = `${Math.max(0, y - 20)}px`;
  }

  function lineChart(host, { values, labels, height, id }) {
    const render = (instant) => {
      const w = host.clientWidth, h = height;
      const pad = { l: 46, r: 14, t: 14, b: 26 };
      const lo = Math.min(...values), hi = Math.max(...values);
      const ticks = niceTicks(lo - (hi - lo) * 0.15, hi + (hi - lo) * 0.08, 4);
      const y0 = ticks[0], y1 = ticks[ticks.length - 1];
      const X = (i) => pad.l + (i * (w - pad.l - pad.r)) / (values.length - 1);
      const Y = (v) => pad.t + (1 - (v - y0) / (y1 - y0)) * (h - pad.t - pad.b);
      const pts = values.map((v, i) => ({ x: +X(i).toFixed(2), y: +Y(v).toFixed(2) }));
      const d = monoPath(pts);
      const area = `${d} L${pts.at(-1).x},${h - pad.b} L${pts[0].x},${h - pad.b} Z`;
      const g = uid('lg'), a = uid('ag'), f = uid('gf');
      host.innerHTML = `
        <svg width="${w}" height="${h}" role="img" aria-label="Net worth over the last 12 months">
          <defs>
            <linearGradient id="${g}" x1="0" x2="1"><stop offset="0" style="stop-color:var(--accent-2)"/><stop offset="1" style="stop-color:var(--accent)"/></linearGradient>
            <linearGradient id="${a}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" style="stop-color:var(--accent);stop-opacity:.32"/><stop offset="1" style="stop-color:var(--accent);stop-opacity:0"/></linearGradient>
            <filter id="${f}" x="-10%" y="-40%" width="120%" height="180%"><feGaussianBlur stdDeviation="6"/></filter>
          </defs>
          ${ticks.map((t) => `<line class="grid-line" x1="${pad.l}" x2="${w - pad.r}" y1="${Y(t)}" y2="${Y(t)}"/><text class="tick tick-end" x="${pad.l - 10}" y="${Y(t) + 4}">${compact(t)}</text>`).join('')}
          ${labels.map((l, i) => ((labels.length - 1 - i) % (w < 480 ? 2 : 1) === 0 ? `<text class="tick" text-anchor="middle" x="${X(i)}" y="${h - 6}">${l}</text>` : '')).join('')}
          <path class="draw-area" d="${area}" fill="url(#${a})"/>
          <path class="line-glow draw-line" d="${d}" stroke="url(#${g})" filter="url(#${f})"/>
          <path class="line-main draw-line" d="${d}" stroke="url(#${g})"/>
          <g class="end-dot"><circle class="pulse" cx="${pts.at(-1).x}" cy="${pts.at(-1).y}" r="5" style="fill:var(--accent)"/><circle cx="${pts.at(-1).x}" cy="${pts.at(-1).y}" r="5" class="dot-ring" style="fill:var(--accent)"/></g>
          <line class="cross" x1="0" x2="0" y1="${pad.t}" y2="${h - pad.b}"/>
          <circle class="hot dot-ring" r="5" style="fill:var(--accent)"/>
          <rect x="0" y="0" width="${w}" height="${h}" fill="transparent"/>
        </svg><div class="tip" aria-hidden="true"></div>`;
      const svg = host.firstElementChild, tip = host.lastElementChild;
      $$('.draw-line', svg).forEach((p) => p.style.setProperty('--L', Math.ceil(p.getTotalLength())));
      if (instant) host.classList.add('drawn');
      hoverLayer(host, svg, values.length, X, (i) => {
        $('.cross', svg).setAttribute('x1', X(i)); $('.cross', svg).setAttribute('x2', X(i));
        const hot = $('.hot', svg); hot.setAttribute('cx', X(i)); hot.setAttribute('cy', Y(values[i]));
        const prev = i > 0 ? values[i] - values[i - 1] : null;
        tip.innerHTML = `<b>${money(values[i])}</b>${labels[i]}${prev !== null ? `<div class="row"><span>vs prior month</span><span class="${prev >= 0 ? 'pos-t' : 'neg-t'}">${money(prev, 'EUR', { sign: true })}</span></div>` : ''}`;
        tip.classList.add('on'); placeTip(host, tip, X(i), Y(values[i]));
      }, () => tip.classList.remove('on'));
    };
    render(false);
    charts.push(() => render(true));
    host.tabIndex = 0;
    host.setAttribute('aria-describedby', id);
  }

  function barsChart(host, { data, height }) {
    const render = (instant) => {
      const w = host.clientWidth, h = height;
      const pad = { l: 46, r: 8, t: 12, b: 26 };
      const hi = Math.max(...data.flatMap((d) => [d.income, d.spend]));
      const ticks = niceTicks(0, hi, 4), top = ticks.at(-1);
      const slot = (w - pad.l - pad.r) / data.length;
      const bw = Math.min(14, (slot - 8) / 2);
      const Y = (v) => pad.t + (1 - v / top) * (h - pad.t - pad.b);
      const base = h - pad.b;
      const bar = (x, v) => { const y = Y(v), bh = base - y, r = Math.min(4, bw / 2, bh); return `M${x},${base} V${y + r} Q${x},${y} ${x + r},${y} H${x + bw - r} Q${x + bw},${y} ${x + bw},${y + r} V${base} Z`; };
      const cx = (i) => pad.l + slot * i + slot / 2;
      host.innerHTML = `
        <svg width="${w}" height="${h}" role="img" aria-label="Income and spending by month, last 12 months">
          ${ticks.map((t) => `<line class="grid-line" x1="${pad.l}" x2="${w - pad.r}" y1="${Y(t)}" y2="${Y(t)}"/><text class="tick tick-end" x="${pad.l - 10}" y="${Y(t) + 4}">${compact(t)}</text>`).join('')}
          <rect class="band hot" y="${pad.t}" width="${slot}" height="${base - pad.t}" rx="10" style="fill:var(--fill-1)"/>
          ${data.map((d, i) => `
            <path class="bar" style="fill:var(--series-in);transition-delay:${i * 35}ms" d="${bar(cx(i) - bw - 1, d.income)}"/>
            <path class="bar" style="fill:var(--series-out);transition-delay:${i * 35 + 60}ms" d="${bar(cx(i) + 1, d.spend)}"/>
            ${(data.length - 1 - i) % (w < 480 ? 2 : 1) === 0 ? `<text class="tick" text-anchor="middle" x="${cx(i)}" y="${h - 6}">${d.m}</text>` : ''}`).join('')}
          <rect x="0" y="0" width="${w}" height="${h}" fill="transparent"/>
        </svg><div class="tip" aria-hidden="true"></div>`;
      const svg = host.firstElementChild, tip = host.lastElementChild;
      if (instant) host.classList.add('drawn');
      hoverLayer(host, svg, data.length, cx, (i) => {
        const d = data[i];
        $('.band', svg).setAttribute('x', pad.l + slot * i);
        tip.innerHTML = `<b>${d.m}</b><div class="row"><span><i style="background:var(--series-in)"></i>Income</span><span>${money(d.income)}</span></div><div class="row"><span><i style="background:var(--series-out)"></i>Spend</span><span>${money(-d.spend)}</span></div><div class="row"><span>Net</span><span class="${d.income - d.spend >= 0 ? 'pos-t' : 'neg-t'}">${money(d.income - d.spend, 'EUR', { sign: true })}</span></div>`;
        tip.classList.add('on'); placeTip(host, tip, cx(i), Y(Math.max(d.income, d.spend)));
      }, () => tip.classList.remove('on'));
    };
    render(false);
    charts.push(() => render(true));
    host.tabIndex = 0;
  }

  function ring(p, color, size = 64, sw = 7, center = '', glow = true) {
    const r = (size - sw) / 2 - 2, C = 2 * Math.PI * r;
    const off = C * (1 - clamp(p, 0, 100) / 100);
    return `<div class="ring" style="width:${size}px;height:${size}px">
      <svg width="${size}" height="${size}" aria-hidden="true">
        <circle class="track" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="${sw}"/>
        <circle class="ring-arc" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="${sw}" style="stroke:${color};--C:${C.toFixed(2)};--off:${off.toFixed(2)};${glow ? `filter:drop-shadow(0 0 ${Math.round(sw * 0.9)}px color-mix(in oklab, ${color} 55%, transparent))` : ''}"/>
      </svg><div class="center">${center}</div></div>`;
  }

  function donut(items, total) {
    const size = 180, sw = 20, r = (size - sw) / 2, C = 2 * Math.PI * r, gap = 3;
    let acc = 0; const mk = uid('dm');
    const segs = items.map((it, i) => {
      const len = (it.total / total) * C; const s = acc; acc += len;
      return `<circle class="seg" data-i="${i}" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="${sw}" style="stroke:${it.color}" stroke-dasharray="${Math.max(0.1, len - gap)} ${C}" stroke-dashoffset="${-s}"/>`;
    }).join('');
    return `<div class="donut" style="position:relative;width:${size}px;height:${size}px">
      <svg width="${size}" height="${size}" style="transform:rotate(-90deg)" aria-hidden="true">
        <defs><mask id="${mk}"><circle class="donut-mask" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="#fff" stroke-width="${sw + 6}" style="--C:${C.toFixed(2)}"/></mask></defs>
        <g mask="url(#${mk})">${segs}</g>
      </svg>
      <div class="donut-center"><span class="k">Spent in Sep</span><span class="v">${money(-total)}</span></div></div>`;
  }

  /* ---------------- overlays ---------------- */
  function openDrawer({ title, body, foot = '', cls = 'drawer', onReady }) {
    const lid = uid('dh');
    const d = el(`<dialog class="${cls}" aria-labelledby="${lid}">
      <div class="drawer-head"><h2 id="${lid}" tabindex="-1" style="outline:none">${title}</h2><button class="icon-btn sm" data-close aria-label="Close">${icon('x')}</button></div>
      <div class="drawer-body">${body}</div>${foot ? `<div class="drawer-foot">${foot}</div>` : ''}</dialog>`);
    const opener = document.activeElement;
    document.body.appendChild(d);
    d.showModal();
    $(`#${lid}`, d).focus();
    d.classList.add('opening');
    d.addEventListener('animationend', () => d.classList.remove('opening'), { once: true });
    const close = () => {
      if (d.classList.contains('closing')) return;
      d.classList.add('closing');
      const done = () => { d.close(); d.remove(); if (opener && opener.focus) opener.focus(); };
      if (reduce() && !getComputedStyle(d).animationName.includes('fade')) done();
      else { d.addEventListener('animationend', done, { once: true }); setTimeout(done, 450); }
    };
    d.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
    d.addEventListener('click', (e) => { if (e.target === d || e.target.closest('[data-close]')) close(); });
    d.closeDrawer = close;
    if (onReady) onReady(d, close);
    return d;
  }
  function confirmDialog({ title, text, confirm = 'Delete', onConfirm }) {
    const lid = uid('cd');
    const d = el(`<dialog class="dialog" aria-labelledby="${lid}"><h2 id="${lid}">${title}</h2><p>${text}</p>
      <div class="row"><button class="btn" data-close>Cancel</button><button class="btn primary" data-ok style="background:var(--neg);box-shadow:0 8px 24px -8px var(--neg)">${confirm}</button></div></dialog>`);
    const opener = document.activeElement;
    document.body.appendChild(d); d.showModal(); d.classList.add('opening');
    d.addEventListener('animationend', () => d.classList.remove('opening'), { once: true });
    const close = () => { d.classList.add('closing'); const done = () => { d.close(); d.remove(); opener?.focus?.(); }; d.addEventListener('animationend', done, { once: true }); setTimeout(done, 300); };
    d.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
    d.addEventListener('click', (e) => { if (e.target === d || e.target.closest('[data-close]')) close(); if (e.target.closest('[data-ok]')) { close(); onConfirm?.(); } });
    $('[data-close]', d).focus();
  }

  let menuEl = null;
  function closeMenu(focusBack = true) {
    if (!menuEl) return; const m = menuEl; menuEl = null;
    m.classList.remove('on'); setTimeout(() => m.remove(), 160);
    if (focusBack) m._trigger?.focus();
    m._trigger?.setAttribute('aria-expanded', 'false');
  }
  function openMenu(trigger, items) {
    if (menuEl) { const same = menuEl._trigger === trigger; closeMenu(false); if (same) return; }
    const m = el(`<div class="menu" role="menu">${items.map((it, i) => it === '-' ? '<hr>' : `<button role="menuitem" data-i="${i}" class="${it.danger ? 'danger' : ''}" ${it.nb ? 'aria-disabled="true"' : ''}>${icon(it.icon)}<span style="flex:1">${it.label}</span>${it.nb ? nb() : ''}</button>`).join('')}</div>`);
    document.body.appendChild(m);
    const r = trigger.getBoundingClientRect(), mw = m.offsetWidth, mh = m.offsetHeight;
    let top = r.bottom + 6, originY = 'top';
    if (top + mh > innerHeight - 12) { top = r.top - mh - 6; originY = 'bottom'; }
    m.style.top = `${top}px`; m.style.left = `${clamp(r.right - mw, 12, innerWidth - mw - 12)}px`;
    m.style.setProperty('--origin', `${originY} right`);
    m._trigger = trigger; menuEl = m;
    trigger.setAttribute('aria-expanded', 'true');
    requestAnimationFrame(() => m.classList.add('on'));
    const btns = $$('button', m); btns[0]?.focus();
    m.addEventListener('keydown', (e) => {
      const i = btns.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); btns[(i + 1) % btns.length].focus(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); btns[(i - 1 + btns.length) % btns.length].focus(); }
      if (e.key === 'Escape' || e.key === 'Tab') { e.preventDefault(); closeMenu(); }
    });
    m.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      const it = items[+b.dataset.i]; if (it.nb) { toast(`${it.label} needs backend support`, { icon: 'plug' }); closeMenu(); return; }
      closeMenu(false); it.onSelect?.();
    });
  }
  document.addEventListener('pointerdown', (e) => { if (menuEl && !menuEl.contains(e.target) && e.target.closest('[aria-haspopup="menu"]') !== menuEl._trigger) closeMenu(false); });

  function toast(msg, { action, onAction, icon: ic = 'okc', sticky = !!action } = {}) {
    const host = $('.toasts');
    const t = el(`<div class="toast enter">${icon(ic)}<span>${msg}</span>${action ? `<button class="btn sm" data-act>${action}</button>` : ''}<button class="icon-btn sm bare" data-x aria-label="Dismiss">${icon('x')}</button></div>`);
    host.appendChild(t);
    requestAnimationFrame(() => requestAnimationFrame(() => t.classList.remove('enter')));
    const kill = () => { t.classList.add('leave'); setTimeout(() => t.remove(), 220); };
    t.addEventListener('click', (e) => { if (e.target.closest('[data-act]')) { onAction?.(); kill(); } if (e.target.closest('[data-x]')) kill(); });
    if (!sticky) setTimeout(kill, 5000);
    return t;
  }

  /* ---------------- shared forms ---------------- */
  const acctOpts = (sel) => M.accounts.map((a) => `<option value="${a.id}" ${a.id === sel ? 'selected' : ''}>${esc(a.name)} (${a.currency})</option>`).join('');
  const catOpts = (sel) => `<option value="">Uncategorized</option>` + M.categories.map((c) => `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>${esc(c.name)}</option>`).join('');
  function formTxn(t = {}, mode = 'Add') {
    const id = uid('f');
    openDrawer({
      title: `${mode} transaction`,
      body: `<form class="form" id="${id}" onsubmit="return false">
        <div class="field"><label for="${id}t">Title</label><input class="input" id="${id}t" value="${esc(t.title || '')}" autocomplete="off"></div>
        <div class="two">
          <div class="field"><label for="${id}a">Amount</label><input class="input" id="${id}a" inputmode="decimal" value="${t.amount != null ? Math.abs(t.amount) : ''}"></div>
          <div class="field"><span class="flabel" id="${id}sl">Direction</span><div class="seg" role="group" aria-labelledby="${id}sl"><button type="button" aria-pressed="${!(t.amount > 0)}">Money out</button><button type="button" aria-pressed="${t.amount > 0}">Money in</button></div></div>
        </div>
        <div class="two">
          <div class="field"><label for="${id}d">Date</label><input class="input" type="date" id="${id}d" value="${t.date || '2026-09-26'}"></div>
          <div class="field"><label for="${id}acc">Account</label><select class="select" id="${id}acc">${acctOpts(t.account_id || 'a-main')}</select></div>
        </div>
        <div class="field"><label for="${id}c">Category</label><select class="select" id="${id}c">${catOpts(t.category_id)}</select></div>
        <div class="field"><label for="${id}n">Notes</label><textarea class="input" id="${id}n">${esc(t.notes || '')}</textarea></div>
        <label class="switch"><span>Split with people</span><input type="checkbox" ${t.splits ? 'checked' : ''}></label>
        <label class="switch"><span>Paid by someone else</span><input type="checkbox" ${t.debt ? 'checked' : ''}></label>
      </form>`,
      foot: `<button class="btn primary" data-save>${mode === 'Add' ? 'Add transaction' : 'Save changes'}</button><button class="btn ghost" data-close>Cancel</button>`,
      onReady: (d, close) => {
        segs(d);
        $('[data-save]', d).addEventListener('click', () => { close(); toast(mode === 'Add' ? 'Transaction added' : 'Changes saved'); });
      },
    });
  }
  function formTransfer(src) {
    const id = uid('f');
    openDrawer({
      title: src ? 'Convert to transfer' : 'New transfer',
      body: `<form class="form" onsubmit="return false">
        ${src ? `<div class="note-box">${esc(src.title)}, ${money(src.amount, src.currency || 'EUR')} on ${fmtDate(src.date)} becomes the outgoing leg.</div>` : ''}
        <div class="two">
          <div class="field"><label for="${id}f">From</label><select class="select" id="${id}f">${acctOpts(src?.account_id || 'a-main')}</select></div>
          <div class="field"><label for="${id}t">To</label><select class="select" id="${id}t">${acctOpts('a-save')}</select></div>
        </div>
        <div class="two">
          <div class="field"><label for="${id}s">Amount sent</label><input class="input" id="${id}s" inputmode="decimal" value="${src ? Math.abs(src.amount) : ''}"></div>
          <div class="field"><label for="${id}r">Amount received</label><input class="input" id="${id}r" inputmode="decimal" value="${src ? Math.abs(src.amount) : ''}"></div>
        </div>
        <p class="muted" style="font-size:12px">Legs can differ for same-currency fees or discounts.</p>
        ${src ? `<div class="field"><label for="${id}l">Or link an existing transaction</label><select class="select" id="${id}l"><option>Create a new incoming leg</option>${M.transactions.filter((x) => x.amount > 0).map((x) => `<option>${esc(x.title)}, ${money(x.amount)}</option>`).join('')}</select></div>` : `<div class="field"><label for="${id}d">Date</label><input class="input" type="date" id="${id}d" value="2026-09-26"></div>`}
      </form>`,
      foot: `<button class="btn primary" data-save>${src ? 'Convert' : 'Create transfer'}</button><button class="btn ghost" data-close>Cancel</button>`,
      onReady: (d, close) => $('[data-save]', d).addEventListener('click', () => { close(); toast(src ? 'Converted to a transfer' : 'Transfer created'); }),
    });
  }
  function formImport() {
    const id = uid('f');
    openDrawer({
      title: 'Import CSV',
      body: `<div class="form">
        <div class="dropzone">${icon('import')}<b>Drop a CSV statement here</b><span class="muted" style="font-size:13px">or</span><label class="btn sm" for="${id}file">Choose file</label><input id="${id}file" type="file" accept=".csv" class="sr-only"></div>
        <div class="field"><label for="${id}a">Import into</label><select class="select" id="${id}a">${acctOpts('a-main')}</select></div>
        <div class="field"><label for="${id}p">Date format</label><select class="select" id="${id}p"><option>YYYY-MM-DD</option><option>DD/MM/YYYY</option><option>MM/DD/YYYY</option></select></div>
        <label class="switch"><span>Skip rows that look like duplicates</span><input type="checkbox" checked></label>
      </div>`,
      foot: `<button class="btn primary" data-save>Preview import</button><button class="btn ghost" data-close>Cancel</button>`,
      onReady: (d, close) => $('[data-save]', d).addEventListener('click', () => { close(); toast('Choose a file to preview', { icon: 'info' }); }),
    });
  }
  function segs(root) {
    $$('.seg', root).forEach((g) => g.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      $$('button', g).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      g.dispatchEvent(new CustomEvent('segchange', { detail: b.dataset.v, bubbles: true }));
    }));
  }
  const quickActions = (cls = '') => `
    <button class="btn primary icon-lead ${cls}" data-qa="add" aria-label="Add transaction">${icon('plus')}<span class="lbl">Add transaction</span></button>
    <button class="btn icon-lead" data-qa="transfer" aria-label="Transfer">${icon('transfer')}<span class="lbl">Transfer</span></button>
    <button class="btn icon-lead" data-qa="import" aria-label="Import CSV">${icon('import')}<span class="lbl">Import</span></button>`;
  document.addEventListener('click', (e) => {
    const q = e.target.closest('[data-qa]'); if (!q) return;
    ({ add: () => formTxn(), transfer: () => formTransfer(), import: formImport })[q.dataset.qa]();
  });

  /* ---------------- transaction row pieces ---------------- */
  function txAmount(t) {
    const cur = t.currency || M.acct(t.account_id).currency;
    const native = money(t.amount, cur, { sign: true });
    const eq = cur !== 'EUR' ? `<small>${money(eurOf(t.amount, cur), 'EUR', { sign: true })}</small>` : '';
    return `<div class="tx-amt ${t.amount > 0 ? 'amt-in' : ''}">${native}${eq}</div>`;
  }
  function txBadges(t, interactive = true) {
    const b = [];
    if (t.splits) b.push(interactive
      ? `<button class="chip accent open-btn" style="border:0;cursor:pointer" aria-expanded="false" data-expand="${t.id}">${icon('split')}Split with ${esc(t.splits.map((s) => s.person).join(', '))}${icon('down', 'chev')}</button>`
      : `<span class="chip accent">${icon('split')}Split with ${esc(t.splits.map((s) => s.person).join(', '))}</span>`);
    if (t.transfer) b.push(`<span class="chip">${icon('transfer')}Transfer, ${esc(t.transfer.linked)}</span>`);
    if (t.debt) b.push(`<span class="chip warn">${icon('paidby')}Paid by ${esc(t.debt.paidBy)}</span>`);
    if (t.recurring) b.push(`<span class="chip">${icon('repeat')}Recurring</span>`);
    if (t.notes) b.push(`<span class="chip" title="${esc(t.notes)}">${icon('note')}<span class="sr-only">Note: </span>${esc(t.notes)}</span>`);
    if (t.currency && t.currency !== 'EUR') b.push(`<span class="chip">${icon('globe')}${t.currency}</span>`);
    return b.join('');
  }
  const txIcon = (t) => t.transfer ? `<span class="cat-ic" style="--c:#8c93b8">${icon('transfer')}</span>` : catIcon(catOf(t.category_id));
  const txMeta = (t) => `${esc(catOf(t.category_id)?.name || (t.transfer ? 'Transfer' : 'Uncategorized'))} · ${esc(M.acct(t.account_id).name)}`;

  function txDetail(t, actions = {}) {
    const cur = t.currency || M.acct(t.account_id).currency;
    const c = catOf(t.category_id);
    const share = t.splits ? Math.abs(t.amount) - t.splits.reduce((s, x) => s + x.amount, 0) : null;
    openDrawer({
      title: 'Transaction',
      body: `
        <div style="display:flex;align-items:center;gap:12px;margin-top:4px">${txIcon(t)}<div><div style="font-weight:600;font-size:16px">${esc(t.title)}</div><div class="muted" style="font-size:13px">${fmtDate(t.date, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</div></div></div>
        <div class="detail-amt ${t.amount > 0 ? 'pos-t' : ''}">${money(t.amount, cur, { sign: true })}</div>
        ${cur !== 'EUR' ? `<div class="muted">${money(eurOf(t.amount, cur), 'EUR', { sign: true })} at ${M.fx[cur]} EUR per ${cur}</div>` : `<div class="muted">${t.amount < 0 ? 'Money out' : 'Money in'}</div>`}
        <div class="badges" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:14px">${txBadges(t, false)}</div>
        <dl class="detail-grid">
          <dt>Category</dt><dd>${c ? `<span style="width:8px;height:8px;border-radius:3px;background:${c.color}"></span>${esc(c.name)}` : t.transfer ? 'Transfer' : 'Uncategorized'}</dd>
          <dt>Account</dt><dd>${esc(M.acct(t.account_id).name)} <span class="chip">${cur}</span></dd>
          ${t.transfer ? `<dt>Linked to</dt><dd>${icon('link', '')}${esc(t.transfer.linked)}</dd>` : ''}
          ${t.debt ? `<dt>Paid by</dt><dd>${esc(t.debt.paidBy)}, ${money(t.debt.total)} total. You owe ${money(Math.abs(t.amount))}</dd>` : ''}
          ${t.recurring ? '<dt>Repeats</dt><dd>Monthly</dd>' : ''}
        </dl>
        ${t.splits ? `<div class="dsection"><h3>Split</h3><div class="kv">
          <span class="k">${icon('users')}You</span><span class="v">${money(share, cur)}</span>
          ${t.splits.map((s) => `<span class="k"><span class="person" style="width:22px;height:22px;font-size:11px">${esc(s.person[0])}</span>${esc(s.person)} owes you</span><span class="v pos-t">${money(s.amount, cur)}</span>`).join('')}
          <span class="k sum">Total</span><span class="v sum">${money(Math.abs(t.amount), cur)}</span></div></div>` : ''}
        ${t.notes ? `<div class="dsection"><h3>Notes</h3><div class="note-box">${esc(t.notes)}</div></div>` : ''}`,
      foot: `<button class="btn primary icon-lead" data-a="edit">${icon('edit')}Edit</button><button class="btn icon-lead" data-a="dup">${icon('copy')}Duplicate</button>${t.transfer ? '' : `<button class="btn icon-lead" data-a="conv">${icon('transfer')}Convert to transfer</button>`}<button class="icon-btn danger" data-a="del" aria-label="Delete transaction" title="Delete" style="margin-left:auto">${icon('trash')}</button>`,
      onReady: (d, close) => d.addEventListener('click', (e) => {
        const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return;
        close();
        setTimeout(() => ({ edit: () => formTxn(t, 'Edit'), dup: () => actions.dup?.(t), conv: () => formTransfer(t), del: () => actions.del ? actions.del(t) : toast(`Moved ${esc(t.title)} to Trash`, { action: 'Undo' }) })[a](), 220);
      }),
    });
  }

  /* ================================================================
     DASHBOARD
     ================================================================ */
  function dashboard() {
    const hour = 18;
    const root = shell('dashboard', {
      title: `Good evening, ${M.user.name.split(' ')[0]}`,
      sub: `${TODAY.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}. Here is where your money stands.`,
      actions: quickActions(),
    });
    void hour;
    const hist = M.netWorthHistory, prev = hist.at(-2), delta = M.netWorth - prev;
    const sep = M.monthly.at(-1), savePct = ((sep.income - sep.spend) / sep.income) * 100;
    const brk = M.categoryBreakdown.map((b) => ({ ...b, cat: catOf(b.category_id), color: b.category_id === 'other' ? '#7d8299' : catOf(b.category_id).color, name: b.category_id === 'other' ? 'Everything else' : catOf(b.category_id).name }));
    const brkTotal = brk.reduce((s, b) => s + b.total, 0);
    const recent = [...M.transactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
    const groups = {};
    M.accounts.forEach((a) => { const k = TYPES[a.account_type].plural; (groups[k] ||= { liab: isLiab(a), items: [] }).items.push(a); });
    const topBudgets = [...M.budgets].map((b) => ({ b, i: budgetInfo(b) })).sort((x, y) => y.i.p - x.i.p).slice(0, 6);
    const owed = M.people.reduce((s, p) => s + p.owes_me, 0), iowe = M.people.reduce((s, p) => s + p.i_owe, 0);
    const maxDebt = Math.max(...M.people.map((p) => Math.max(p.owes_me, p.i_owe)));

    root.innerHTML = `
    <div class="grid">
      <section class="glass hero s8 rv drawable" aria-labelledby="nw-h">
        <div class="hero-top"><div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><h2 id="nw-h" class="eyebrow">Net worth</h2>${nb('Net worth history has no backend route yet. The trend line is illustrative.')}</div>
          <div class="hero-fig">${countFig(M.netWorth, 'figure-xl glow-text')}</div>
          <div class="hero-delta"><span class="chip ${delta >= 0 ? 'pos' : 'neg'}">${icon(delta >= 0 ? 'up' : 'arrout')}${money(delta, 'EUR', { sign: true })}, ${pct((delta / prev) * 100, 1)}</span><span>since last month</span></div>
        </div></div>
        <div class="chart hero-chart drawable" id="nw-chart"></div>
        <p class="sr-only" id="nw-sum">Net worth rose from ${money(hist[0])} in ${M.monthly[0].m} to ${money(M.netWorth)} in ${M.monthly.at(-1).m}, the highest point in the last 12 months.</p>
        <div class="hero-strip">
          <div class="stat"><span class="k"><span class="dot" style="background:var(--pos)"></span>Assets</span><span class="v">${money(assets)}</span></div>
          <div class="stat"><span class="k"><span class="dot" style="background:var(--neg)"></span>Liabilities</span><span class="v">${money(liabs)}</span></div>
          <div class="stat"><span class="k">Accounts</span><span class="v">${M.accounts.length}</span></div>
        </div>
      </section>

      <section class="panel month-card s4 rv drawable" aria-labelledby="mo-h">
        <div class="card-head" style="margin:0"><h2 id="mo-h">September so far</h2><span class="spacer"></span><span class="chip">${icon('calendar')}4 days left</span></div>
        <div class="ring-row">${ring(savePct, 'var(--accent)', 112, 11, `<div><div class="figure-md">${pct(savePct)}</div><div class="muted" style="font-size:11px">saved</div></div>`)}
          <p class="ink2" style="font-size:13px;text-wrap:pretty">You kept <b style="color:var(--ink-1)">${money(sep.income - sep.spend)}</b> of this month's income. August closed at ${pct(((M.monthly.at(-2).income - M.monthly.at(-2).spend) / M.monthly.at(-2).income) * 100)}.</p></div>
        <div class="kv">
          <span class="k">${icon('arrin')}Income</span><span class="v pos-t">${money(sep.income, 'EUR', { sign: true })}</span>
          <span class="k">${icon('arrout')}Spend</span><span class="v">${money(-sep.spend)}</span>
          <span class="k sum">Net</span><span class="v sum pos-t">${money(sep.income - sep.spend, 'EUR', { sign: true })}</span>
        </div>
        <div class="quick" style="margin-top:auto">
          <button class="btn" data-qa="add">${icon('plus')}Add</button><button class="btn" data-qa="transfer">${icon('transfer')}Transfer</button><button class="btn" data-qa="import">${icon('import')}Import</button>
        </div>
      </section>

      <section class="panel card-pad s7 rv" aria-labelledby="ivs-h">
        <div class="card-head"><h2 id="ivs-h">Income vs spend</h2>${nb('Monthly spending trend exists in the backend but has no route yet.')}<span class="spacer"></span>
          <div class="legend"><span><i style="background:var(--series-in)"></i>Income</span><span><i style="background:var(--series-out)"></i>Spend</span></div></div>
        <div class="chart drawable" id="ivs-chart" aria-describedby="ivs-sum"></div>
        <p class="sr-only" id="ivs-sum">Income was steady at about ${money(5240)} a month, with a ${money(6900)} peak in December. Spending ranged from ${money(2980)} in February to ${money(5210)} in December. You spent less than you earned in every month.</p>
      </section>

      <section class="panel card-pad s5 rv drawable" aria-labelledby="cat-h">
        <div class="card-head"><h2 id="cat-h">Spending by category</h2><span class="spacer"></span><a class="link" href="transactions.html">All spending${icon('right')}</a></div>
        <div class="donut-wrap">${donut(brk, brkTotal)}
          <div><div class="eyebrow" style="margin-bottom:10px">Top categories</div><div class="rank">
            ${brk.slice(0, 5).map((b, i) => `<div class="rank-row" data-i="${i}"><span class="n"><i style="background:${b.color}"></i><span>${esc(b.name)}</span></span><span class="v">${money(-b.total, 'EUR', { fmt: { maximumFractionDigits: 0 } })}<small>${pct(b.percentage)}</small></span><div class="track"><div class="hbar" style="width:${(b.total / brk[0].total) * 100}%;background:${b.color};transition-delay:${i * 60 + 200}ms"></div></div></div>`).join('')}
          </div></div></div>
        <p class="sr-only">September spending by category: ${brk.map((b) => `${b.name} ${money(b.total)} (${pct(b.percentage, 1)})`).join(', ')}.</p>
      </section>

      <section class="panel card-pad s7 rv" aria-labelledby="rt-h">
        <div class="card-head"><h2 id="rt-h">Recent transactions</h2><span class="spacer"></span><a class="link" href="transactions.html">View all${icon('right')}</a></div>
        <div class="tx-list">${recent.map((t) => `<a class="tx clickable" href="transactions.html#txn=${t.id}">${txIcon(t)}<div class="tx-main"><div class="tx-title">${esc(t.title)}</div><div class="tx-meta">${txMeta(t)} · ${fmtDate(t.date)}</div></div>${txAmount(t)}</a>`).join('')}</div>
      </section>

      <section class="panel card-pad s5 rv" aria-labelledby="ac-h">
        <div class="card-head"><h2 id="ac-h">Accounts</h2><span class="spacer"></span><a class="link" href="accounts.html">Manage${icon('right')}</a></div>
        <div class="split-meter" role="img" aria-label="Assets ${money(assets)}, liabilities ${money(liabs)}"><span style="flex:${assets};background:linear-gradient(90deg,var(--accent-2),var(--accent))"></span><span style="flex:${-liabs};background:var(--neg)"></span></div>
        ${Object.entries(groups).map(([k, g]) => `<div class="acct-group"><div class="acct-group-head"><span class="eyebrow">${k}${g.liab ? ' <span class="chip neg" style="margin-left:4px">Liability</span>' : ''}</span><span class="muted" style="font-size:12px;font-weight:600">${money(g.items.reduce((s, a) => s + M.toEur(a), 0))}</span></div>
          ${g.items.map((a) => `<div class="acct-line"><span class="nm">${icon(TYPES[a.account_type].icon, '')}<span>${esc(a.name)}</span></span><span class="v ${a.balance < 0 ? 'neg-t' : ''}">${money(a.balance, a.currency)}${a.currency !== 'EUR' ? `<small>${money(M.toEur(a))}</small>` : ''}</span></div>`).join('')}</div>`).join('')}
      </section>

      <section class="panel card-pad s7 rv drawable" aria-labelledby="bu-h">
        <div class="card-head"><h2 id="bu-h">Budgets</h2><span class="spacer"></span><a class="link" href="budgets.html">All budgets${icon('right')}</a></div>
        <div class="mini-budgets">${topBudgets.map(({ b, i }) => `<a class="mini-b" href="budgets.html#budget=${b.id}">${ring(i.p, STATUS[i.status].color, 72, 7, `<b style="font-size:14px">${pct(i.p)}</b>`)}<span class="nm">${esc(b.name)}</span>${statusChip(i.status)}<span class="sub">${money(b.spent, 'EUR', { fmt: { maximumFractionDigits: 0 } })} of ${money(b.limit, 'EUR', { fmt: { maximumFractionDigits: 0 } })}</span></a>`).join('')}</div>
      </section>

      <section class="panel card-pad s5 rv drawable" aria-labelledby="de-h">
        <div class="card-head"><h2 id="de-h">Debts</h2><span class="spacer"></span><span class="muted" style="font-size:12px">People page not mocked</span></div>
        <div class="debt-totals"><div><div class="muted" style="font-size:12px">Owed to you</div><div class="figure-md pos-t">${money(owed, 'EUR', { sign: true })}</div></div><div><div class="muted" style="font-size:12px">You owe</div><div class="figure-md neg-t">${money(-iowe)}</div></div></div>
        ${M.people.map((p) => { const v = p.owes_me - p.i_owe; const w = (Math.abs(v) / maxDebt) * 50; return `<div class="debt-row"><span class="person" aria-hidden="true">${esc(p.name[0])}</span><div style="min-width:0"><div style="font-weight:550">${esc(p.name)}</div><div class="muted" style="font-size:12px">${v >= 0 ? `${esc(p.name)} owes you` : `You owe ${esc(p.name)}`}</div><div class="diverge" aria-hidden="true"><span class="hbar" style="${v >= 0 ? `left:50%;width:${w}%;background:var(--pos);transform-origin:0 50%` : `right:50%;width:${w}%;background:var(--neg);transform-origin:100% 50%`}"></span></div></div><span class="tx-amt ${v >= 0 ? 'amt-in' : 'neg-t'}">${money(v, 'EUR', { sign: true })}</span></div>`; }).join('')}
      </section>
    </div>`;

    attachSheen($('.hero', root));
    $$('.panel', root).forEach((p) => attachSheen(p));
    lineChart($('#nw-chart'), { values: hist, labels: M.monthly.map((m) => m.m), height: innerWidth < 760 ? 170 : 210, id: 'nw-sum' });
    barsChart($('#ivs-chart'), { data: M.monthly, height: 230 });
    // donut and rank hover link
    const dn = $('.donut', root), center = $('.donut-center', root), center0 = center.innerHTML;
    const hi = (i) => {
      dn.classList.toggle('dim', i != null);
      $$('.seg', dn).forEach((s) => s.classList.toggle('hi', +s.dataset.i === i));
      center.innerHTML = i == null ? center0 : `<span class="k">${esc(brk[i].name)}</span><span class="v">${money(-brk[i].total)}</span><span class="k">${pct(brk[i].percentage, 1)}</span>`;
    };
    $$('.seg', dn).forEach((s) => { s.addEventListener('pointerenter', () => hi(+s.dataset.i)); s.addEventListener('pointerleave', () => hi(null)); });
    $$('.rank-row', root).forEach((r) => { r.addEventListener('pointerenter', () => hi(+r.dataset.i)); r.addEventListener('pointerleave', () => hi(null)); });
    mount(root);
  }

  /* ================================================================
     TRANSACTIONS
     ================================================================ */
  function transactions() {
    const root = shell('transactions', {
      title: 'Transactions',
      sub: `${SERVER_TOTAL} this month across ${M.accounts.length} accounts`,
      actions: quickActions(),
    });
    const S = {
      month: 0, q: '', account: '', category: '', person: '', from: '', to: '', min: '', max: '',
      sign: 'all', splits: false, transfer: false, mock: 'data', sel: new Set(), del: new Set(), extra: [], born: null,
    };
    const people = [...new Set(M.transactions.flatMap((t) => [...(t.splits || []).map((s) => s.person), t.debt?.paidBy].filter(Boolean)))];
    const monthDate = () => new Date(2026, 8 + S.month, 1);
    const monthLabel = () => monthDate().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const monthData = () => M.monthly[11 + S.month];

    root.innerHTML = `
      <section class="glass monthbar rv" aria-label="Month">
        <div class="monthnav"><button class="icon-btn" id="m-prev" aria-label="Previous month">${icon('left')}</button><h2 id="m-label" aria-live="polite"></h2><button class="icon-btn" id="m-next" aria-label="Next month">${icon('right')}</button></div>
        <div class="stats" id="m-stats"></div>
      </section>
      <div class="tx-layout">
        <section class="panel filters rv" aria-labelledby="f-h" id="filters">
          <div class="filters-head"><h2 id="f-h">Search and filter</h2><button class="btn sm filters-toggle" id="f-toggle" aria-expanded="false" aria-controls="f-body">${icon('filter')}Filters</button></div>
          <div class="field"><label for="f-q">Search title and notes</label><div class="input-icon">${icon('search')}<input class="input" id="f-q" type="search" autocomplete="off"></div></div>
          <div class="filters-body" id="f-body">
            <div class="field"><label for="f-acc">Account</label><select class="select" id="f-acc"><option value="">All accounts</option>${M.accounts.map((a) => `<option value="${a.id}">${esc(a.name)}</option>`).join('')}</select></div>
            <div class="field"><label for="f-cat">Category</label><select class="select" id="f-cat"><option value="">All categories</option>${M.categories.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></div>
            <div class="field"><label for="f-per">Person</label><select class="select" id="f-per"><option value="">Anyone</option>${people.map((p) => `<option>${esc(p)}</option>`).join('')}</select></div>
            <div class="two"><div class="field"><label for="f-from">From date</label><input class="input" type="date" id="f-from"></div><div class="field"><label for="f-to">To date</label><input class="input" type="date" id="f-to"></div></div>
            <div class="two"><div class="field"><label for="f-min">Min amount</label><input class="input" id="f-min" inputmode="decimal"></div><div class="field"><label for="f-max">Max amount</label><input class="input" id="f-max" inputmode="decimal"></div></div>
            <div class="field"><span class="flabel" id="f-sign-l">Direction</span><div class="seg" role="group" aria-labelledby="f-sign-l" id="f-sign"><button data-v="all" aria-pressed="true">All</button><button data-v="in" aria-pressed="false">Money in</button><button data-v="out" aria-pressed="false">Money out</button></div></div>
            <label class="switch"><span>Has splits</span><input type="checkbox" id="f-split"></label>
            <label class="switch"><span>In a transfer</span><input type="checkbox" id="f-tr"></label>
            <div class="active-filters" id="f-active"></div>
            <div class="field" style="padding-top:10px;box-shadow:0 -1px 0 var(--hair)"><span class="flabel" id="mock-l">Mock state (for review)</span><div class="seg" role="group" aria-labelledby="mock-l" id="mock"><button data-v="data" aria-pressed="true">Data</button><button data-v="loading" aria-pressed="false">Loading</button><button data-v="empty" aria-pressed="false">Empty</button><button data-v="error" aria-pressed="false">Error</button></div></div>
          </div>
        </section>
        <section class="panel list-card rv" aria-labelledby="l-h">
          <div class="list-top"><label class="check"><input type="checkbox" id="sel-all" aria-label="Select all shown"></label><h2 id="l-h" class="sr-only">Transaction list</h2><span class="count" id="l-count" role="status"></span><span class="spacer"></span></div>
          <div id="l-body"></div>
        </section>
      </div>
      <div class="bulkbar" id="bulk" role="region" aria-label="Bulk actions"><span class="count" id="b-count"></span>
        <button class="btn sm" id="b-cat">${icon('tag')}Categorize</button><button class="btn sm danger" id="b-del">${icon('trash')}Delete</button><button class="icon-btn sm bare" id="b-clear" aria-label="Clear selection">${icon('x')}</button></div>`;

    segs(root);
    const all = () => [...S.extra, ...M.transactions];
    const filtered = () => {
      const md = monthDate(), ym = `${md.getFullYear()}-${String(md.getMonth() + 1).padStart(2, '0')}`;
      const q = S.q.trim().toLowerCase();
      return all().filter((t) => !S.del.has(t.id) && t.date.startsWith(ym)
        && (!q || t.title.toLowerCase().includes(q) || (t.notes || '').toLowerCase().includes(q))
        && (!S.account || t.account_id === S.account)
        && (!S.category || t.category_id === S.category)
        && (!S.person || (t.splits || []).some((s) => s.person === S.person) || t.debt?.paidBy === S.person)
        && (!S.from || t.date >= S.from) && (!S.to || t.date <= S.to)
        && (S.min === '' || Math.abs(t.amount) >= +S.min) && (S.max === '' || Math.abs(t.amount) <= +S.max)
        && (S.sign === 'all' || (S.sign === 'in' ? t.amount > 0 : t.amount < 0))
        && (!S.splits || t.splits) && (!S.transfer || t.transfer));
    };
    const activeCount = () => ['q', 'account', 'category', 'person', 'from', 'to', 'min', 'max'].filter((k) => S[k]).length + (S.sign !== 'all') + S.splits + S.transfer;

    function renderMonth() {
      $('#m-label').textContent = monthLabel();
      $('#m-next').disabled = S.month >= 0;
      $('#m-prev').disabled = S.month <= -11;
      const d = monthData();
      $('#m-stats').innerHTML = d ? `
        <div class="stat"><span class="k">${icon('arrin', '')}Income</span><span class="v pos-t">${money(d.income, 'EUR', { sign: true })}</span></div>
        <div class="stat"><span class="k">${icon('arrout', '')}Spend</span><span class="v">${money(-d.spend)}</span></div>
        <div class="stat"><span class="k">Net</span><span class="v ${d.income - d.spend >= 0 ? 'pos-t' : 'neg-t'}">${money(d.income - d.spend, 'EUR', { sign: true })}</span></div>` : '';
      $$('#m-stats .k svg').forEach((s) => { s.style.width = '14px'; s.style.height = '14px'; });
    }

    function skeleton(n = 7) {
      return `<div class="more-rows" aria-hidden="true">${Array.from({ length: n }, (_, i) => `<div class="sk-row"><span class="sk" style="width:18px;height:18px;border-radius:6px"></span><span class="sk" style="width:36px;height:36px;border-radius:11px"></span><div style="display:grid;gap:6px"><span class="sk" style="height:12px;width:${50 + ((i * 37) % 35)}%"></span><span class="sk" style="height:10px;width:${30 + ((i * 23) % 25)}%"></span></div><span class="sk" style="height:12px"></span></div>`).join('')}</div>`;
    }

    function renderList() {
      const body = $('#l-body');
      const list = filtered();
      const count = $('#l-count');
      $('#sel-all').parentElement.style.visibility = S.mock === 'data' && list.length ? 'visible' : 'hidden';
      if (S.mock === 'loading') { count.textContent = 'Loading transactions'; body.innerHTML = skeleton(8); return; }
      if (S.mock === 'error') {
        count.textContent = '';
        body.innerHTML = `<div class="empty" role="alert"><div class="orb err">${icon('alert')}</div><h3>Couldn't load transactions</h3><p>The server didn't answer in time. Nothing was lost, try again in a moment.</p><button class="btn primary" id="retry">${icon('sync')}Try again</button></div>`;
        $('#retry').onclick = () => { setMock('loading'); setTimeout(() => setMock('data'), 900); };
        return;
      }
      if (S.mock === 'empty' || !list.length) {
        const filteredOut = S.mock !== 'empty' && activeCount() > 0;
        count.textContent = filteredOut ? 'No matches' : '0 transactions';
        body.innerHTML = `<div class="empty"><div class="orb">${icon(filteredOut ? 'search' : 'list')}</div><h3>${filteredOut ? 'Nothing matches these filters' : `No transactions in ${monthLabel()}`}</h3><p>${filteredOut ? 'Try a wider date range or clear a filter or two.' : 'Add one by hand, import a CSV statement, or connect a bank to sync automatically.'}</p>
          <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center">${filteredOut ? '<button class="btn" id="clear-f">Clear filters</button>' : `<button class="btn primary" data-qa="add">${icon('plus')}Add transaction</button><button class="btn" data-qa="import">${icon('import')}Import CSV</button>`}</div></div>`;
        $('#clear-f')?.addEventListener('click', clearFilters);
        return;
      }
      const isFull = S.month === 0 && !activeCount();
      count.textContent = isFull ? `Showing ${list.length} of ${SERVER_TOTAL - S.del.size + S.extra.length}` : `Showing ${list.length} of ${list.length} matching`;
      const days = {};
      list.sort((a, b) => b.date.localeCompare(a.date)).forEach((t) => (days[t.date] ||= []).push(t));
      const dayName = (d) => { const diff = Math.round((TODAY - parseD(d)) / dayMs); const base = fmtDate(d, { month: 'short', day: 'numeric' }); return diff === 0 ? `Today, ${base}` : diff === 1 ? `Yesterday, ${base}` : fmtDate(d, { weekday: 'long', month: 'short', day: 'numeric' }); };
      body.innerHTML = Object.entries(days).map(([d, ts]) => {
        const sub = ts.reduce((s, t) => s + eurOf(t.amount, t.currency || M.acct(t.account_id).currency), 0);
        return `<div class="day"><div class="day-head"><span>${dayName(d)}</span><span class="sub ${sub > 0 ? 'pos-t' : ''}">${money(sub, 'EUR', { sign: true })}</span></div>
          ${ts.map((t) => `<div class="row-wrap${S.born === t.id ? ' gone' : ''}" data-id="${t.id}"><div class="trow-outer">
            <div class="trow${S.sel.has(t.id) ? ' selected' : ''}" data-open="${t.id}">
              <label class="check" data-stop><input type="checkbox" data-sel="${t.id}" ${S.sel.has(t.id) ? 'checked' : ''} aria-label="Select ${esc(t.title)}"></label>
              ${txIcon(t)}
              <div class="tx-main"><button class="tx-title" data-open-btn style="all:unset;cursor:pointer;display:block;font-weight:550;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%">${esc(t.title)}</button><div class="tx-meta">${txMeta(t)}</div>${txBadges(t) ? `<div class="badges">${txBadges(t)}</div>` : ''}</div>
              ${txAmount(t)}
              <button class="icon-btn sm bare kebab" data-menu="${t.id}" aria-haspopup="menu" aria-expanded="false" aria-label="Actions for ${esc(t.title)}">${icon('more')}</button>
            </div>
            ${t.splits ? `<div class="expand" id="ex-${t.id}"><div><div class="expand-inner">
              <div class="r"><span class="ink2">Your share</span><b>${money(Math.abs(t.amount) - t.splits.reduce((s, x) => s + x.amount, 0), t.currency || 'EUR')}</b></div>
              ${t.splits.map((s) => `<div class="r"><span class="ink2">${esc(s.person)} owes you</span><b class="pos-t">${money(s.amount, t.currency || 'EUR')}</b></div>`).join('')}
            </div></div></div>` : ''}
          </div></div>`).join('')}</div>`;
      }).join('') + (isFull ? `<div id="sentinel">${skeleton(3)}</div>` : '<p class="end-note">End of results</p>');
      if (S.born) { const w = $(`.row-wrap[data-id="${S.born}"]`); S.born = null; requestAnimationFrame(() => requestAnimationFrame(() => w?.classList.remove('gone'))); }
      if (isFull) {
        const io = new IntersectionObserver((e) => {
          if (!e[0].isIntersecting) return; io.disconnect();
          setTimeout(() => { const s = $('#sentinel'); if (s) s.outerHTML = `<p class="end-note">Sample data ends here. Live, the list keeps loading the next page as you scroll until all ${SERVER_TOTAL} are in.</p>`; }, 1200);
        });
        io.observe($('#sentinel'));
      }
      syncBulk();
    }

    function renderActive() {
      const chips = [];
      const add = (label, clear) => chips.push({ label, clear });
      if (S.q) add(`"${S.q}"`, () => { S.q = ''; $('#f-q').value = ''; });
      if (S.account) add(M.acct(S.account).name, () => { S.account = ''; $('#f-acc').value = ''; });
      if (S.category) add(M.cat(S.category).name, () => { S.category = ''; $('#f-cat').value = ''; });
      if (S.person) add(S.person, () => { S.person = ''; $('#f-per').value = ''; });
      if (S.from || S.to) add(`${S.from || 'start'} to ${S.to || 'end'}`, () => { S.from = S.to = ''; $('#f-from').value = $('#f-to').value = ''; });
      if (S.min || S.max) add(`${S.min || 0} to ${S.max || 'any'}`, () => { S.min = S.max = ''; $('#f-min').value = $('#f-max').value = ''; });
      if (S.sign !== 'all') add(S.sign === 'in' ? 'Money in' : 'Money out', () => { S.sign = 'all'; $$('#f-sign button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === 'all'))); });
      if (S.splits) add('Has splits', () => { S.splits = false; $('#f-split').checked = false; });
      if (S.transfer) add('In a transfer', () => { S.transfer = false; $('#f-tr').checked = false; });
      const host = $('#f-active');
      host.innerHTML = chips.map((c, i) => `<button data-i="${i}" aria-label="Remove filter ${esc(c.label)}">${esc(c.label)}${icon('x')}</button>`).join('');
      $$('button', host).forEach((b) => b.addEventListener('click', () => { chips[+b.dataset.i].clear(); update(); }));
      $('#f-toggle').innerHTML = `${icon('filter')}Filters${activeCount() ? ` (${activeCount()})` : ''}`;
    }
    function update() { renderActive(); renderList(); }
    function clearFilters() {
      Object.assign(S, { q: '', account: '', category: '', person: '', from: '', to: '', min: '', max: '', sign: 'all', splits: false, transfer: false });
      $$('#filters input').forEach((i) => { if (i.type === 'checkbox') i.checked = false; else i.value = ''; });
      $$('#filters select').forEach((s) => (s.value = ''));
      $$('#f-sign button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === 'all')));
      update();
    }
    function setMock(v) { S.mock = v; $$('#mock button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === v))); renderList(); }

    const bind = (id, key, ev = 'input') => $(id).addEventListener(ev, (e) => { S[key] = e.target.type === 'checkbox' ? e.target.checked : e.target.value; update(); });
    bind('#f-q', 'q'); bind('#f-acc', 'account', 'change'); bind('#f-cat', 'category', 'change'); bind('#f-per', 'person', 'change');
    bind('#f-from', 'from', 'change'); bind('#f-to', 'to', 'change'); bind('#f-min', 'min'); bind('#f-max', 'max');
    bind('#f-split', 'splits', 'change'); bind('#f-tr', 'transfer', 'change');
    $('#f-sign').addEventListener('segchange', (e) => { S.sign = e.detail; update(); });
    $('#mock').addEventListener('segchange', (e) => setMock(e.detail));
    $('#f-toggle').addEventListener('click', (e) => { const f = $('#filters'); const on = !f.classList.contains('open'); f.classList.toggle('open', on); e.currentTarget.setAttribute('aria-expanded', String(on)); });
    $('#m-prev').addEventListener('click', () => { S.month--; S.sel.clear(); renderMonth(); renderList(); });
    $('#m-next').addEventListener('click', () => { S.month++; S.sel.clear(); renderMonth(); renderList(); });

    /* selection */
    function syncBulk() {
      const n = S.sel.size, shown = filtered().length;
      $('#bulk').classList.toggle('on', n > 0);
      $('#b-count').textContent = `${n} selected`;
      const sa = $('#sel-all'); sa.checked = n > 0 && n >= shown; sa.indeterminate = n > 0 && n < shown;
    }
    $('#sel-all').addEventListener('change', (e) => { S.sel = e.target.checked ? new Set(filtered().map((t) => t.id)) : new Set(); renderList(); });
    $('#b-clear').addEventListener('click', () => { S.sel.clear(); renderList(); });
    $('#b-cat').addEventListener('click', () => toast(`Pick a category for ${S.sel.size} transactions`, { icon: 'tag' }));
    $('#b-del').addEventListener('click', () => { const ids = [...S.sel]; S.sel.clear(); softDelete(ids); });

    /* soft delete with undo */
    function softDelete(ids) {
      const wraps = ids.map((id) => $(`.row-wrap[data-id="${id}"]`)).filter(Boolean);
      wraps.forEach((w) => w.classList.add('gone'));
      const wait = reduce() ? 0 : parseInt(getComputedStyle(doc).getPropertyValue('--spring-dur'));
      setTimeout(() => { ids.forEach((id) => S.del.add(id)); renderList(); }, wait);
      const name = ids.length === 1 ? esc(all().find((t) => t.id === ids[0]).title) : `${ids.length} transactions`;
      toast(`Moved ${name} to Trash`, { action: 'Undo', icon: 'trash', onAction: () => { ids.forEach((id) => S.del.delete(id)); S.born = ids[0]; renderList(); } });
    }
    function duplicate(t) {
      const c = { ...t, id: `${t.id}-c${Date.now() % 1e5}`, title: `${t.title} (copy)` };
      S.extra.unshift(c); S.born = c.id; renderList(); toast(`Duplicated ${esc(t.title)}`);
    }
    const actions = { dup: duplicate, del: (t) => softDelete([t.id]) };

    $('#l-body').addEventListener('click', (e) => {
      const sel = e.target.closest('[data-sel]');
      if (sel) { sel.checked ? S.sel.add(sel.dataset.sel) : S.sel.delete(sel.dataset.sel); sel.closest('.trow').classList.toggle('selected', sel.checked); syncBulk(); return; }
      if (e.target.closest('[data-stop]')) return;
      const ex = e.target.closest('[data-expand]');
      if (ex) { const box = $(`#ex-${ex.dataset.expand}`); const on = !box.classList.contains('open'); box.classList.toggle('open', on); ex.setAttribute('aria-expanded', String(on)); return; }
      const mb = e.target.closest('[data-menu]');
      if (mb) {
        const t = all().find((x) => x.id === mb.dataset.menu);
        openMenu(mb, [
          { label: 'Edit', icon: 'edit', onSelect: () => formTxn(t, 'Edit') },
          { label: 'Duplicate', icon: 'copy', onSelect: () => duplicate(t) },
          ...(t.transfer ? [] : [{ label: 'Convert to transfer', icon: 'transfer', onSelect: () => formTransfer(t) }]),
          '-',
          { label: 'Delete', icon: 'trash', danger: true, onSelect: () => softDelete([t.id]) },
        ]);
        return;
      }
      const row = e.target.closest('[data-open]');
      if (row) txDetail(all().find((x) => x.id === row.dataset.open), actions);
    });

    renderMonth(); update();
    $$('.panel, .glass', root).forEach((p) => p.classList.contains('list-card') || attachSheen(p));
    mount(root);
    const m = location.hash.match(/txn=([\w-]+)/);
    if (m) { const t = M.transactions.find((x) => x.id === m[1]); if (t) setTimeout(() => txDetail(t, actions), reduce() ? 0 : 450); }
  }

  /* ================================================================
     ACCOUNTS
     ================================================================ */
  function accounts() {
    const root = shell('accounts', {
      title: 'Accounts',
      sub: `${M.accounts.length} accounts in ${new Set(M.accounts.map((a) => a.currency)).size} currencies, totals in EUR`,
      actions: `<button class="btn primary icon-lead" id="add-acc">${icon('plus')}<span class="lbl">Add account</span></button><button class="btn icon-lead" id="conn">${icon('plug')}<span class="lbl">Connect provider</span></button>`,
    });
    const order = ['Everyday accounts', 'Savings', 'Investments', 'Cash and gift cards', 'Credit cards', 'Loans and debt'];
    const groups = {};
    M.accounts.forEach((a) => (groups[TYPES[a.account_type].plural] ||= []).push(a));
    const assetParts = order.slice(0, 4).map((k) => ({ k, v: (groups[k] || []).reduce((s, a) => s + M.toEur(a), 0), color: TYPES[groups[k][0].account_type].color }));
    const provs = [...new Set(M.accounts.filter((a) => a.provider).map((a) => a.provider))];
    const PROV_STYLE = { TrueLayer: 'linear-gradient(135deg,#1c64f2,#3fb8ff)', 'Trading 212': 'linear-gradient(135deg,#1aa0ff,#00d3a7)' };

    root.innerHTML = `
      <section class="glass acc-hero rv drawable" aria-labelledby="tb-h">
        <div>
          <h2 class="eyebrow" id="tb-h">Total balance</h2>
          <div style="margin-top:10px">${countFig(M.netWorth, 'figure-xl glow-text')}</div>
          <div class="stats" style="margin-top:16px">
            <div class="stat"><span class="k"><span class="dot" style="background:var(--pos)"></span>Assets</span><span class="v">${money(assets)}</span></div>
            <div class="stat"><span class="k"><span class="dot" style="background:var(--neg)"></span>Liabilities</span><span class="v neg-t">${money(liabs)}</span></div>
          </div>
          <div class="compo" role="img" aria-label="Assets by type: ${assetParts.map((p) => `${p.k} ${money(p.v)}`).join(', ')}">${assetParts.map((p, i) => `<span class="hbar" style="flex:${p.v};background:${p.color};transition-delay:${i * 80}ms"></span>`).join('')}</div>
          <div class="compo-legend">${assetParts.map((p) => `<span><i style="background:${p.color}"></i>${p.k} ${money(p.v, 'EUR', { fmt: { maximumFractionDigits: 0 } })}</span>`).join('')}</div>
        </div>
        <div class="providers">
          <div class="card-head" style="margin:0"><h2>Connected providers</h2></div>
          ${provs.map((p) => { const accs = M.accounts.filter((a) => a.provider === p); return `<div class="prov"><span class="prov-logo" style="background:${PROV_STYLE[p]}">${p === 'TrueLayer' ? 'TL' : 'T2'}</span><div class="meta"><b>${esc(p)}</b><span class="muted">${accs.length} account${accs.length > 1 ? 's' : ''}, last synced ${esc(accs[0].synced)}</span></div><button class="btn sm" data-sync-prov="${esc(p)}">${icon('sync')}Sync</button></div>`; }).join('')}
          <button class="btn" id="conn2" style="justify-content:flex-start">${icon('plus')}Connect another provider</button>
        </div>
      </section>
      <div class="acc-sections">${order.filter((k) => groups[k]).map((k) => {
        const g = groups[k], tot = g.reduce((s, a) => s + M.toEur(a), 0), liab = g.some(isLiab);
        return `<section class="acc-sec" style="--n:${Math.min(3, g.length)}" aria-label="${k}"><div class="section-title rv"><h2>${k}</h2>${liab ? '<span class="chip neg">Liability</span>' : ''}<span class="tot ${tot < 0 ? 'neg-t' : ''}">${money(tot)}</span></div>
        <div class="acc-grid">${g.map((a) => accCard(a)).join('')}</div></section>`;
      }).join('')}</div>`;

    function accCard(a) {
      const T = TYPES[a.account_type], liab = isLiab(a);
      const change = a.dayChange != null ? (a.balance * a.dayChange) / (100 + a.dayChange) : null;
      return `<article class="panel acc-card rv ${liab ? 'liab' : ''}" data-id="${a.id}" aria-labelledby="an-${a.id}">
        <div class="top"><span class="acc-ic">${icon(T.icon)}</span><div class="nm"><b id="an-${a.id}">${esc(a.name)}</b><div class="chips"><span class="chip">${T.label}</span><span class="chip">${a.currency}</span>${liab ? '<span class="chip neg">Liability</span>' : ''}</div></div>
          <button class="icon-btn sm bare" data-acc-menu="${a.id}" aria-haspopup="menu" aria-expanded="false" aria-label="Actions for ${esc(a.name)}" style="position:relative;z-index:3">${icon('more')}</button></div>
        <div class="bal">
          <div class="figure-lg ${liab ? 'neg-t' : ''}">${money(a.balance, a.currency)}</div>
          ${a.currency !== 'EUR' ? `<small>${money(M.toEur(a))} at ${M.fx[a.currency]} EUR per ${a.currency}</small>` : liab ? `<small>You owe ${money(Math.abs(a.balance))}</small>` : '<small>&nbsp;</small>'}
        </div>
        ${change != null ? `<div class="day-change"><span class="chip ${change >= 0 ? 'pos' : 'neg'}">${icon(change >= 0 ? 'up' : 'arrout')}${a.dayChange >= 0 ? '+' : MINUS}${Math.abs(a.dayChange).toFixed(2)}% today</span><span class="${change >= 0 ? 'pos-t' : 'neg-t'}" style="font-weight:600;font-size:13px">${money(change, 'EUR', { sign: true })}</span></div>` : ''}
        <div class="foot">${a.provider
          ? `<span class="grow" data-sync-label="${a.id}">${icon('okc')}${esc(a.provider)}, synced ${esc(a.synced)}</span><button class="btn sm" data-sync="${a.id}" style="position:relative;z-index:3">${icon('sync')}Sync now</button>`
          : `<span class="grow">${icon('edit')}Manual balance</span><button class="btn sm ghost" data-connect="${a.id}" style="position:relative;z-index:3">${icon('link')}Connect</button>`}</div>
      </article>`;
    }

    function syncAcc(id) {
      const a = M.acct(id), btn = $(`[data-sync="${id}"]`), lab = $(`[data-sync-label="${id}"]`);
      if (!btn || btn.classList.contains('spin')) return;
      btn.classList.add('spin'); btn.lastChild.textContent = 'Syncing'; btn.setAttribute('aria-busy', 'true');
      lab.innerHTML = `${icon('sync')}${esc(a.provider)}, syncing`;
      setTimeout(() => {
        btn.classList.remove('spin'); btn.lastChild.textContent = 'Sync now'; btn.removeAttribute('aria-busy');
        lab.innerHTML = `${icon('okc')}${esc(a.provider)}, synced just now`;
        toast(`${esc(a.name)} is up to date`);
      }, 1500);
    }
    function formAccount(a = {}) {
      const id = uid('f');
      openDrawer({
        title: a.id ? 'Edit account' : 'Add account',
        body: `<form class="form" onsubmit="return false">
          <div class="field"><label for="${id}n">Name</label><input class="input" id="${id}n" value="${esc(a.name || '')}"></div>
          <div class="two"><div class="field"><label for="${id}t">Type</label><select class="select" id="${id}t">${Object.entries(TYPES).map(([k, v]) => `<option value="${k}" ${k === a.account_type ? 'selected' : ''}>${v.label}</option>`).join('')}</select></div>
          <div class="field"><label for="${id}c">Currency</label><select class="select" id="${id}c">${Object.keys(M.fx).map((c) => `<option ${c === a.currency ? 'selected' : ''}>${c}</option>`).join('')}</select></div></div>
          <div class="field"><label for="${id}b">${a.id ? 'Current balance' : 'Opening balance'}</label><input class="input" id="${id}b" inputmode="decimal" value="${a.balance ?? ''}"></div>
          <p class="muted" style="font-size:12px">Credit cards and debts are stored as negative balances and count as liabilities.</p>
        </form>`,
        foot: `<button class="btn primary" data-save>${a.id ? 'Save changes' : 'Add account'}</button><button class="btn ghost" data-close>Cancel</button>`,
        onReady: (d, close) => $('[data-save]', d).addEventListener('click', () => { close(); toast(a.id ? 'Account saved' : 'Account added'); }),
      });
    }
    function connect() {
      openDrawer({
        title: 'Connect a provider',
        body: `<p class="ink2" style="margin-bottom:14px">Link a bank or broker to sync balances and transactions automatically. Credentials are stored encrypted.</p>
          <div class="providers">
            <div class="prov"><span class="prov-logo" style="background:${PROV_STYLE.TrueLayer}">TL</span><div class="meta"><b>TrueLayer</b><span class="muted">Open Banking for UK and EU banks</span></div><button class="btn sm primary">Connect</button></div>
            <div class="prov"><span class="prov-logo" style="background:${PROV_STYLE['Trading 212']}">T2</span><div class="meta"><b>Trading 212</b><span class="muted">Portfolio value and daily change, via API key</span></div><button class="btn sm">Connect</button></div>
          </div>`,
      });
    }
    $('#add-acc').addEventListener('click', () => formAccount());
    $('#conn').addEventListener('click', connect); $('#conn2').addEventListener('click', connect);
    root.addEventListener('click', (e) => {
      const s = e.target.closest('[data-sync]'); if (s) return syncAcc(s.dataset.sync);
      const sp = e.target.closest('[data-sync-prov]'); if (sp) { M.accounts.filter((a) => a.provider === sp.dataset.syncProv).forEach((a) => syncAcc(a.id)); return; }
      if (e.target.closest('[data-connect]')) return connect();
      const mb = e.target.closest('[data-acc-menu]');
      if (mb) {
        const a = M.acct(mb.dataset.accMenu);
        openMenu(mb, [
          { label: 'Edit', icon: 'edit', onSelect: () => formAccount(a) },
          ...(a.provider ? [{ label: 'Sync now', icon: 'sync', onSelect: () => syncAcc(a.id) }] : []),
          { label: 'Archive', icon: 'archive', nb: true },
          '-',
          { label: 'Delete', icon: 'trash', danger: true, onSelect: () => confirmDialog({ title: `Delete ${esc(a.name)}?`, text: 'Its transactions go to Trash with it. This cannot be undone once Trash is emptied.', onConfirm: () => { const c = $(`.acc-card[data-id="${a.id}"]`); c.style.transition = 'opacity 200ms ease, transform 200ms ease'; c.style.opacity = '0'; c.style.transform = 'scale(.97)'; setTimeout(() => c.remove(), 220); toast(`Deleted ${esc(a.name)}`, { icon: 'trash' }); } }) },
        ]);
      }
    });
    attachSheen($('.acc-hero', root));
    $$('.acc-card', root).forEach((c) => attachSheen(c, { tilt: true }));
    mount(root);
  }

  /* ================================================================
     BUDGETS
     ================================================================ */
  function budgets() {
    const root = shell('budgets', {
      title: 'Budgets',
      sub: `September 2026, ${M.budgets.length} active budgets`,
      actions: `<button class="btn primary icon-lead keep-label" id="new-b">${icon('plus')}<span class="lbl">Create budget</span></button>`,
    });
    const infos = M.budgets.map((b) => ({ b, i: budgetInfo(b) }));
    const monthly = infos.filter(({ b }) => b.period === 'MONTHLY');
    const mSpent = monthly.reduce((s, x) => s + x.b.spent, 0), mLimit = monthly.reduce((s, x) => s + x.b.limit, 0);
    const mP = (mSpent / mLimit) * 100, mInfo = monthly[0].i;
    const mStatus = mP > 100 ? 'EXCEEDED' : mP >= 80 ? 'WARNING' : 'OK';
    const cnt = (s) => infos.filter((x) => x.i.status === s).length;

    root.innerHTML = `
      <section class="glass b-hero rv drawable" aria-labelledby="bh-h">
        ${ring(mP, STATUS[mStatus].color, 176, 14, `<div><div class="figure-lg">${pct(mP)}</div><div class="muted" style="font-size:12px;margin-top:4px">of monthly limits</div></div>`)}
        <div class="txt">
          <h2 class="eyebrow" id="bh-h">Monthly budgets, September</h2>
          <div class="figure-lg" style="margin-top:10px">${money(mSpent)} <span class="muted" style="font-size:18px;font-weight:500;letter-spacing:0">of ${money(mLimit)}</span></div>
          <p class="ink2" style="margin-top:8px;text-wrap:pretty">${statusChip(mStatus)} <span style="margin-left:6px">${money(mLimit - mSpent)} left with ${mInfo.daysLeft} days to go. ${mP > mInfo.expected + 3 ? 'Spending is ahead of pace.' : `On track: ${pct(mInfo.expected)} of the month has passed.`}</span></p>
          <div class="facts">
            <div><div class="muted" style="font-size:12px">OK</div><div class="figure-md pos-t" style="display:flex;gap:6px;align-items:center">${icon('okc')}${cnt('OK')}</div></div>
            <div><div class="muted" style="font-size:12px">Warning</div><div class="figure-md warn-t" style="display:flex;gap:6px;align-items:center">${icon('alert')}${cnt('WARNING')}</div></div>
            <div><div class="muted" style="font-size:12px">Exceeded</div><div class="figure-md neg-t" style="display:flex;gap:6px;align-items:center">${icon('over')}${cnt('EXCEEDED')}</div></div>
            <div><div class="muted" style="font-size:12px">Days left</div><div class="figure-md">${mInfo.daysLeft}</div></div>
          </div>
        </div>
      </section>
      <div class="section-title rv"><h2>All budgets</h2><span class="tot muted" style="font-weight:500;font-size:13px">Marker shows how much of the period has passed</span></div>
      <div class="b-grid">${infos.map(({ b, i }) => bCard(b, i)).join('')}</div>`;
    $$('.b-hero svg', root).forEach((s) => { if (s.closest('.figure-md')) { s.style.width = '18px'; s.style.height = '18px'; } });

    function bCard(b, i) {
      const c = M.cat(b.category_id), st = STATUS[i.status];
      return `<div class="b-card-wrap rv drawable"><button class="panel b-card" data-b="${b.id}" aria-label="${esc(b.name)}, ${pct(i.p)} used, ${st.label}. Open details">
        <div class="top">${ring(i.p, st.color, 64, 7, `<b style="font-size:13px">${pct(i.p)}</b>`)}
          <div class="nm"><b>${esc(b.name)}</b><div class="chips"><span class="chip"><span style="width:8px;height:8px;border-radius:3px;background:${c.color}"></span>${esc(c.name)}</span><span class="chip">${b.period[0] + b.period.slice(1).toLowerCase()}</span></div></div></div>
        <div>
          <div class="pace" aria-hidden="true"><span class="fill hbar" style="width:${Math.min(100, i.p)}%;background:${st.color}"></span><span class="mark" style="left:calc(${i.expected}% - 1px)"></span></div>
        </div>
        <div class="b-nums"><div class="muted">Spent<b>${money(b.spent)}</b></div><div class="muted">Limit<b>${money(b.limit)}</b></div><div class="muted">${i.remaining >= 0 ? 'Remaining' : 'Over by'}<b class="${i.remaining < 0 ? 'neg-t' : ''}">${money(Math.abs(i.remaining))}</b></div></div>
        <div class="b-foot">${statusChip(i.status)}<span>${i.ahead ? `<span class="warn-t" style="font-weight:600">Ahead of pace</span>` : '<span style="font-weight:600">On track</span>'}, ${i.daysLeft} day${i.daysLeft === 1 ? '' : 's'} left</span></div>
      </button><button class="icon-btn sm bare" data-b-menu="${b.id}" aria-haspopup="menu" aria-expanded="false" aria-label="Actions for ${esc(b.name)}" style="top:auto;bottom:auto;right:14px;top:14px">${icon('more')}</button></div>`;
    }

    function formBudget(b = {}) {
      const id = uid('f');
      openDrawer({
        title: b.id ? 'Edit budget' : 'Create budget',
        body: `<form class="form" onsubmit="return false">
          <div class="field"><label for="${id}n">Name</label><input class="input" id="${id}n" value="${esc(b.name || '')}"></div>
          <div class="two"><div class="field"><label for="${id}c">Category</label><select class="select" id="${id}c">${catOpts(b.category_id)}</select></div>
          <div class="field"><label for="${id}p">Period</label><select class="select" id="${id}p">${['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY'].map((p) => `<option value="${p}" ${p === (b.period || 'MONTHLY') ? 'selected' : ''}>${p[0] + p.slice(1).toLowerCase()}</option>`).join('')}</select></div></div>
          <div class="field"><label for="${id}l">Limit (EUR)</label><input class="input" id="${id}l" inputmode="decimal" value="${b.limit ?? ''}"></div>
          <div class="two"><div class="field"><label for="${id}s">Starts</label><input class="input" type="date" id="${id}s" value="${b.start || '2026-10-01'}"></div><div class="field"><label for="${id}e">Ends</label><input class="input" type="date" id="${id}e" value="${b.end || '2026-10-31'}"></div></div>
          <div class="field"><label for="${id}o" style="display:flex;gap:8px;align-items:center">Notes ${nb('Budget notes are not stored by the backend yet')}</label><textarea class="input" id="${id}o" disabled></textarea></div>
        </form>`,
        foot: `<button class="btn primary" data-save>${b.id ? 'Save changes' : 'Create budget'}</button><button class="btn ghost" data-close>Cancel</button>`,
        onReady: (d, close) => $('[data-save]', d).addEventListener('click', () => { close(); toast(b.id ? 'Budget saved' : 'Budget created'); }),
      });
    }
    function del(b) { confirmDialog({ title: `Delete ${esc(b.name)}?`, text: 'Transactions stay as they are. Only the budget and its ranges are removed.', onConfirm: () => { const w = $(`[data-b="${b.id}"]`).parentElement; w.style.transition = 'opacity 200ms ease, transform 200ms ease'; w.style.opacity = '0'; w.style.transform = 'scale(.97)'; setTimeout(() => w.remove(), 220); toast(`Deleted ${esc(b.name)}`, { icon: 'trash' }); } }); }

    function detail(b) {
      const i = budgetInfo(b), st = STATUS[i.status], c = M.cat(b.category_id);
      const txs = M.transactions.filter((t) => t.category_id === b.category_id && t.date >= b.start && t.date <= b.end);
      openDrawer({
        title: esc(b.name),
        body: `<div class="drawable" id="bd">
          <div style="display:flex;gap:20px;align-items:center">${ring(i.p, st.color, 120, 11, `<div><div class="figure-md">${pct(i.p)}</div><div class="muted" style="font-size:11px">used</div></div>`)}
            <div style="display:grid;gap:8px">${statusChip(i.status)}<div class="figure-md">${money(b.spent)} <span class="muted" style="font-size:14px;font-weight:500">of ${money(b.limit)}</span></div>
            <div class="ink2" style="font-size:13px">${i.remaining >= 0 ? `${money(i.remaining)} left` : `${money(-i.remaining)} over`}, ${i.daysLeft} days left. ${i.ahead ? '<b class="warn-t">Ahead of pace</b>' : '<b>On track</b>'}</div></div></div>
          <div class="pace" style="margin-top:20px" aria-hidden="true"><span class="fill hbar" style="width:${Math.min(100, i.p)}%;background:${st.color}"></span><span class="mark" style="left:calc(${i.expected}% - 1px)"></span></div>
          <div class="muted" style="font-size:12px;margin-top:8px;display:flex;justify-content:space-between"><span>${fmtDate(b.start)}</span><span>${pct(i.expected)} of the period passed</span><span>${fmtDate(b.end)}</span></div>
          <dl class="detail-grid"><dt>Category</dt><dd><span style="width:8px;height:8px;border-radius:3px;background:${c.color}"></span>${esc(c.name)}</dd><dt>Period</dt><dd>${b.period[0] + b.period.slice(1).toLowerCase()}</dd><dt>Current range</dt><dd>${fmtDate(b.start, { month: 'short', day: 'numeric', year: 'numeric' })} to ${fmtDate(b.end, { month: 'short', day: 'numeric', year: 'numeric' })}</dd></dl>
          <div class="dsection"><h3>Counting toward it</h3>${txs.length ? `<div class="tx-list">${txs.map((t) => `<a class="tx clickable" href="transactions.html#txn=${t.id}">${txIcon(t)}<div class="tx-main"><div class="tx-title">${esc(t.title)}</div><div class="tx-meta">${esc(M.acct(t.account_id).name)} · ${fmtDate(t.date)}</div></div>${txAmount(t)}</a>`).join('')}</div><p class="muted" style="font-size:12px;margin-top:6px">Sample shows ${txs.length} of the transactions behind the ${money(b.spent)} total.</p>` : '<p class="muted">No sample transactions in this range.</p>'}</div>
          <div class="dsection"><h3>Range history ${nb('Budget range history and editing ranges need new endpoints')}</h3><div class="note-box">Past ranges and their limits will appear here, with a way to edit a range without touching the others.</div><button class="btn sm" style="margin-top:10px" aria-disabled="true" disabled>${icon('edit')}Edit ranges</button></div>
          <div class="dsection"><h3>Notes ${nb('Budget notes are not stored by the backend yet')}</h3><div class="note-box">Notes for this budget are not available yet.</div></div>
        </div>`,
        foot: `<button class="btn primary icon-lead" data-e>${icon('edit')}Edit budget</button><button class="btn danger icon-lead" data-x>${icon('trash')}Delete</button>`,
        onReady: (d, close) => {
          $('[data-e]', d).addEventListener('click', () => { close(); setTimeout(() => formBudget(b), 220); });
          $('[data-x]', d).addEventListener('click', () => { close(); setTimeout(() => del(b), 220); });
          setTimeout(() => $('#bd', d).classList.add('drawn'), reduce() ? 0 : 280);
        },
      });
    }

    $('#new-b').addEventListener('click', () => formBudget());
    root.addEventListener('click', (e) => {
      const m = e.target.closest('[data-b-menu]');
      if (m) { const b = M.budgets.find((x) => x.id === m.dataset.bMenu); openMenu(m, [{ label: 'Open details', icon: 'info', onSelect: () => detail(b) }, { label: 'Edit', icon: 'edit', onSelect: () => formBudget(b) }, '-', { label: 'Delete', icon: 'trash', danger: true, onSelect: () => del(b) }]); return; }
      const c = e.target.closest('[data-b]'); if (c) detail(M.budgets.find((x) => x.id === c.dataset.b));
    });
    attachSheen($('.b-hero', root));
    $$('.b-card', root).forEach((c) => attachSheen(c));
    mount(root);
    const h = location.hash.match(/budget=([\w-]+)/);
    if (h) { const b = M.budgets.find((x) => x.id === h[1]); if (b) setTimeout(() => detail(b), reduce() ? 0 : 500); }
  }

  const page = document.body.dataset.page;
  ({ dashboard, transactions, accounts, budgets })[page]?.();
})();
