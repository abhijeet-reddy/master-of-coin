/* Master of Coin v2 / Direction C: TELEMETRY
   Vanilla JS, no build, no network. Renders every page from window.MOC. */
(() => {
  'use strict';
  const M = window.MOC;
  const TODAY = new Date('2026-09-25T12:00:00'); // "as of" date of the sample data
  const TOTAL_TX = 214;
  const root = document.documentElement;
  const params = new URLSearchParams(location.search);
  if (params.get('rm') === '1') root.classList.add('rm');
  const FEED = params.get('feed') === 'ticker' ? 'ticker' : 'strip';
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches || root.classList.contains('rm');
  const FLOW = 'cubic-bezier(0.22,0,0.12,1)';
  const IO = 'cubic-bezier(0.77,0,0.175,1)';

  /* ---------------- utils ---------------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const up = (s) => String(s).toUpperCase();
  const day = (iso) => new Date(iso + 'T12:00:00');
  const eur = (n) => M.fmt(n, 'EUR');
  const signed = (n, cur = 'EUR') => (n > 0 ? '+' : '') + M.fmt(n, cur);
  const compact = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR', notation: 'compact', maximumFractionDigits: 1 }).format(n);
  const pct = (n, d = 0) => `${n.toFixed(d)}%`;
  const fx = (cur) => M.fx[cur] || 1;
  const txCur = (t) => t.currency || M.acct(t.account_id)?.currency || 'EUR';
  const txEur = (t) => t.amount * fx(txCur(t));
  const dShort = (iso) => up(day(iso).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' }));
  const dLong = (iso) => day(iso).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const dRange = (iso) => up(day(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }));
  const live = (msg) => { const el = $('#live'); if (el) { el.textContent = ''; setTimeout(() => (el.textContent = msg), 30); } };
  const PAGE = document.body.dataset.page;
  const NAVPAGE = PAGE === 'transactions-d' ? 'transactions' : PAGE; // alt layouts keep their section active

  /* ---------------- icons (24 grid, 1.5 stroke, square caps, mitred) ---------------- */
  const P = {
    grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
    list: 'M4 6h16M4 12h16M4 18h10',
    wallet: 'M3 6h18v13H3zM3 10h18M16 14.5h2',
    gauge: 'M4 18a8 8 0 1 1 16 0M12 18l4-6',
    tag: 'M3 3h8l10 10-8 8L3 11zM7 7h1v1H7z',
    users: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2 20c0-3.5 3-6 7-6s7 2.5 7 6M16 4.5a3.5 3.5 0 0 1 0 6.5M18 14c2.4.7 4 2.9 4 6',
    chart: 'M4 20V4M4 20h16M8 16v-5M12 16V8M16 16v-3',
    cpu: 'M7 7h10v10H7zM9 3v4M15 3v4M9 17v4M15 17v4M3 9h4M3 15h4M17 9h4M17 15h4',
    clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2',
    trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6',
    gear: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1',
    search: 'M10.5 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM15.5 15.5 21 21',
    filter: 'M3 5h18l-7 8v6l-4 2v-8z',
    plus: 'M12 4v16M4 12h16',
    transfer: 'M4 8h15M15 4l4 4-4 4M20 16H5M9 12l-4 4 4 4',
    upload: 'M12 16V4M7 9l5-5 5 5M4 20h16',
    chevL: 'M15 5l-7 7 7 7',
    chevR: 'M9 5l7 7-7 7',
    more: 'M4 11h2.5v2.5H4zM10.75 11h2.5v2.5h-2.5zM17.5 11H20v2.5h-2.5z',
    split: 'M12 3v6M12 9l-6 6v6M12 9l6 6v6',
    note: 'M5 3h10l4 4v14H5zM15 3v4h4M8 12h8M8 16h6',
    repeat: 'M4 12V9a3 3 0 0 1 3-3h12M16 3l3 3-3 3M20 12v3a3 3 0 0 1-3 3H5M8 21l-3-3 3-3',
    close: 'M5 5l14 14M19 5 5 19',
    sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
    moon: 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z',
    sidebar: 'M3 4h18v16H3zM9 4v16',
    sync: 'M20 11a8 8 0 0 0-14.3-4.9L4 8M4 3v5h5M4 13a8 8 0 0 0 14.3 4.9L20 16M20 21v-5h-5',
    edit: 'M4 20h4L19 9l-4-4L4 16zM13 7l4 4',
    copy: 'M8 8h12v12H8zM4 16V4h12',
    link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
    hand: 'M12 3v18M16 7h-6a3 3 0 0 0 0 6h4a3 3 0 0 1 0 6H7',
    globe: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c2.5 2.5 3.5 6 3.5 9s-1 6.5-3.5 9M12 3C9.5 5.5 8.5 9 8.5 12s1 6.5 3.5 9',
    pause: 'M8 5v14M16 5v14',
    play: 'M7 5l12 7-12 7z',
    menu: 'M4 7h16M4 12h16M4 17h16',
    warn: 'M12 3l10 18H2zM12 10v5M12 17.5v1',
    check: 'M5 12l5 5 9-10',
    xoct: 'M8 3h8l5 5v8l-5 5H8l-5-5V8zM9 9l6 6M15 9l-6 6',
    tri_up: 'M12 6l7 12H5z',
    tri_dn: 'M12 18 5 6h14z',
    bank: 'M3 10l9-6 9 6M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18',
    archive: 'M3 4h18v4H3zM5 8v12h14V8M10 12h4',
    // categories
    cart: 'M3 4h2l2.5 11h11L21 7H6.2M9 19h1.5v1.5H9zM17 19h1.5v1.5H17z',
    fork: 'M7 3v18M5 3v5a2 2 0 0 0 4 0V3M17 3c-2 0-3 3-3 6s1 4 3 4v8M17 3v18',
    home: 'M3 11l9-7 9 7M5 9.5V20h14V9.5M10 20v-6h4v6',
    bolt: 'M13 2 4 14h7l-1 8 9-12h-7z',
    train: 'M6 3h12v13H6zM6 11h12M9 16l-3 5M15 16l3 5M9 7h6',
    bag: 'M5 8h14l-1 13H6zM9 8V6a3 3 0 0 1 6 0v2',
    film: 'M3 4h18v16H3zM7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4',
    heart: 'M12 20s-8-5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 9c0 6-8 11-8 11z',
    plane: 'M2 13 22 5l-8 16-3-6zM11 15 22 5',
    briefcase: 'M3 7h18v13H3zM8 7V4h8v3M3 13h18',
    other: 'M5 5h14v14H5zM9 12h6',
  };
  const FILLED = new Set(['more', 'tri_up', 'tri_dn']);
  const ic = (n, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false" ${FILLED.has(n) ? 'fill="currentColor" stroke="none"' : 'fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter"'}><path d="${P[n] || P.other}"/></svg>`;

  /* ---------------- derived data ---------------- */
  const TYPES = [
    { k: 'CHECKING', n: 'Checking', c: 'CHK' }, { k: 'SAVINGS', n: 'Savings', c: 'SAV' },
    { k: 'INVESTMENT', n: 'Investment', c: 'INV' }, { k: 'CASH', n: 'Cash', c: 'CSH' },
    { k: 'GIFT_CARD', n: 'Gift card', c: 'GFT' }, { k: 'CREDIT_CARD', n: 'Credit card', c: 'CC', liab: true },
    { k: 'DEBT', n: 'Debt', c: 'DBT', liab: true },
  ];
  const typeOf = (k) => TYPES.find((t) => t.k === k);
  const assets = M.accounts.filter((a) => M.toEur(a) >= 0).reduce((s, a) => s + M.toEur(a), 0);
  const liabs = M.accounts.filter((a) => M.toEur(a) < 0).reduce((s, a) => s + M.toEur(a), 0);
  const catOf = (id) => (id === 'other' ? { id: 'other', name: 'Other', icon: 'other', color: '#8a8a8a' } : M.cat(id));
  const monthNow = M.monthly[M.monthly.length - 1];

  function budStats(b) {
    const p = (b.spent / b.limit) * 100;
    const status = p > 100 ? 'EXCEEDED' : p >= 80 ? 'WARNING' : 'OK';
    const s = day(b.start), e = day(b.end);
    const total = Math.round((e - s) / 864e5) + 1;
    const elapsed = Math.min(total, Math.round((TODAY - s) / 864e5) + 1);
    const left = Math.max(0, Math.round((e - TODAY) / 864e5));
    const ePct = (elapsed / total) * 100;
    const pace = status === 'EXCEEDED' ? 'OVER LIMIT' : p > ePct + 3 ? 'AHEAD OF PACE' : 'ON TRACK';
    return { p, status, left, ePct, pace, remaining: b.limit - b.spent, total, elapsed };
  }
  const ST = {
    OK: { cls: 'ok', icon: 'check', label: 'OK' },
    WARNING: { cls: 'warn', icon: 'warn', label: 'Warning' },
    EXCEEDED: { cls: 'crit', icon: 'xoct', label: 'Exceeded' },
  };
  const statusTag = (s) => `<span class="tag ${ST[s].cls}">${ic(ST[s].icon)}${ST[s].label}</span>`;
  const nb = () => `<span class="nb" title="This panel needs data the backend does not provide yet"><span>Needs backend</span></span>`;

  /* ---------------- money html ---------------- */
  function amt(n, cur = 'EUR', { liab = false } = {}) {
    const cls = liab ? 'liab' : n > 0 ? 'in' : 'out';
    const sr = n > 0 ? 'money in' : 'money out';
    return `<span class="amt ${cls}"><span class="sr-only">${liab ? 'liability' : sr}, </span>${esc(signed(n, cur))}</span>`;
  }
  const catChip = (id, { transfer } = {}) => {
    if (transfer) return `<span class="cat"><i style="--c:var(--ink-3)">${ic('transfer')}</i><span class="nm">Transfer</span></span>`;
    const c = catOf(id);
    if (!c) return `<span class="cat"><i>${ic('other')}</i><span class="nm ink3">Uncategorised</span></span>`;
    return `<span class="cat"><i style="--c:${c.color}">${ic(c.icon)}</i><span class="nm">${esc(c.name)}</span></span>`;
  };
  function txBadges(t, { native = true } = {}) {
    const b = [];
    (t.splits || []).forEach((s) => b.push(`<span class="badge">${ic('split')}Split <b>${esc(up(s.person))}</b> ${esc(native ? M.fmt(s.amount, txCur(t)) : eur(s.amount))}</span>`));
    if (t.transfer) b.push(`<span class="badge">${ic('transfer')}Transfer <b>${esc(up(t.transfer.linked))}</b></span>`);
    if (t.debt) b.push(`<span class="badge">${ic('hand')}Paid by <b>${esc(up(t.debt.paidBy))}</b></span>`);
    if (t.recurring) b.push(`<span class="badge">${ic('repeat')}Recurring</span>`);
    if (t.notes) b.push(`<span class="badge" title="${esc(t.notes)}">${ic('note')}Note<span class="sr-only">: ${esc(t.notes)}</span></span>`);
    if (txCur(t) !== 'EUR') b.push(`<span class="badge">${ic('globe')}<b>${txCur(t)}</b></span>`);
    return b.join('');
  }
  function txAmountCell(t) {
    const cur = txCur(t);
    let h = amt(t.amount, cur);
    if (cur !== 'EUR') h += `<span class="eq">approx. ${esc(signed(txEur(t)))}</span>`;
    return h;
  }

  /* ---------------- shell ---------------- */
  const NAV_ICON = ['grid', 'list', 'wallet', 'gauge', 'tag', 'users', 'chart', 'cpu', 'clock', 'trash', 'gear'];
  const LINKED = { Dashboard: 'dashboard.html', Transactions: 'transactions.html', Accounts: 'accounts.html', Budgets: 'budgets.html' };
  const initials = M.user.name.split(' ').map((w) => w[0]).join('').slice(0, 2);
  function navList() {
    return `<ul class="nav" role="list">${M.nav.map((n, i) => {
      const idx = String(i + 1).padStart(2, '0');
      const inner = `<span class="idx" aria-hidden="true">${idx}</span>${ic(NAV_ICON[i])}<span class="lbl">${n}</span>`;
      const cur = n.toLowerCase() === NAVPAGE ? ' aria-current="page"' : '';
      const item = LINKED[n] ? `<a href="${LINKED[n]}"${cur} title="${n}">${inner}</a>` : `<span class="inert" title="${n} (not mocked)">${inner}</span>`;
      return `<li>${item}</li>${i === 3 ? '<li aria-hidden="true"><hr></li>' : ''}`;
    }).join('')}</ul>`;
  }
  const userBlock = () => `<div class="user"><span class="avatar" aria-hidden="true">${initials}</span><div><b>${esc(M.user.name)}</b><span>${esc(M.user.email)}</span></div></div>`;
  function tickerItems() {
    const s = M.budgets.map(budStats);
    const items = [
      `NET WORTH <b>${esc(eur(M.netWorth))}</b>`,
      `SEP NET <b>${esc(signed(monthNow.income - monthNow.spend))}</b>`,
      ...Object.entries(M.fx).filter(([c]) => c !== 'EUR').map(([c, r]) => `${c}/EUR <b>${r.toFixed(4)}</b>`),
      ...M.accounts.filter((a) => a.dayChange != null).map((a) => `${esc(up(a.name))} <b>${signed(a.dayChange).replace('€', '')}%</b> TODAY`),
      ...M.accounts.filter((a) => a.provider).map((a) => `${esc(up(a.provider))} / ${esc(up(a.name))} <b>SYNCED ${esc(up(a.synced))}</b>`),
      `BUDGETS <b>${s.filter((x) => x.status === 'EXCEEDED').length} EXCEEDED</b>, <b>${s.filter((x) => x.status === 'WARNING').length} WARNING</b>`,
    ];
    return items.map((t) => `<li>${t}<span class="sep" aria-hidden="true">///</span></li>`).join('');
  }
  function feedAlerts() {
    if (params.get('alerts') === 'none') return [];
    const out = [];
    M.budgets.forEach((b) => { const x = budStats(b);
      if (x.status === 'EXCEEDED') out.push({ tone: 'crit', icon: 'xoct', text: `${up(b.name)} OVER BY <b>${esc(eur(b.spent - b.limit))}</b>`, href: 'budgets.html' });
      else if (x.status === 'WARNING') out.push({ tone: 'warn', icon: 'warn', text: `${up(b.name)} AT <b>${Math.round((b.spent / b.limit) * 100)}%</b> OF LIMIT`, href: 'budgets.html' });
    });
    M.transactions.filter((t) => !t.transfer && t.amount * (M.fx[t.currency || 'EUR'] || 1) <= -500).forEach((t) => out.push({ tone: 'info', icon: 'tri_dn', text: `LARGE SPEND <b>${esc(up(t.title))} ${esc(M.fmt(t.amount, t.currency || 'EUR'))}</b>`, href: 'transactions.html' }));
    M.people.filter((x) => x.owes_me > 0).sort((a, b) => b.owes_me - a.owes_me).forEach((x) => out.push({ tone: 'pos', icon: 'tri_up', text: `${esc(up(x.name))} OWES YOU <b>${esc(eur(x.owes_me))}</b>`, href: 'dashboard.html' }));
    const rank = { crit: 0, warn: 1, info: 2, pos: 3 };
    return out.sort((a, b) => rank[a.tone] - rank[b.tone]);
  }
  function statusStrip() {
    const s = M.budgets.map(budStats), ex = s.filter((x) => x.status === 'EXCEEDED').length, wn = s.filter((x) => x.status === 'WARNING').length;
    const net = monthNow.income - monthNow.spend, synced = M.accounts.filter((a) => a.provider);
    const al = feedAlerts();
    const slot = (cls, k, v, href) => `<a class="ss-slot ${cls}" href="${href}"><span class="ss-k">${k}</span><span class="ss-v">${v}</span></a>`;
    return `<div class="sstrip" id="sstrip">
      ${slot('ss-nw', 'NET WORTH', esc(eur(M.netWorth)), 'accounts.html')}
      ${slot('ss-mn', `${up(monthNow.m)} NET`, `<span class="${net >= 0 ? 'pos' : 'neg'}">${esc(signed(net))}</span>`, 'transactions.html')}
      ${slot('ss-bd', 'BUDGETS', ex + wn ? `<span>${ex ? `<span class="neg">${ex} OVER</span>` : ''}${ex && wn ? ', ' : ''}${wn ? `<span class="wrn">${wn} WARNING</span>` : ''}</span>` : '<span class="pos">ALL OK</span>', 'budgets.html')}
      ${slot('ss-sy', 'LAST SYNC', `<i class="live" aria-hidden="true"></i>${esc(up(synced[0]?.synced || 'never'))}`, 'accounts.html')}
      <div class="ss-alert" id="ss-alert" data-n="${al.length}">
        <span class="ss-k">ALERTS${al.length ? ` <b id="ss-idx">1/${al.length}</b>` : ''}</span>
        <div class="ss-win" aria-live="off">${al.length ? al.map((a, i) => `<a class="ss-item t-${a.tone}${i ? '' : ' on'}" href="${a.href}" ${i ? 'tabindex="-1" aria-hidden="true"' : ''}>${ic(a.icon)}<span>${a.text}</span></a>`).join('') : `<span class="ss-item t-pos on">${ic('check')}<span>ALL CLEAR</span></span>`}</div>
        ${al.length > 1 ? `<button class="btn btn-sm btn-icon btn-ghost" id="ss-pause" aria-pressed="false" aria-label="Pause alerts" title="Pause alerts">${ic('pause')}</button>` : ''}
      </div>
    </div>`;
  }
  function wireStrip() {
    const box = $('#ss-alert'); if (!box) return;
    const items = $$('.ss-item', box); if (items.length < 2) return;
    let i = 0, paused = false, hold = false;
    const idx = $('#ss-idx'), pb = $('#ss-pause');
    const go = () => { items[i].classList.remove('on'); items[i].setAttribute('aria-hidden', 'true'); items[i].tabIndex = -1; i = (i + 1) % items.length; items[i].classList.add('on'); items[i].removeAttribute('aria-hidden'); items[i].removeAttribute('tabindex'); idx.textContent = `${i + 1}/${items.length}`; };
    setInterval(() => { if (!paused && !hold) go(); }, 4500);
    box.addEventListener('pointerenter', () => { hold = true; }); box.addEventListener('pointerleave', () => { hold = false; });
    box.addEventListener('focusin', () => { hold = true; }); box.addEventListener('focusout', () => { hold = false; });
    pb.addEventListener('click', () => { paused = !paused; pb.setAttribute('aria-pressed', String(paused)); pb.innerHTML = ic(paused ? 'play' : 'pause'); pb.setAttribute('aria-label', paused ? 'Play alerts' : 'Pause alerts'); });
  }
  function shell() {
    const inner = document.body.innerHTML; // page-provided noscript etc
    document.body.innerHTML = `
<a class="skip" href="#page">Skip to content</a>
<div class="app">
  <aside class="side" aria-label="Sidebar">
    <div class="brand"><span class="brand-mark" aria-hidden="true">MC</span><span class="brand-name">Master of Coin<small>FIN/TERMINAL</small></span></div>
    <nav aria-label="Primary">${navList()}</nav>
    <div class="side-foot">
      ${userBlock()}
      <div class="side-ctl"><span class="ver"><i class="dot" aria-hidden="true"></i><span>v${esc(M.user.version)}</span></span>
        <button class="btn btn-sm btn-icon btn-ghost" id="collapse" aria-expanded="true" aria-label="Collapse sidebar" title="Collapse sidebar">${ic('sidebar')}</button></div>
    </div>
  </aside>
  <div class="main">
    <header class="top">
      <div style="display:flex;min-width:0">
        <a class="mob-brand" href="dashboard.html" aria-label="Master of Coin, dashboard"><span class="brand-mark" aria-hidden="true">MC</span><span class="brand-name">MoC</span></a>
        ${FEED === 'ticker' ? `<div class="ticker" id="ticker" style="flex:1">
          <span class="ticker-label"><i class="live" aria-hidden="true"></i>LIVE FEED</span>
          <div class="ticker-window" role="marquee" aria-label="Live account feed">
            <div class="ticker-track"><ul>${tickerItems()}</ul><ul aria-hidden="true">${tickerItems()}</ul></div>
          </div>
          <button class="btn btn-sm btn-icon btn-ghost" id="tick-pause" aria-pressed="false" aria-label="Pause feed" title="Pause feed" style="margin:0 4px">${ic('pause')}</button>
        </div>` : statusStrip()}
      </div>
      <div class="top-actions">
        <span class="clock" id="clock" aria-hidden="true"></span>
        <button class="btn btn-icon" id="theme" aria-label="Switch theme">${ic('sun')}</button>
      </div>
    </header>
    <main id="page" tabindex="-1"></main>
  </div>
</div>
<nav class="bottombar" aria-label="Primary, mobile">
  ${['Dashboard', 'Transactions', 'Accounts', 'Budgets'].map((n, i) => `<a href="${LINKED[n]}"${n.toLowerCase() === NAVPAGE ? ' aria-current="page"' : ''}>${ic(NAV_ICON[i])}<span>${n === 'Transactions' ? 'Txns' : n === 'Dashboard' ? 'Dash' : n}</span></a>`).join('')}
  <button id="more" aria-haspopup="dialog">${ic('menu')}<span>More</span></button>
</nav>
<dialog class="drawer" id="drawer" aria-labelledby="drawer-title"></dialog>
<dialog class="modal" id="modal" aria-labelledby="modal-title"></dialog>
<dialog class="sheet" id="sheet" aria-label="Navigation"></dialog>
<div class="menu" id="menu" role="menu" aria-hidden="true"></div>
<div class="toasts" id="toasts"></div>
<div class="sr-only" aria-live="polite" id="live"></div>
${inner}`;

    // collapse
    const col = $('#collapse');
    const setCol = (c) => { document.body.classList.toggle('nav-collapsed', c); col.setAttribute('aria-expanded', String(!c)); col.setAttribute('aria-label', c ? 'Expand sidebar' : 'Collapse sidebar'); localStorage.setItem('moc-c-nav', c ? '1' : '0'); };
    if (localStorage.getItem('moc-c-nav') === '1') setCol(true);
    col.addEventListener('click', () => setCol(!document.body.classList.contains('nav-collapsed')));
    // ticker pause
    const tp = $('#tick-pause');
    if (!tp) wireStrip();
    else tp.addEventListener('click', () => { const on = tp.getAttribute('aria-pressed') !== 'true'; tp.setAttribute('aria-pressed', String(on)); $('#ticker').classList.toggle('paused', on); tp.innerHTML = ic(on ? 'play' : 'pause'); tp.setAttribute('aria-label', on ? 'Play feed' : 'Pause feed'); });
    // clock
    const clk = $('#clock');
    const tick = () => { clk.textContent = new Date().toLocaleTimeString('en-GB', { hour12: false }) + ' LOCAL'; };
    tick(); setInterval(tick, 1000);
    // theme
    syncThemeBtn();
    $('#theme').addEventListener('click', toggleTheme);
    // mobile more sheet
    const sheet = $('#sheet');
    sheet.innerHTML = `<div class="side-in"><div class="ph"><h2>Navigation</h2><button class="btn btn-icon btn-ghost" data-close aria-label="Close navigation">${ic('close')}</button></div>
      <nav aria-label="All sections">${navList()}</nav>${userBlock()}<div class="side-ctl"><span class="ver"><i class="dot" aria-hidden="true"></i>v${esc(M.user.version)}</span></div></div>`;
    wireDialog(sheet);
    $('#more').addEventListener('click', (e) => openDlg(sheet, e.currentTarget));
    wireDialog($('#drawer'));
    wireDialog($('#modal'));
    // keyboard: N adds a transaction
    document.addEventListener('keydown', (e) => {
      if (e.key === 'n' && !e.metaKey && !e.ctrlKey && !e.altKey && !/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) && !$('dialog[open]')) { e.preventDefault(); forms.addTx(); }
    });
  }

  /* ---------------- theme ---------------- */
  const curTheme = () => root.dataset.theme || 'dark';
  function syncThemeBtn() {
    const b = $('#theme'); if (!b) return;
    const next = curTheme() === 'dark' ? 'light' : 'dark';
    b.innerHTML = ic(next === 'light' ? 'sun' : 'moon');
    b.setAttribute('aria-label', `Switch to ${next} theme`); b.title = `Switch to ${next} theme`;
  }
  function setTheme(t) { root.dataset.theme = t; try { localStorage.setItem('moc-c-theme', t); } catch (_) { /* file:// */ } syncThemeBtn(); }
  function toggleTheme() {
    const next = curTheme() === 'dark' ? 'light' : 'dark';
    if (RM || !document.startViewTransition) {
      const s = document.createElement('style'); s.textContent = '*,*::before,*::after{transition:none!important}';
      document.head.append(s); setTheme(next); void document.body.offsetHeight; requestAnimationFrame(() => s.remove());
      return;
    }
    const vt = document.startViewTransition(() => setTheme(next));
    vt.ready.then(() => {
      root.animate({ clipPath: ['inset(0 0 100% 0)', 'inset(0 0 0 0)'] }, { duration: 600, easing: IO, pseudoElement: '::view-transition-new(root)' });
      const edge = document.createElement('div'); edge.className = 'wipe-edge'; document.body.append(edge);
      edge.animate([{ transform: 'translateY(-2px)' }, { transform: `translateY(${innerHeight - 2}px)` }], { duration: 600, easing: IO }).onfinish = () => edge.remove();
    });
  }

  /* ---------------- dialogs ---------------- */
  function wireDialog(d) {
    d.addEventListener('cancel', (e) => { e.preventDefault(); closeDlg(d); });
    d.addEventListener('click', (e) => { if (e.target === d || e.target.closest('[data-close]')) closeDlg(d); });
    d.addEventListener('close', () => { d._trigger?.isConnected && d._trigger.focus(); });
  }
  function openDlg(d, trigger) {
    d._trigger = trigger || document.activeElement;
    d.classList.remove('closing');
    if (!d.open) d.showModal();
    const f = d.querySelector('[autofocus]') || d.querySelector('button, [href], input, select, textarea');
    f && f.focus();
  }
  function closeDlg(d) {
    if (!d.open) return;
    if (RM) { d.close(); return; }
    d.classList.add('closing');
    const done = (e) => { if (e && e.target !== d) return; d.removeEventListener('animationend', done); d.classList.remove('closing'); d.close(); };
    d.addEventListener('animationend', done);
  }

  /* ---------------- menu ---------------- */
  let menuBtn = null;
  function openMenu(btn, items) {
    const m = $('#menu');
    if (menuBtn === btn && m.classList.contains('on')) { closeMenu(); return; }
    closeMenu(true);
    m.innerHTML = items.map((it, i) => it === '-' ? '<hr>' : `<button role="menuitem" data-i="${i}" class="${it.danger ? 'danger' : ''}" ${it.disabled ? 'aria-disabled="true"' : ''}>${ic(it.icon)}<span style="flex:1">${it.label}</span>${it.chip || ''}</button>`).join('');
    const r = btn.getBoundingClientRect();
    m.style.left = '0px'; m.style.top = '0px'; m.classList.add('on'); m.setAttribute('aria-hidden', 'false');
    const mw = m.offsetWidth, mh = m.offsetHeight;
    const left = Math.max(8, Math.min(innerWidth - mw - 8, r.right - mw));
    const below = r.bottom + 4 + mh < innerHeight;
    m.style.left = left + 'px'; m.style.top = (below ? r.bottom + 4 : r.top - mh - 4) + 'px';
    m.style.transformOrigin = below ? 'top right' : 'bottom right';
    btn.setAttribute('aria-expanded', 'true');
    menuBtn = btn;
    const btns = $$('button', m);
    btns[0]?.focus();
    m.onkeydown = (e) => {
      const i = btns.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); btns[(i + 1) % btns.length].focus(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); btns[(i - 1 + btns.length) % btns.length].focus(); }
      if (e.key === 'Escape' || e.key === 'Tab') { e.preventDefault(); closeMenu(); }
    };
    m.onclick = (e) => { const b = e.target.closest('button'); if (!b || b.getAttribute('aria-disabled')) return; const it = items[+b.dataset.i]; closeMenu(true); it.act && it.act(); };
  }
  function closeMenu(silent) {
    const m = $('#menu'); if (!m) return;
    m.classList.remove('on'); m.setAttribute('aria-hidden', 'true');
    if (menuBtn) { menuBtn.setAttribute('aria-expanded', 'false'); if (!silent) menuBtn.focus(); }
    menuBtn = null;
  }
  document.addEventListener('pointerdown', (e) => { if (menuBtn && !e.target.closest('#menu') && e.target.closest('button') !== menuBtn) closeMenu(true); });
  addEventListener('scroll', () => menuBtn && closeMenu(true), { passive: true });

  /* ---------------- toast ---------------- */
  function toast(msg, sub, undo) {
    const box = $('#toasts');
    const t = document.createElement('div');
    t.className = 'toast'; t.setAttribute('role', 'status');
    t.innerHTML = `<div class="msg">${esc(msg)}${sub ? `<small>${esc(sub)}</small>` : ''}</div>${undo ? '<button class="btn btn-sm">Undo</button>' : ''}<button class="btn btn-sm btn-icon" aria-label="Dismiss">${ic('close')}</button><i class="life" aria-hidden="true"></i>`;
    box.append(t);
    const kill = () => { if (t._dead) return; t._dead = true; t.classList.add('out'); setTimeout(() => t.remove(), 220); };
    if (undo) t.querySelector('.btn').addEventListener('click', () => { undo(); kill(); live('Restored'); });
    t.querySelector('[aria-label="Dismiss"]').addEventListener('click', kill);
    const life = t.querySelector('.life');
    if (RM) setTimeout(kill, 6000); else life.addEventListener('animationend', kill);
  }

  /* ---------------- forms (mock) ---------------- */
  const acctOpts = (sel) => M.accounts.map((a) => `<option value="${a.id}" ${a.id === sel ? 'selected' : ''}>${esc(a.name)} (${a.currency})</option>`).join('');
  const catOpts = (sel) => `<option value="">Uncategorised</option>` + M.categories.map((c) => `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>${esc(c.name)}</option>`).join('');
  function field(f) {
    const id = 'f-' + f.id;
    let ctl;
    if (f.type === 'select') ctl = `<select class="input" id="${id}" ${f.disabled ? 'disabled' : ''}>${f.options}</select>`;
    else if (f.type === 'textarea') ctl = `<textarea class="input" id="${id}" ${f.disabled ? 'disabled' : ''}>${esc(f.value || '')}</textarea>`;
    else if (f.type === 'file') ctl = `<div class="drop">${ic('upload')}<span>Drop a CSV here, or choose a file</span><input id="${id}" type="file" accept=".csv,text/csv"></div>`;
    else ctl = `<input class="input" id="${id}" type="${f.type || 'text'}" ${f.step ? `step="${f.step}"` : ''} value="${esc(f.value ?? '')}" ${f.req ? 'required' : ''} ${f.auto ? 'autofocus' : ''}>`;
    return `<div class="field" ${f.full ? 'style="grid-column:1/-1"' : ''}><label for="${id}">${f.label}${f.chip || ''}</label>${ctl}${f.hint ? `<span class="micro">${f.hint}</span>` : ''}</div>`;
  }
  function openForm({ title, code, fields, submit, done, danger }) {
    const d = $('#modal');
    const rows = [];
    for (let i = 0; i < fields.length; i++) {
      const f = fields[i];
      if (f.full || !fields[i + 1] || fields[i + 1].full) rows.push(f.full ? field(f) : `<div class="two">${field(f)}<span></span></div>`);
      else { rows.push(`<div class="two">${field(f)}${field(fields[i + 1])}</div>`); i++; }
    }
    d.innerHTML = `<div class="hazard-top" aria-hidden="true"></div><div class="ph"><h2 id="modal-title">${title}</h2><div class="meta"><span class="micro">${code || ''}</span><button class="btn btn-sm btn-icon btn-ghost" data-close aria-label="Close">${ic('close')}</button></div></div>
      <form method="dialog" novalidate>${rows.join('')}<div class="foot"><button type="button" class="btn" data-close>Cancel</button><button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" value="ok">${submit}</button></div></form>`;
    d.querySelector('form').addEventListener('submit', (e) => { e.preventDefault(); closeDlg(d); toast(done || 'Saved', 'Mock only, nothing was written'); });
    openDlg(d, document.activeElement);
  }
  const forms = {
    addTx: (t) => openForm({
      title: t ? 'Edit transaction' : 'Add transaction', code: t ? `TXN/${up(t.id)}` : 'TXN/NEW', submit: t ? 'Save changes' : 'Add transaction', done: t ? 'Transaction updated' : 'Transaction added',
      fields: [
        { id: 'title', label: 'Title', value: t?.title || '', full: true, auto: true },
        { id: 'amount', label: 'Amount', type: 'number', step: '0.01', value: t ? Math.abs(t.amount) : '' },
        { id: 'dir', label: 'Direction', type: 'select', options: `<option ${!t || t.amount < 0 ? 'selected' : ''}>Money out</option><option ${t && t.amount > 0 ? 'selected' : ''}>Money in</option>` },
        { id: 'acct', label: 'Account', type: 'select', options: acctOpts(t?.account_id) },
        { id: 'cat', label: 'Category', type: 'select', options: catOpts(t?.category_id) },
        { id: 'date', label: 'Date', type: 'date', value: t?.date || '2026-09-25' },
        { id: 'split', label: 'Split with', type: 'select', options: '<option value="">Nobody</option>' + M.people.map((p) => `<option ${t?.splits?.[0]?.person === p.name ? 'selected' : ''}>${p.name}</option>`).join('') },
        { id: 'notes', label: 'Notes', type: 'textarea', value: t?.notes || '', full: true },
      ],
    }),
    transfer: (t) => openForm({
      title: t ? 'Convert to transfer' : 'Transfer', code: 'XFR/NEW', submit: t ? 'Convert' : 'Create transfer', done: t ? 'Converted to transfer' : 'Transfer created',
      fields: [
        { id: 'from', label: 'From account', type: 'select', options: acctOpts(t?.account_id || 'a-main') },
        { id: 'to', label: 'To account', type: 'select', options: acctOpts('a-save') },
        { id: 'amt', label: 'Amount sent', type: 'number', step: '0.01', value: t ? Math.abs(t.amount) : '' },
        { id: 'amt2', label: 'Amount received', type: 'number', step: '0.01', value: t ? Math.abs(t.amount) : '', hint: 'Differs for fees or discounts' },
        t ? { id: 'link', label: 'Link existing transaction', type: 'select', full: true, options: '<option>Create the other leg</option>' + M.transactions.filter((x) => x.amount > 0).map((x) => `<option>${esc(x.title)}, ${esc(signed(x.amount))}</option>`).join('') }
          : { id: 'date', label: 'Date', type: 'date', value: '2026-09-25', full: true },
      ],
    }),
    importCsv: () => openForm({
      title: 'Import CSV', code: 'IMP/CSV', submit: 'Upload and map columns', done: 'Import queued as a background job',
      fields: [{ id: 'file', label: 'CSV file', type: 'file', full: true }, { id: 'acct', label: 'Into account', type: 'select', options: acctOpts('a-main'), full: true }],
    }),
    account: (a) => openForm({
      title: a ? 'Edit account' : 'Add account', code: a ? `ACC/${up(a.id)}` : 'ACC/NEW', submit: a ? 'Save changes' : 'Add account', done: a ? 'Account updated' : 'Account added',
      fields: [
        { id: 'name', label: 'Name', value: a?.name || '', full: true, auto: true },
        { id: 'type', label: 'Type', type: 'select', options: TYPES.map((t) => `<option ${a?.account_type === t.k ? 'selected' : ''}>${t.n}</option>`).join('') },
        { id: 'cur', label: 'Currency', type: 'select', options: Object.keys(M.fx).map((c) => `<option ${a?.currency === c ? 'selected' : ''}>${c}</option>`).join('') },
        { id: 'bal', label: 'Opening balance', type: 'number', step: '0.01', value: a?.balance ?? '' },
        { id: 'notes', label: 'Notes', value: '' },
      ],
    }),
    connect: () => openForm({
      title: 'Connect provider', code: 'LINK/NEW', submit: 'Continue to provider', done: 'Redirecting to provider (mock)',
      fields: [
        { id: 'prov', label: 'Provider', type: 'select', full: true, options: '<option>TrueLayer, Open Banking (bank accounts, cards)</option><option>Trading 212 (investment portfolio, API key)</option>' },
        { id: 'acct', label: 'Link to existing account', type: 'select', full: true, options: '<option>Create new account</option>' + acctOpts() },
      ],
    }),
    budget: (b) => openForm({
      title: b ? 'Edit budget' : 'Create budget', code: b ? `BUD/${up(b.id)}` : 'BUD/NEW', submit: b ? 'Save changes' : 'Create budget', done: b ? 'Budget updated' : 'Budget created',
      fields: [
        { id: 'name', label: 'Name', value: b?.name || '', full: true, auto: true },
        { id: 'cat', label: 'Category', type: 'select', options: catOpts(b?.category_id) },
        { id: 'period', label: 'Period', type: 'select', options: ['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY'].map((p) => `<option ${(b?.period || 'MONTHLY') === p ? 'selected' : ''}>${p}</option>`).join('') },
        { id: 'limit', label: 'Limit (EUR)', type: 'number', step: '0.01', value: b?.limit ?? '' },
        { id: 'start', label: 'Starts', type: 'date', value: b?.start || '2026-10-01' },
      ],
    }),
  };

  /* ---------------- motion engine (once per load) ---------------- */
  const BOOTED = (() => { try { return sessionStorage.getItem('moc-c-boot') === '1'; } catch (_) { return true; } })();
  let BOOT_MS = 0;
  function bootSequence() {
    if (RM || BOOTED || params.get('boot') === '0') return Promise.resolve();
    try { sessionStorage.setItem('moc-c-boot', '1'); } catch (_) { /* ignore */ }
    const lines = [
      `<b>MASTER OF COIN</b>  FIN/TERMINAL v${esc(M.user.version)}`,
      `LINK .............. <span class="ok">OK</span>`,
      `LEDGER ............ <b>${TOTAL_TX}</b> RECORDS`,
      `ACCOUNTS .......... <b>${M.accounts.length}</b> ONLINE, ${M.accounts.filter((a) => a.provider).length} LINKED`,
      `FX ................ EUR BASE, ${Object.keys(M.fx).length - 1} PAIRS`,
      `BUDGETS ........... <b>${M.budgets.length}</b> ARMED`,
      `READY`,
    ];
    const el = document.createElement('div');
    el.id = 'boot'; el.setAttribute('aria-hidden', 'true');
    el.innerHTML = `<div class="log">${lines.map((l) => `<div>${l}</div>`).join('')}<div class="bar"><i></i></div></div><i class="edge"></i>`;
    document.body.append(el);
    const rows = $$('.log div', el);
    const STEP = 85, N = rows.length;
    rows.forEach((r, i) => setTimeout(() => r.classList.add('on'), 60 + i * STEP));
    $('.bar i', el).animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: N * STEP + 60, easing: FLOW, fill: 'forwards' });
    const hold = N * STEP + 160;
    BOOT_MS = hold + 380;
    return new Promise((res) => {
      let gone = false;
      const out = () => {
        if (gone) return; gone = true;
        el.animate([{ clipPath: 'inset(0 0 0 0)' }, { clipPath: 'inset(0 0 100% 0)' }], { duration: 480, easing: IO, fill: 'forwards' }).onfinish = () => { el.remove(); };
        res();
      };
      setTimeout(out, hold);
      el.addEventListener('pointerdown', out); addEventListener('keydown', out, { once: true });
    });
  }
  function powerOn(scope = document) {
    const els = $$('#page .pwr-me', scope);
    els.forEach((el, i) => { el.style.setProperty('--i', Math.min(i, 12)); el.style.setProperty('--boot', BOOT_MS + 'ms'); el.classList.add('pwr'); });
    $$('#page .phead', scope).forEach((el) => { el.style.setProperty('--boot', BOOT_MS + 'ms'); el.classList.add('rise'); });
  }
  // generic one-shot animations on [data-a]
  function runAnims(scope, base = 0) {
    $$('[data-a]', scope).forEach((el) => {
      const d = base + (+el.dataset.d || 0);
      const kind = el.dataset.a; delete el.dataset.a;
      if (RM) return;
      const opt = { duration: +el.dataset.dur || 900, delay: d, easing: FLOW, fill: 'backwards' };
      if (kind === 'clipx') el.animate([{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: getComputedStyle(el).clipPath === 'none' ? 'inset(0 0 0 0)' : getComputedStyle(el).clipPath }], opt);
      else if (kind === 'scalex') el.animate([{ transform: 'scaleX(0)' }, { transform: getComputedStyle(el).transform }], opt);
      else if (kind === 'scaley') el.animate([{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }], opt);
      else if (kind === 'draw') { const L = el.getTotalLength(); el.style.strokeDasharray = `${L} ${L}`; el.animate([{ strokeDashoffset: L }, { strokeDashoffset: 0 }], { ...opt, duration: +el.dataset.dur || 1300 }); }
      else if (kind === 'arc') { const from = +el.dataset.from; el.animate([{ strokeDashoffset: from }, { strokeDashoffset: +el.getAttribute('stroke-dashoffset') }], { ...opt, duration: +el.dataset.dur || 1100 }); }
      else if (kind === 'fade') el.animate([{ opacity: 0 }, { opacity: 1 }], { ...opt, duration: 300 });
      else if (kind === 'ping') el.animate([{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(3.2)', opacity: 0 }], { duration: 900, delay: d, easing: 'cubic-bezier(0.23,1,0.32,1)', fill: 'both', iterations: 2 });
    });
    // count-ups (final text is already in the DOM; we replay to it)
    $$('[data-count]', scope).forEach((el) => {
      const to = +el.dataset.count, f = el.dataset.fmt || 'eur', cur = el.dataset.cur || 'EUR';
      delete el.dataset.count;
      if (RM) return;
      const fmtf = (v) => f === 'signed' ? signed(v, cur) : f === 'pct' ? pct(v, +(el.dataset.dp || 0)) : f === 'int' ? String(Math.round(v)) : M.fmt(v, cur);
      const final = el.textContent;
      const d = base + (+el.dataset.d || 0), dur = 1000;
      el.textContent = fmtf(0);
      setTimeout(() => {
        const t0 = performance.now();
        const step = (t) => { const p = Math.min(1, (t - t0) / dur); const e = 1 - Math.pow(1 - p, 4); el.textContent = p < 1 ? fmtf(to * e) : final; if (p < 1) requestAnimationFrame(step); };
        requestAnimationFrame(step);
      }, d);
    });
  }
  // digit roll for hero figures
  function rollHTML(value, cur = 'EUR') {
    const str = M.fmt(value, cur);
    const strip = '0123456789'.repeat(3).split('').map((d) => `<span>${d}</span>`).join('');
    return `<span class="sr-only">${esc(str)}</span><span class="roll" aria-hidden="true" data-roll="${esc(str)}">${[...str].map((ch) => /\d/.test(ch) ? `<span class="rc"><span class="rs">${strip}</span></span>` : `<span class="rx${/[€£₹$]/.test(ch) ? ' cur' : ''}">${esc(ch)}</span>`).join('')}</span>`;
  }
  function runRolls(scope, base = 0) {
    $$('[data-roll]', scope).forEach((r) => {
      const digits = r.dataset.roll.replace(/\D/g, '').split('').map(Number);
      const strips = $$('.rs', r);
      strips.forEach((s, i) => {
        const k = 10 + (i >= digits.length - 4 ? 10 : 0) + digits[i];
        const end = `translateY(${(-k / 30) * 100}%)`;
        s.style.transform = end;
        if (!RM) s.animate([{ transform: 'translateY(0)' }, { transform: end }], { duration: 1200 + i * 90, delay: base + i * 35, easing: FLOW, fill: 'backwards' });
      });
    });
  }
  function kickoff(scope = document.getElementById('page')) {
    const base = BOOT_MS + 180;
    runRolls(scope, base);
    runAnims(scope, base);
  }

  /* ---------------- charts ---------------- */
  const NS = 'http://www.w3.org/2000/svg';
  function niceTicks(min, max, n = 4) {
    const span = max - min, step0 = span / n, mag = Math.pow(10, Math.floor(Math.log10(step0)));
    const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step0);
    const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
    const out = []; for (let v = lo; v <= hi + 1e-9; v += step) out.push(v);
    return out;
  }
  function tipAt(box, tip, html, x, y) {
    tip.innerHTML = html; tip.classList.add('on');
    const bw = box.clientWidth, tw = tip.offsetWidth;
    tip.style.left = Math.max(0, Math.min(bw - tw, x + 12)) + 'px';
    tip.style.top = Math.max(0, y - 10) + 'px';
  }
  function lineChart(box, { values, labels, height = 200, animate = true, fmtV = eur, name = 'Value' }) {
    const W = box.clientWidth, H = height, pl = 0, pr = 58, pt = 14, pb = 24;
    const lo = Math.min(...values), hi = Math.max(...values);
    const ticks = niceTicks(lo - (hi - lo) * 0.1, hi + (hi - lo) * 0.05, 4);
    const y0 = ticks[0], y1 = ticks[ticks.length - 1];
    const X = (i) => pl + (i * (W - pl - pr)) / (values.length - 1);
    const Y = (v) => pt + (1 - (v - y0) / (y1 - y0)) * (H - pt - pb);
    const pts = values.map((v, i) => [X(i), Y(v)]);
    const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('');
    const area = `${d}L${X(values.length - 1)} ${H - pb}L${X(0)} ${H - pb}Z`;
    const every = W < 520 ? 3 : 1;
    const last = pts[pts.length - 1];
    box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" height="${H}" role="presentation" aria-hidden="true">
      ${ticks.map((t) => `<line class="gridl" x1="${pl}" x2="${W - pr + 6}" y1="${Y(t)}" y2="${Y(t)}"/><text x="${W}" y="${Y(t) + 3.5}" text-anchor="end">${compact(t)}</text>`).join('')}
      <line class="axis" x1="${pl}" x2="${W - pr + 6}" y1="${H - pb}" y2="${H - pb}"/>
      ${labels.map((l, i) => i % every === (labels.length - 1) % every ? `<text x="${X(i)}" y="${H - 6}" text-anchor="${i === 0 ? 'start' : i === labels.length - 1 ? 'end' : 'middle'}">${up(l)}</text>` : '').join('')}
      <path class="area" d="${area}" ${animate ? 'data-a="clipx" data-dur="1300"' : ''}/>
      <path class="line" d="${d}" ${animate ? 'data-a="draw"' : ''}/>
      <rect class="ping" x="${last[0] - 4}" y="${last[1] - 4}" width="8" height="8" ${animate ? 'data-a="ping" data-d="1250"' : 'opacity="0"'}/>
      <rect class="pt" x="${last[0] - 3.5}" y="${last[1] - 3.5}" width="7" height="7" ${animate ? 'data-a="fade" data-d="1200"' : ''}/>
      <line class="xhair" id="xv" y1="${pt}" y2="${H - pb}"/><line class="xhair" id="xh" x1="${pl}" x2="${W - pr + 6}"/>
      <rect class="pt" id="xp" width="7" height="7" opacity="0"/>
    </svg><div class="tip" aria-hidden="true"></div>`;
    const svg = $('svg', box), tip = $('.tip', box), xv = $('#xv', svg), xh = $('#xh', svg), xp = $('#xp', svg);
    let cur = -1;
    const show = (i) => {
      cur = i; const [x, y] = pts[i];
      xv.setAttribute('x1', x); xv.setAttribute('x2', x); xh.setAttribute('y1', y); xh.setAttribute('y2', y);
      xv.style.opacity = xh.style.opacity = 1; xp.setAttribute('x', x - 3.5); xp.setAttribute('y', y - 3.5); xp.setAttribute('opacity', 1);
      const dv = i ? values[i] - values[i - 1] : 0;
      tipAt(box, tip, `<div class="k">${up(labels[i])}</div><b>${esc(fmtV(values[i]))}</b><div>${i ? `${dv >= 0 ? 'Up' : 'Down'} ${esc(fmtV(Math.abs(dv)))} on ${up(labels[i - 1])}` : 'First month shown'}</div>`, x, y);
    };
    const hide = () => { cur = -1; xv.style.opacity = xh.style.opacity = 0; xp.setAttribute('opacity', 0); tip.classList.remove('on'); };
    svg.addEventListener('pointermove', (e) => { const r = svg.getBoundingClientRect(); const i = Math.round(((e.clientX - r.left - pl) / (W - pl - pr)) * (values.length - 1)); show(Math.max(0, Math.min(values.length - 1, i))); });
    svg.addEventListener('pointerleave', hide);
    box.onkeydown = (e) => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); show(Math.max(0, Math.min(values.length - 1, (cur < 0 ? values.length - 1 : cur) + (e.key === 'ArrowRight' ? 1 : -1)))); } if (e.key === 'Escape') hide(); };
    box.onblur = hide;
  }
  function barsChart(box, { data, height = 200, animate = true }) {
    const W = box.clientWidth, H = height, pr = 50, pt = 10, pb = 24;
    const hi = Math.max(...data.map((d) => Math.max(d.income, d.spend)));
    const ticks = niceTicks(0, hi, 4); const y1 = ticks[ticks.length - 1];
    const gw = (W - pr) / data.length, bw = Math.max(3, Math.min(12, gw * 0.26));
    const Y = (v) => pt + (1 - v / y1) * (H - pt - pb);
    const every = W < 520 ? 3 : 1;
    box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" height="${H}" aria-hidden="true">
      <rect x="${(data.length - 1) * gw}" y="${pt - 6}" width="${gw}" height="${H - pt - pb + 6}" fill="var(--accent-soft)"/>
      ${ticks.map((t) => `<line class="gridl" x1="0" x2="${W - pr + 6}" y1="${Y(t)}" y2="${Y(t)}"/><text x="${W}" y="${Y(t) + 3.5}" text-anchor="end">${compact(t)}</text>`).join('')}
      ${data.map((d, i) => {
        const cx = i * gw + gw / 2;
        return `<rect class="b-income" style="transform-box:fill-box;transform-origin:50% 100%" x="${cx - bw - 1}" y="${Y(d.income)}" width="${bw}" height="${H - pb - Y(d.income)}" ${animate ? `data-a="scaley" data-d="${i * 35}" data-dur="700"` : ''}/>
          <rect class="b-spend" style="transform-box:fill-box;transform-origin:50% 100%" x="${cx + 1}" y="${Y(d.spend)}" width="${bw}" height="${H - pb - Y(d.spend)}" ${animate ? `data-a="scaley" data-d="${i * 35 + 60}" data-dur="700"` : ''}/>
          ${i % every === (data.length - 1) % every ? `<text x="${cx}" y="${H - 6}" text-anchor="middle" ${i === data.length - 1 ? 'style="fill:var(--ink);font-weight:700"' : ''}>${up(d.m)}</text>` : ''}
          <rect class="colhit" data-i="${i}" x="${i * gw}" y="${pt}" width="${gw}" height="${H - pt - pb}"/>`;
      }).join('')}
      <line class="axis" x1="0" x2="${W - pr + 6}" y1="${H - pb}" y2="${H - pb}"/>
    </svg><div class="tip" aria-hidden="true"></div>`;
    const tip = $('.tip', box);
    const show = (i, el) => {
      $$('.colhit', box).forEach((c) => c.classList.toggle('on', c === el));
      const d = data[i]; const n = d.income - d.spend;
      tipAt(box, tip, `<div class="k">${up(d.m)}</div><div>Income <b>${esc(eur(d.income))}</b></div><div>Spend <b>${esc(eur(d.spend))}</b></div><div>Net <b>${esc(signed(n))}</b></div>`, i * gw + gw / 2, 20);
    };
    $$('.colhit', box).forEach((c) => { c.addEventListener('pointerenter', () => show(+c.dataset.i, c)); });
    $('svg', box).addEventListener('pointerleave', () => { tip.classList.remove('on'); $$('.colhit', box).forEach((c) => c.classList.remove('on')); });
    let cur = data.length;
    box.onkeydown = (e) => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); cur = Math.max(0, Math.min(data.length - 1, cur + (e.key === 'ArrowRight' ? 1 : -1))); show(cur, $$('.colhit', box)[cur]); } };
    box.onblur = () => { tip.classList.remove('on'); $$('.colhit', box).forEach((c) => c.classList.remove('on')); };
  }
  function gauge(p, { size = 96, stroke = 8, status = 'OK', read = '', d = 0, animate = true, pace = null }) {
    const r = (size - stroke) / 2, c = 2 * Math.PI * r, arc = c * 0.75;
    const pp = Math.min(p, 100) / 100;
    const off = arc * (1 - pp);
    const col = { OK: 'var(--pos)', WARNING: 'var(--warn)', EXCEEDED: 'var(--crit)', ACC: 'var(--accent)' }[status];
    const ticks = Array.from({ length: 11 }, (_, i) => { const a = (135 + i * 27) * Math.PI / 180; const r1 = r + stroke / 2 + 2, r2 = r1 + (i % 5 ? 3 : 6); return `<line x1="${size / 2 + Math.cos(a) * r1}" y1="${size / 2 + Math.sin(a) * r1}" x2="${size / 2 + Math.cos(a) * r2}" y2="${size / 2 + Math.sin(a) * r2}"/>`; }).join('');
    let paceMark = '';
    if (pace != null) { const a = (135 + Math.min(pace, 100) * 2.7) * Math.PI / 180; const r1 = r - stroke / 2 - 2, r2 = r + stroke / 2 + 2; paceMark = `<line class="tick" x1="${size / 2 + Math.cos(a) * r1}" y1="${size / 2 + Math.sin(a) * r1}" x2="${size / 2 + Math.cos(a) * r2}" y2="${size / 2 + Math.sin(a) * r2}"/>`; }
    return `<div class="gauge" style="width:${size}px;height:${size}px;--gc:${col}"><svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
      <g class="ticks">${ticks}</g>
      <circle class="trk" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}" stroke-dasharray="${arc} ${c}" transform="rotate(135 ${size / 2} ${size / 2})"/>
      <circle class="val" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}" stroke-dasharray="${arc} ${c}" stroke-dashoffset="${off}" transform="rotate(135 ${size / 2} ${size / 2})" ${animate ? `data-a="arc" data-from="${arc}" data-d="${d}"` : ''}/>
      ${paceMark}</svg><div class="read">${read}</div></div>`;
  }
  const meter = (p, cls, pace, d = 0) => `<div class="meter ${cls}" style="--p:${Math.min(100, p).toFixed(1)}%" role="img" aria-label="${pct(p)} used${pace != null ? `, ${pct(pace)} of period elapsed` : ''}"><div class="trk"></div><div class="fil" data-a="clipx" data-d="${d}" data-dur="1000"></div>${pace != null ? `<span class="pace" style="--x:${Math.min(100, pace)}%" title="Period elapsed ${pct(pace)}"></span>` : ''}</div>`;

  /* ---------------- page header ---------------- */
  const pageHead = (idx, title, sub, actions, extra = '') => `<header class="phead"><div><div class="crumb"><span class="micro">${idx} / ${up(title)}</span><span class="micro">${sub}</span>${extra}</div><h1>${title}<span class="cur" aria-hidden="true"></span></h1></div><div class="actions">${actions}</div></header>`;
  const quickActions = () => `<button class="btn" data-act="import">${ic('upload')}Import</button><button class="btn" data-act="transfer">${ic('transfer')}Transfer</button><button class="btn btn-primary" data-act="add">${ic('plus')}Add transaction <kbd aria-hidden="true">N</kbd></button>`;
  function wireQuick(scope) {
    $$('[data-act]', scope).forEach((b) => b.addEventListener('click', () => ({ add: () => forms.addTx(), transfer: () => forms.transfer(), import: forms.importCsv, account: () => forms.account(), connect: forms.connect, budget: () => forms.budget() })[b.dataset.act]()));
  }
  const asOf = `As of ${dRange('2026-09-25')}`;
  // flip between the two transactions layouts (keeps theme/state params)
  const layoutToggle = (which) => {
    const qs = new URLSearchParams(location.search); qs.delete('open'); qs.delete('menu'); qs.delete('filters');
    const q = qs.toString() ? `?${qs}` : '';
    const opt = (k, href, label) => k === which ? `<a href="${href}${q}" aria-current="page">${label}</a>` : `<a href="${href}${q}">${label}</a>`;
    return `<nav class="layout-tog" aria-label="Transactions layout"><span>Layout:</span>${opt('terminal', 'transactions.html', 'Terminal')}${opt('rail', 'transactions-layout-d.html', 'Filter rail')}</nav>`;
  };

  /* =====================================================================
     DASHBOARD
     ===================================================================== */
  function dashboard(pg) {
    const first = M.netWorthHistory[0], delta = M.netWorth - first, dp = (delta / first) * 100;
    const byType = TYPES.map((t) => ({ ...t, accts: M.accounts.filter((a) => a.account_type === t.k) })).filter((t) => t.accts.length).map((t) => ({ ...t, total: t.accts.reduce((s, a) => s + M.toEur(a), 0) }));
    const bs = M.budgets.map((b) => ({ b, s: budStats(b) })).sort((x, y) => y.s.p - x.s.p).slice(0, 4);
    const spendTotal = M.categoryBreakdown.reduce((s, c) => s + c.total, 0);
    const top = M.categoryBreakdown.filter((c) => c.category_id !== 'other').slice(0, 5);
    const owed = M.people.reduce((s, p) => s + p.owes_me, 0), owe = M.people.reduce((s, p) => s + p.i_owe, 0);
    const maxDebt = Math.max(...M.people.map((p) => Math.max(p.owes_me, p.i_owe)));
    const recent = M.transactions.slice(0, 8);
    const linked = M.accounts.filter((a) => a.provider);

    pg.innerHTML = `
${pageHead('01', 'Dashboard', asOf, quickActions())}
<div class="grid">
  <section class="panel s-8 scan xh pwr-me" aria-labelledby="h-nw">
    <div class="ph"><h2 id="h-nw">Net worth</h2><div class="meta"><span class="micro">EUR base, 12M</span>${nb()}</div></div>
    <div class="pb">
      <div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:flex-end;gap:16px 24px">
        <div>
          <div class="kicker">Total net worth</div>
          <div class="hero-fig" style="margin-top:10px">${rollHTML(M.netWorth)}</div>
          <div style="display:flex;gap:14px;align-items:center;margin-top:12px;flex-wrap:wrap">
            <span class="delta ${delta >= 0 ? 'up' : 'down'}">${ic(delta >= 0 ? 'tri_up' : 'tri_dn')}<span>${delta >= 0 ? 'Up' : 'Down'} ${esc(eur(Math.abs(delta)))}</span><span>${delta >= 0 ? '+' : ''}${dp.toFixed(1)}%</span></span>
            <span class="micro">since ${up(M.monthly[0].m)} 2025</span>
          </div>
        </div>
        <dl class="stats" style="min-width:min(100%,360px)">
          <div class="stat"><dt>Assets</dt><dd class="fig-m" data-count="${assets}">${esc(eur(assets))}</dd></div>
          <div class="stat"><dt>Liabilities</dt><dd class="fig-m amt liab" data-count="${liabs}">${esc(eur(liabs))}</dd></div>
        </dl>
      </div>
      <figure style="margin:18px 0 0">
        <div class="chart" id="c-nw" tabindex="0" aria-label="Net worth history chart. Use left and right arrow keys to read months."></div>
        <figcaption class="sr-only">Net worth, illustrative history: ${M.netWorthHistory.map((v, i) => `${M.monthly[i].m} ${eur(v)}`).join(', ')}.</figcaption>
      </figure>
    </div>
  </section>

  <section class="panel s-4 pwr-me" aria-labelledby="h-bs">
    <div class="ph"><h2 id="h-bs">Balance sheet</h2><a class="btn btn-sm btn-ghost" href="accounts.html">Accounts</a></div>
    <div class="pb">
      <div class="tape-wrap" data-a="clipx" data-dur="900" role="img" aria-label="Assets ${eur(assets)}, liabilities ${eur(Math.abs(liabs))}">
        <div class="tape" style="height:14px"><span style="flex:${assets};--c:var(--ink-2)"></span><span style="flex:${-liabs};--c:var(--crit)"></span></div>
      </div>
      <div class="legend" style="margin:10px 0 14px"><span><i style="background:var(--ink-2)"></i>Assets ${pct((assets / (assets - liabs)) * 100)}</span><span><i style="background:var(--crit)"></i>Liabilities ${pct((-liabs / (assets - liabs)) * 100)}</span></div>
      <dl class="kv">
        ${byType.map((t) => `<dt>${t.liab ? `<span class="tag crit">${ic('warn')}Liability</span>` : `<span class="tag neutral">${t.c}</span>`}<span>${t.n}</span><span class="ink3">${t.accts.length}</span></dt><dd>${amt(t.total, 'EUR', { liab: t.liab })}</dd>`).join('')}
        <dt><b style="color:var(--ink)">NET</b></dt><dd><b class="amt">${esc(eur(M.netWorth))}</b></dd>
      </dl>
    </div>
  </section>
</div>

<div class="grid">
  <section class="panel s-8 pwr-me" aria-labelledby="h-ivs">
    <div class="ph"><h2 id="h-ivs">Income vs spend</h2><div class="meta"><div class="legend"><span><i style="background:var(--viz-income)"></i>Income</span><span><i style="background:var(--viz-spend)"></i>Spend</span></div>${nb()}</div></div>
    <div class="pb">
      <dl class="stats" style="margin:-14px -14px 14px;border-bottom:1px solid var(--line)">
        <div class="stat"><dt>Sep income</dt><dd class="fig-m amt in" data-count="${monthNow.income}" data-fmt="signed">${esc(signed(monthNow.income))}</dd></div>
        <div class="stat"><dt>Sep spend</dt><dd class="fig-m" data-count="${-monthNow.spend}" data-fmt="signed">${esc(signed(-monthNow.spend))}</dd></div>
        <div class="stat"><dt>12M avg spend</dt><dd class="fig-m" data-count="${M.monthly.reduce((s, m) => s + m.spend, 0) / 12}">${esc(eur(M.monthly.reduce((s, m) => s + m.spend, 0) / 12))}</dd></div>
        <div class="stat"><dt>Savings rate</dt><dd class="fig-m" data-count="${((monthNow.income - monthNow.spend) / monthNow.income) * 100}" data-fmt="pct">${pct(((monthNow.income - monthNow.spend) / monthNow.income) * 100)}</dd></div>
      </dl>
      <figure style="margin:0"><div class="chart" id="c-ivs" tabindex="0" aria-label="Income and spend by month. Use arrow keys to read months."></div>
      <figcaption class="sr-only">Income and spend by month: ${M.monthly.map((m) => `${m.m} income ${eur(m.income)}, spend ${eur(m.spend)}`).join('; ')}.</figcaption></figure>
    </div>
  </section>

  <section class="panel s-4 pwr-me" aria-labelledby="h-bud">
    <div class="ph"><h2 id="h-bud">Budgets</h2><a class="btn btn-sm btn-ghost" href="budgets.html">All ${M.budgets.length}</a></div>
    <div class="pb" style="display:grid;gap:16px">
      ${bs.map(({ b, s }, i) => `<div>
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px">
          <span style="font:600 13px/1.2 var(--mono);text-transform:uppercase;letter-spacing:.04em">${esc(b.name)}</span>${statusTag(s.status)}</div>
        ${meter(s.p, ST[s.status].cls, s.ePct, i * 90)}
        <div style="display:flex;justify-content:space-between;margin-top:8px" class="micro"><span><span class="amt" style="color:var(--ink)">${esc(eur(b.spent))}</span> of ${esc(eur(b.limit))}</span><span style="color:var(--ink-2)">${pct(s.p)} / ${s.left}D LEFT</span></div>
      </div>`).join('')}
      <p class="micro" style="margin:0;display:flex;align-items:center;gap:6px"><span style="display:inline-block;width:2px;height:12px;background:var(--ink)"></span>Tick marks time elapsed in the period</p>
    </div>
  </section>
</div>

<div class="grid">
  <section class="panel s-5 pwr-me" aria-labelledby="h-cat">
    <div class="ph"><h2 id="h-cat">Spend by category</h2><span class="micro">Sep 2026</span></div>
    <div class="pb">
      <div class="kicker">Total spend</div>
      <div class="fig-l" style="margin:8px 0 14px" data-count="${spendTotal}">${esc(eur(spendTotal))}</div>
      <div class="tape-wrap" data-a="clipx" data-dur="1100" role="img" aria-label="Spend split by category, listed below"><div class="tape">${M.categoryBreakdown.map((c) => `<span style="flex:${c.total};--c:${catOf(c.category_id).color}"></span>`).join('')}</div></div>
      <table class="tbl" style="margin-top:10px"><caption class="sr-only">Spend by category, September</caption>
        <thead><tr><th scope="col" style="padding-left:0">Category</th><th scope="col" class="r">Share</th><th scope="col" class="r" style="padding-right:0">Amount</th></tr></thead>
        <tbody>${M.categoryBreakdown.map((c) => { const k = catOf(c.category_id); return `<tr><td style="padding-left:0"><span style="display:inline-flex;gap:8px;align-items:center"><span class="sw" style="--c:${k.color}"></span>${esc(k.name)}</span></td><td class="r n ink2">${pct(c.percentage, 1)}</td><td class="r n" style="padding-right:0">${esc(eur(c.total))}</td></tr>`; }).join('')}</tbody>
      </table>
    </div>
  </section>

  <section class="panel s-3 pwr-me" aria-labelledby="h-top">
    <div class="ph"><h2 id="h-top">Top spend</h2><span class="micro">Sep</span></div>
    <div class="pb">
      <ol class="bars" style="list-style:none;margin:0;padding:0">
        ${top.map((c, i) => { const k = catOf(c.category_id); return `<li class="barrow"><span class="rk">${String(i + 1).padStart(2, '0')}</span><span class="nm">${esc(k.name)}</span><span class="amt" style="font-size:12px">${esc(eur(c.total))}</span><span class="bar" aria-hidden="true"><i style="--w:${c.total / top[0].total}" data-a="scalex" data-d="${i * 70}" data-dur="800"></i></span></li>`; }).join('')}
      </ol>
      <div style="margin-top:18px;padding-top:12px;border-top:1px solid var(--line)" class="micro">Rent is ${pct(top[0].percentage, 1)} of all spend</div>
    </div>
  </section>

  <section class="panel s-4 pwr-me" aria-labelledby="h-debt">
    <div class="ph"><h2 id="h-debt">Debts</h2><span class="micro">${M.people.length} people</span></div>
    <div class="pb">
      <dl class="stats" style="margin:-14px -14px 14px;border-bottom:1px solid var(--line)">
        <div class="stat"><dt>${ic('tri_up')}Owed to you</dt><dd class="fig-m amt in" data-count="${owed}" data-fmt="signed">${esc(signed(owed))}</dd></div>
        <div class="stat"><dt>${ic('tri_dn')}You owe</dt><dd class="fig-m" data-count="${-owe}" data-fmt="signed">${esc(signed(-owe))}</dd></div>
      </dl>
      <ul style="list-style:none;margin:0;padding:0;display:grid;gap:12px">
        ${M.people.map((p, i) => { const v = p.owes_me - p.i_owe; return `<li style="display:grid;grid-template-columns:32px minmax(0,1fr) auto;gap:4px 10px;align-items:center">
          <span class="avatar" style="width:28px;height:28px;font-size:11px" aria-hidden="true">${esc(p.name[0])}</span>
          <span><b style="font:600 13px var(--mono)">${esc(p.name)}</b> <span class="micro">${v >= 0 ? 'owes you' : 'you owe'}</span></span>
          ${amt(v)}
          <span style="grid-column:2/4;display:grid;grid-template-columns:1fr 1fr;gap:2px;height:6px" aria-hidden="true">
            <span style="background:var(--line);position:relative">${v < 0 ? `<i style="position:absolute;inset:0;background:var(--ink-2);transform-origin:right;transform:scaleX(${-v / maxDebt})" data-a="scalex" data-d="${i * 80}"></i>` : ''}</span>
            <span style="background:var(--line);position:relative">${v > 0 ? `<i style="position:absolute;inset:0;background:var(--pos);transform-origin:left;transform:scaleX(${v / maxDebt})" data-a="scalex" data-d="${i * 80}"></i>` : ''}</span>
          </span></li>`; }).join('')}
      </ul>
      <p class="micro" style="margin:14px 0 0">Left: you owe. Right: owed to you.</p>
    </div>
  </section>
</div>

<div class="grid">
  <section class="panel s-8 pwr-me" aria-labelledby="h-rec">
    <div class="ph"><h2 id="h-rec">Recent activity</h2><a class="btn btn-sm btn-ghost" href="transactions.html">View all ${TOTAL_TX}</a></div>
    <div style="overflow-x:auto">
    <table class="tbl"><caption class="sr-only">Eight most recent transactions</caption>
      <thead><tr><th scope="col">Date</th><th scope="col">Title</th><th scope="col">Category</th><th scope="col">Account</th><th scope="col" class="r">Amount</th></tr></thead>
      <tbody>${recent.map((t) => `<tr class="clk" data-href="transactions.html?open=${t.id}"><td class="n ink2" style="white-space:nowrap;font-size:12px">${dShort(t.date).replace(/^\w+ /, '')}</td><td><a href="transactions.html?open=${t.id}" style="text-decoration:none;font-weight:600">${esc(t.title)}</a><div class="badges" style="display:flex;gap:4px;flex-wrap:wrap;margin-top:4px">${txBadges(t)}</div></td><td>${catChip(t.category_id, { transfer: !!t.transfer })}</td><td class="ink2" style="font-size:12px;white-space:nowrap">${esc(M.acct(t.account_id).name)}</td><td class="r">${txAmountCell(t)}</td></tr>`).join('')}</tbody>
    </table></div>
  </section>

  <section class="panel s-4 pwr-me" aria-labelledby="h-link">
    <div class="ph"><h2 id="h-link">Provider links</h2><span class="micro">${linked.length} linked</span></div>
    <ul style="list-style:none;margin:0;padding:0">
      ${linked.map((a) => `<li style="display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px 10px;align-items:center;padding:12px 14px;border-bottom:1px solid var(--line)">
        <span style="font:600 13px/1.2 var(--mono)">${esc(a.name)}</span>
        <button class="btn btn-sm" data-sync="${a.id}">${ic('sync')}<span>Sync now</span></button>
        <span class="micro" data-sync-st="${a.id}" style="display:flex;gap:6px;align-items:center"><i style="width:7px;height:7px;background:var(--pos);display:inline-block"></i>${esc(up(a.provider))}, synced ${esc(a.synced)}</span>
      </li>`).join('')}
    </ul>
    <div class="pb">
      <div class="kicker" style="margin-bottom:8px">FX rates to EUR</div>
      <dl class="kv">${Object.entries(M.fx).filter(([c]) => c !== 'EUR').map(([c, r]) => `<dt>${c}/EUR</dt><dd class="num">${r.toFixed(4)}</dd>`).join('')}</dl>
    </div>
  </section>
</div>`;
    const draw = (anim) => {
      lineChart($('#c-nw'), { values: M.netWorthHistory, labels: M.monthly.map((m) => m.m), height: innerWidth < 760 ? 170 : 210, animate: anim });
      barsChart($('#c-ivs'), { data: M.monthly, height: innerWidth < 760 ? 170 : 200, animate: anim });
    };
    draw(true);
    onResize(() => draw(false));
    $$('tr.clk', pg).forEach((tr) => tr.addEventListener('click', (e) => { if (!e.target.closest('a,button')) location.href = tr.dataset.href; }));
    wireSync(pg);
  }

  function wireSync(scope) {
    $$('[data-sync]', scope).forEach((b) => b.addEventListener('click', () => {
      if (b.dataset.busy) return; b.dataset.busy = '1';
      const id = b.dataset.sync, a = M.acct(id), st = $(`[data-sync-st="${id}"]`, scope);
      b.querySelector('span').textContent = 'Syncing'; b.querySelector('span').classList.add('cursor-blink'); b.setAttribute('aria-busy', 'true');
      const phases = ['Handshake', 'Fetching transactions', 'Reconciling'];
      phases.forEach((p, i) => setTimeout(() => { st.innerHTML = `<i style="width:7px;height:7px;background:var(--warn);display:inline-block"></i>${up(a.provider)}, ${p}<span class="cursor-blink" aria-hidden="true"></span>`; }, i * 600));
      live(`Syncing ${a.name}`);
      setTimeout(() => {
        st.innerHTML = `<i style="width:7px;height:7px;background:var(--pos);display:inline-block"></i>${esc(up(a.provider))}, synced just now`;
        b.querySelector('span').textContent = 'Sync now'; b.querySelector('span').classList.remove('cursor-blink'); b.removeAttribute('aria-busy'); delete b.dataset.busy;
        live(`${a.name} synced, 0 new transactions`);
      }, phases.length * 600 + 300);
    }));
  }

  /* =====================================================================
     TRANSACTIONS
     ===================================================================== */
  function transactions(pg) {
    const st = {
      list: M.transactions.map((t) => ({ ...t })), sel: new Set(), month: 8, // index into monthly (Sep)
      view: params.get('state') || 'data', f: { q: '', acct: '', cat: '', person: '', from: '', to: '', min: '', max: '', sign: 'all', splits: false, transfer: false },
      filtersOpen: innerWidth > 760,
    };
    const persons = M.people.map((p) => p.name);
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const mData = (mi) => M.monthly.find((m) => m.m === MONTHS[mi]);

    pg.innerHTML = `
${pageHead('02', 'Transactions', asOf, quickActions(), layoutToggle('terminal'))}
<div class="monthbar pwr-me" style="position:relative">
  <div class="monthnav"><button class="btn btn-icon" id="m-prev" aria-label="Previous month">${ic('chevL')}</button>
    <div class="m" aria-live="polite"><b id="m-label"></b><span id="m-sub"></span></div>
    <button class="btn btn-icon" id="m-next" aria-label="Next month">${ic('chevR')}</button></div>
  <dl class="stats" id="m-stats"></dl>
</div>
<div class="toolbar">
  <div class="field search"><label for="q">Search title and notes</label><div style="position:relative">${ic('search')}<input class="input" id="q" type="search" autocomplete="off"></div></div>
  <div class="right">
    <div class="field"><span class="lbl" id="sign-l">Direction</span><div class="seg" role="group" aria-labelledby="sign-l" id="sign">${['all', 'in', 'out'].map((s) => `<button type="button" data-s="${s}" aria-pressed="${s === 'all'}">${s === 'all' ? 'All' : s === 'in' ? 'Money in' : 'Money out'}</button>`).join('')}</div></div>
    <button class="btn" id="f-toggle" aria-expanded="false" aria-controls="filters" style="height:36px">${ic('filter')}Filters <span id="f-count"></span></button>
  </div>
</div>
<div class="filters" id="filters">
  <div class="field"><label for="f-acct">Account</label><select class="input" id="f-acct"><option value="">All accounts</option>${M.accounts.map((a) => `<option value="${a.id}">${esc(a.name)}</option>`).join('')}</select></div>
  <div class="field"><label for="f-cat">Category</label><select class="input" id="f-cat"><option value="">All categories</option>${M.categories.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></div>
  <div class="field"><label for="f-person">Person</label><select class="input" id="f-person"><option value="">Anyone</option>${persons.map((p) => `<option>${p}</option>`).join('')}</select></div>
  <div class="field"><label for="f-from">From date</label><input class="input" type="date" id="f-from"></div>
  <div class="field"><label for="f-to">To date</label><input class="input" type="date" id="f-to"></div>
  <div class="field"><span class="lbl">Amount range (EUR)</span><div style="display:grid;grid-template-columns:1fr 1fr;gap:6px"><input class="input" id="f-min" type="number" aria-label="Minimum amount" placeholder="Min"><input class="input" id="f-max" type="number" aria-label="Maximum amount" placeholder="Max"></div></div>
  <div class="rowx" style="grid-column:1/-1;justify-content:space-between">
    <div class="rowx"><label class="check"><input type="checkbox" id="f-splits">Has splits</label><label class="check"><input type="checkbox" id="f-transfer">In transfer</label></div>
    <div class="rowx"><span class="micro" id="mock-l">Mock state</span><div class="seg" role="group" aria-labelledby="mock-l" id="view">${['data', 'loading', 'empty', 'error'].map((v) => `<button type="button" data-v="${v}" aria-pressed="${v === st.view}">${v}</button>`).join('')}</div><button class="btn btn-ghost" id="f-clear">Clear filters</button></div>
  </div>
</div>
<div class="chips" id="chips" aria-live="polite"></div>
<div id="list"></div>
<div class="bulkbar" id="bulk" role="region" aria-label="Bulk actions"><span id="bulk-n"></span><button class="btn btn-sm" id="b-cat">${ic('tag')}Categorize</button><button class="btn btn-sm btn-danger" id="b-del">${ic('trash')}Delete</button><button class="btn btn-sm btn-icon" id="b-clr" aria-label="Clear selection">${ic('close')}</button></div>`;

    const fEl = $('#filters');
    const setFiltersOpen = (o) => { st.filtersOpen = o; fEl.hidden = !o; $('#f-toggle').setAttribute('aria-expanded', String(o)); };
    setFiltersOpen(st.filtersOpen);
    $('#f-toggle').addEventListener('click', () => setFiltersOpen(!st.filtersOpen));

    function renderMonth() {
      const m = mData(st.month) || { income: 0, spend: 0 };
      $('#m-label').textContent = `${up(MONTHS[st.month])} 2026`;
      $('#m-sub').textContent = st.month === 8 ? 'CURRENT MONTH' : 'MOCK: NO ROWS LOADED';
      const n = m.income - m.spend;
      $('#m-stats').innerHTML = `
        <div class="stat"><dt>${ic('tri_up')}Income</dt><dd class="fig-m amt in" data-count="${m.income}" data-fmt="signed">${esc(signed(m.income))}</dd></div>
        <div class="stat"><dt>${ic('tri_dn')}Spend</dt><dd class="fig-m" data-count="${-m.spend}" data-fmt="signed">${esc(signed(-m.spend))}</dd></div>
        <div class="stat"><dt>Net</dt><dd class="fig-m ${n >= 0 ? 'amt in' : ''}" data-count="${n}" data-fmt="signed">${esc(signed(n))}</dd></div>
        <div class="stat"><dt>Spend of income</dt><dd><span class="fig-m">${m.income ? pct((m.spend / m.income) * 100) : 'n/a'}</span>${meter(m.income ? (m.spend / m.income) * 100 : 0, 'accent', null, 0)}</dd></div>`;
      $('#m-prev').disabled = st.month <= 0; $('#m-next').disabled = st.month >= 8;
    }
    const activeFilters = () => {
      const f = st.f, out = [];
      if (f.acct) out.push(['acct', `Account: ${M.acct(f.acct).name}`]);
      if (f.cat) out.push(['cat', `Category: ${M.cat(f.cat).name}`]);
      if (f.person) out.push(['person', `Person: ${f.person}`]);
      if (f.from) out.push(['from', `From ${f.from}`]);
      if (f.to) out.push(['to', `To ${f.to}`]);
      if (f.min) out.push(['min', `Min ${eur(+f.min)}`]);
      if (f.max) out.push(['max', `Max ${eur(+f.max)}`]);
      if (f.sign !== 'all') out.push(['sign', f.sign === 'in' ? 'Money in' : 'Money out']);
      if (f.splits) out.push(['splits', 'Has splits']);
      if (f.transfer) out.push(['transfer', 'In transfer']);
      if (f.q) out.push(['q', `Search: ${f.q}`]);
      return out;
    };
    const match = (t) => {
      const f = st.f, e = Math.abs(txEur(t));
      if (f.q && !(`${t.title} ${t.notes || ''}`.toLowerCase().includes(f.q.toLowerCase()))) return false;
      if (f.acct && t.account_id !== f.acct) return false;
      if (f.cat && t.category_id !== f.cat) return false;
      if (f.person && !((t.splits || []).some((s) => s.person === f.person) || t.debt?.paidBy === f.person || t.title.includes(f.person))) return false;
      if (f.from && t.date < f.from) return false;
      if (f.to && t.date > f.to) return false;
      if (f.min && e < +f.min) return false;
      if (f.max && e > +f.max) return false;
      if (f.sign === 'in' && t.amount <= 0) return false;
      if (f.sign === 'out' && t.amount >= 0) return false;
      if (f.splits && !(t.splits || []).length) return false;
      if (f.transfer && !t.transfer) return false;
      return true;
    };
    const head = () => `<div class="tx-head" role="presentation"><span><input type="checkbox" id="sel-all" aria-label="Select all visible"></span><span>Title</span><span>Category</span><span>Account</span><span class="r">Amount</span><span></span></div>`;
    const skelRows = (n) => Array.from({ length: n }, (_, i) => `<div class="tx-row skel-row" aria-hidden="true"><span class="skel" style="width:16px;height:16px"></span><span><span class="skel" style="width:${50 + (i * 17) % 40}%"></span><span class="skel" style="width:30%;margin-top:8px;height:8px"></span></span><span class="skel catc" style="width:70%"></span><span class="skel acct" style="width:60%"></span><span class="skel amtc" style="width:70px;justify-self:end"></span><span></span></div>`).join('');

    function renderList(anim) {
      const box = $('#list');
      const chips = activeFilters();
      $('#f-count').textContent = chips.length ? `(${chips.length})` : '';
      $('#chips').innerHTML = chips.length ? chips.map(([k, l]) => `<span class="chip">${esc(l)}<button data-k="${k}" aria-label="Remove filter ${esc(l)}">${ic('close')}</button></span>`).join('') + `<span class="micro">${chips.length} active</span>` : `<span class="micro">No filters. Showing everything loaded for the month.</span>`;
      $$('#chips button').forEach((b) => b.addEventListener('click', () => { clearOne(b.dataset.k); }));

      if (st.view === 'loading') { box.innerHTML = `<div class="tx" aria-busy="true" aria-label="Loading transactions">${head()}<div class="day"><span class="skel" style="width:120px"></span></div>${skelRows(7)}</div>`; return; }
      if (st.view === 'error') { box.innerHTML = `<div class="tx"><div class="state-box err" role="alert"><span class="state-glyph" aria-hidden="true">ERR 503 / LEDGER LINK LOST</span><h3>Could not load transactions</h3><p>The server did not answer in time. Your data is safe; nothing was changed.</p><button class="btn btn-primary" id="retry">${ic('sync')}Retry</button></div></div>`; $('#retry').onclick = () => { st.view = 'loading'; syncView(); renderList(); setTimeout(() => { st.view = 'data'; syncView(); renderList(); }, 900); }; return; }
      const rows = st.month === 8 && st.view === 'data' ? st.list.filter(match) : [];
      if (!rows.length) {
        const filtered = chips.length && st.month === 8 && st.view === 'data';
        box.innerHTML = `<div class="tx"><div class="state-box"><span class="state-glyph" aria-hidden="true">[ 0 RECORDS ]</span><h3>${filtered ? 'Nothing matches' : 'No transactions yet'}</h3><p>${filtered ? 'No loaded transactions match these filters. Try widening the amount range or clearing a filter.' : 'Nothing recorded for this month. Add one, or import a CSV from your bank.'}</p><div style="display:flex;gap:8px">${filtered ? '<button class="btn" id="e-clear">Clear filters</button>' : `<button class="btn" data-act="import">${ic('upload')}Import CSV</button><button class="btn btn-primary" data-act="add">${ic('plus')}Add transaction</button>`}</div></div></div>`;
        $('#e-clear') && ($('#e-clear').onclick = clearAll); wireQuick(box);
        return;
      }
      const groups = {};
      rows.forEach((t) => (groups[t.date] = groups[t.date] || []).push(t));
      let i = 0;
      box.innerHTML = `<div class="tx" role="list" aria-label="Transactions grouped by day">${head()}${Object.entries(groups).map(([d, ts]) => {
        const sub = ts.reduce((s, t) => s + txEur(t), 0);
        return `<div class="day" role="presentation"><span>${dShort(d)}</span><span class="sub"><span>${ts.length} TXN</span>${amt(sub)}</span></div>` + ts.map((t) => {
          const k = i++;
          return `<div class="tx-row ${st.sel.has(t.id) ? 'sel' : ''} ${anim ? 'rise' : ''}" style="--i:${Math.min(k, 14)};--boot:${BOOT_MS + 200}ms" data-id="${t.id}" role="listitem">
            <span class="cb"><input type="checkbox" aria-label="Select ${esc(t.title)}" ${st.sel.has(t.id) ? 'checked' : ''} data-sel="${t.id}"></span>
            <div class="ttl"><button class="open" data-open="${t.id}">${esc(t.title)}</button>${txBadges(t) ? `<div class="badges">${txBadges(t)}</div>` : ''}</div>
            <span class="catc">${catChip(t.category_id, { transfer: !!t.transfer })}</span>
            <span class="acct">${esc(M.acct(t.account_id).name)}</span>
            <span class="amtc r">${txAmountCell(t)}</span>
            <button class="btn btn-sm btn-icon btn-ghost kebab" aria-label="Actions for ${esc(t.title)}" aria-haspopup="menu" aria-expanded="false" data-menu="${t.id}">${ic('more')}</button>
          </div>`;
        }).join('');
      }).join('')}
      <div class="tx-foot" role="presentation"><span>Showing <b>${rows.length}</b> of <b>${chips.length ? rows.length : TOTAL_TX}</b>${chips.length ? ' matching in loaded rows' : ''}</span><span id="sentinel">${chips.length ? '' : 'Scroll to load more'}</span></div>
      <div id="more-rows" role="presentation"></div></div>`;
      wireRows();
      if (!chips.length) watchSentinel();
    }
    let loadedMore = false;
    function watchSentinel() {
      const s = $('#sentinel'); if (!s || loadedMore) return;
      const io = new IntersectionObserver((es) => {
        if (!es[0].isIntersecting) return; io.disconnect(); loadedMore = true;
        const mr = $('#more-rows'); mr.innerHTML = skelRows(3); s.textContent = 'Loading next page'; s.classList.add('cursor-blink');
        setTimeout(() => { mr.innerHTML = ''; s.classList.remove('cursor-blink'); s.textContent = `End of mock data, ${TOTAL_TX - st.list.length} more on the server`; }, 1400);
      }, { rootMargin: '0px 0px -40px 0px' });
      io.observe(s);
    }
    function updateBulk() {
      const n = st.sel.size; $('#bulk').classList.toggle('on', n > 0); $('#bulk-n').textContent = `${n} selected`;
      const all = $('#sel-all'); if (all) { const vis = $$('[data-sel]'); const c = vis.filter((v) => v.checked).length; all.checked = c && c === vis.length; all.indeterminate = c > 0 && c < vis.length; }
    }
    function removeTx(ids) {
      const removed = st.list.filter((t) => ids.includes(t.id));
      const rowsEls = ids.map((id) => $(`.tx-row[data-id="${id}"]`)).filter(Boolean);
      rowsEls.forEach((r) => r.classList.add('leaving'));
      setTimeout(() => {
        st.list = st.list.filter((t) => !ids.includes(t.id)); ids.forEach((id) => st.sel.delete(id)); renderList(); updateBulk();
      }, RM ? 0 : 200);
      toast(removed.length > 1 ? `${removed.length} transactions moved to Trash` : `${removed[0].title} moved to Trash`, 'Kept for 30 days, then purged', () => {
        st.list = M.transactions.filter((t) => st.list.some((x) => x.id === t.id) || ids.includes(t.id)).map((t) => st.list.find((x) => x.id === t.id) || { ...t });
        renderList(); ids.forEach((id) => $(`.tx-row[data-id="${id}"]`)?.classList.add('flash'));
      });
    }
    function duplicate(t) {
      const c = { ...t, id: t.id + '-copy' + Math.floor(Math.random() * 999), title: t.title + ' (copy)' };
      const at = st.list.findIndex((x) => x.id === t.id); st.list.splice(at + 1, 0, c); renderList();
      $(`.tx-row[data-id="${c.id}"]`)?.classList.add('flash'); toast('Duplicated', c.title);
    }
    const txMenu = (t) => [
      { label: 'Open details', icon: 'note', act: () => openTx(t) },
      { label: 'Edit', icon: 'edit', act: () => forms.addTx(t) },
      { label: 'Duplicate', icon: 'copy', act: () => duplicate(t) },
      { label: 'Convert to transfer', icon: 'transfer', act: () => forms.transfer(t) },
      '-',
      { label: 'Delete', icon: 'trash', danger: true, act: () => removeTx([t.id]) },
    ];
    function wireRows() {
      $$('[data-open]').forEach((b) => b.addEventListener('click', () => openTx(st.list.find((t) => t.id === b.dataset.open), b)));
      $$('[data-menu]').forEach((b) => b.addEventListener('click', () => openMenu(b, txMenu(st.list.find((t) => t.id === b.dataset.menu)))));
      $$('[data-sel]').forEach((c) => c.addEventListener('change', () => { c.checked ? st.sel.add(c.dataset.sel) : st.sel.delete(c.dataset.sel); c.closest('.tx-row').classList.toggle('sel', c.checked); updateBulk(); }));
      const all = $('#sel-all'); all && all.addEventListener('change', () => { $$('[data-sel]').forEach((c) => { c.checked = all.checked; all.checked ? st.sel.add(c.dataset.sel) : st.sel.delete(c.dataset.sel); c.closest('.tx-row').classList.toggle('sel', all.checked); }); updateBulk(); });
      updateBulk();
    }
    function openTx(t, trigger) {
      const d = $('#drawer'); const cur = txCur(t); const a = M.acct(t.account_id); const c = catOf(t.category_id);
            d.innerHTML = `<div class="drawer-in">
        <div class="ph"><h2 id="drawer-title">Transaction</h2><div class="meta"><span class="micro">TXN/${up(t.id)}</span><button class="btn btn-sm btn-icon btn-ghost" data-close aria-label="Close details">${ic('close')}</button></div></div>
        <div class="drawer-body">
          <div style="--i:0;display:flex;justify-content:space-between;align-items:center;gap:8px">${catChip(t.category_id, { transfer: !!t.transfer })}<span class="micro">${dShort(t.date)}</span></div>
          <h3 style="--i:1;margin:14px 0 6px;font:800 30px/0.95 var(--sans);letter-spacing:-0.035em;text-transform:uppercase">${esc(t.title)}</h3>
          <div style="--i:2;margin:14px 0 16px;padding:14px;border:1px solid var(--line);background:var(--bg)"><div class="kicker">${t.amount < 0 ? 'Money out' : 'Money in'}</div><div class="fig-l" style="margin-top:8px">${amt(t.amount, cur)}</div>${cur !== 'EUR' ? `<span class="eq" style="margin-top:6px">approx. ${esc(signed(txEur(t)))} at ${fx(cur).toFixed(4)} ${cur}/EUR</span>` : ''}</div>
          ${txBadges(t) ? `<div style="--i:3;display:flex;gap:4px;flex-wrap:wrap;margin-bottom:16px">${txBadges(t)}</div>` : ''}
          <dl class="kv" style="--i:4;margin:0">
            <dt>Date</dt><dd>${esc(dLong(t.date))}</dd>
            <dt>Account</dt><dd>${esc(a.name)} <span class="ink3">${a.currency}</span></dd>
            <dt>Category</dt><dd>${c ? esc(c.name) : t.transfer ? 'Transfer' : 'Uncategorised'}</dd>
            ${t.transfer ? `<dt>Linked account</dt><dd>${esc(t.transfer.linked)}</dd>` : ''}
            ${t.recurring ? `<dt>Recurring</dt><dd>Monthly schedule</dd>` : ''}
            <dt>Notes</dt><dd>${t.notes ? esc(t.notes) : '<span class="ink3">None</span>'}</dd>
          </dl>
          ${t.splits ? `<div style="--i:5;margin-top:18px"><div class="kicker" style="margin-bottom:8px">Splits</div><table class="tbl" style="border:1px solid var(--line)"><thead><tr><th scope="col">Person</th><th scope="col" class="r">Share</th><th scope="col">Status</th></tr></thead><tbody>${t.splits.map((s) => `<tr><td>${esc(s.person)}</td><td class="r n">${esc(M.fmt(s.amount, txCur(t)))}</td><td><span class="tag ok">${ic('tri_up')}Owes you</span></td></tr>`).join('')}<tr><td>You</td><td class="r n">${esc(M.fmt(Math.abs(t.amount) - t.splits.reduce((s, x) => s + x.amount, 0), txCur(t)))}</td><td class="micro">Your share</td></tr></tbody></table></div>` : ''}
          ${t.debt ? `<div style="--i:5;margin-top:18px;padding:12px;border:1px solid var(--line)"><div class="kicker" style="margin-bottom:6px">Paid by someone else</div><p style="margin:0;font-size:13px">${esc(t.debt.paidBy)} paid ${esc(eur(t.debt.total))}. Your share of ${esc(eur(Math.abs(t.amount)))} is recorded as a debt you owe ${esc(t.debt.paidBy)}.</p></div>` : ''}
        </div>
        <div class="drawer-foot"><button class="btn btn-primary" data-d="edit">${ic('edit')}Edit</button><button class="btn" data-d="dup">${ic('copy')}Duplicate</button>${t.transfer ? '' : `<button class="btn" data-d="xfer">${ic('transfer')}Convert to transfer</button>`}<button class="btn btn-icon btn-danger" data-d="del" style="margin-left:auto" aria-label="Delete transaction" title="Delete">${ic('trash')}</button></div>
      </div>`;
      $$('[data-d]', d).forEach((b) => b.addEventListener('click', () => { const k = b.dataset.d; closeDlg(d); setTimeout(() => ({ edit: () => forms.addTx(t), dup: () => duplicate(t), xfer: () => forms.transfer(t), del: () => removeTx([t.id]) })[k](), RM ? 0 : 220); }));
      openDlg(d, trigger || document.activeElement);
    }
    function clearOne(k) {
      if (k === 'sign') { st.f.sign = 'all'; syncSign(); } else if (k === 'splits' || k === 'transfer') { st.f[k] = false; $('#f-' + k).checked = false; } else if (k === 'q') { st.f.q = ''; $('#q').value = ''; } else { st.f[k] = ''; $('#f-' + k).value = ''; }
      renderList();
    }
    function clearAll() { Object.keys(st.f).forEach((k) => (st.f[k] = typeof st.f[k] === 'boolean' ? false : k === 'sign' ? 'all' : '')); $$('#filters input, #filters select, #q').forEach((el) => (el.type === 'checkbox' ? (el.checked = false) : (el.value = ''))); syncSign(); renderList(); }
    const syncSign = () => $$('#sign button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.s === st.f.sign)));
    const syncView = () => $$('#view button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === st.view)));
    $('#q').addEventListener('input', (e) => { st.f.q = e.target.value.trim(); renderList(); });
    $$('#sign button').forEach((b) => b.addEventListener('click', () => { st.f.sign = b.dataset.s; syncSign(); renderList(); }));
    $$('#view button').forEach((b) => b.addEventListener('click', () => { st.view = b.dataset.v; syncView(); renderList(); }));
    ['acct', 'cat', 'person', 'from', 'to', 'min', 'max'].forEach((k) => $('#f-' + k).addEventListener('input', (e) => { st.f[k] = e.target.value; renderList(); }));
    ['splits', 'transfer'].forEach((k) => $('#f-' + k).addEventListener('change', (e) => { st.f[k] = e.target.checked; renderList(); }));
    $('#f-clear').addEventListener('click', clearAll);
    $('#m-prev').addEventListener('click', () => { st.month--; renderMonth(); renderList(); });
    $('#m-next').addEventListener('click', () => { st.month++; renderMonth(); renderList(); });
    $('#b-clr').addEventListener('click', () => { st.sel.clear(); renderList(); updateBulk(); });
    $('#b-del').addEventListener('click', () => removeTx([...st.sel]));
    $('#b-cat').addEventListener('click', () => openForm({ title: `Categorize ${st.sel.size}`, code: 'BULK', submit: 'Apply category', done: `${st.sel.size} transactions recategorized`, fields: [{ id: 'bc', label: 'Category', type: 'select', options: catOpts(), full: true }] }));
    renderMonth(); renderList(true);
    const open = params.get('open');
    if (open) { const t = st.list.find((x) => x.id === open); if (t) setTimeout(() => openTx(t), RM ? 0 : BOOT_MS + 700); }
    if (params.get('select')) { params.get('select').split(',').forEach((id) => st.sel.add(id)); renderList(); }
    if (params.get('menu')) setTimeout(() => { const b = $(`[data-menu="${params.get('menu')}"]`); b && b.click(); }, BOOT_MS + 1500);
  }

  /* =====================================================================
     TRANSACTIONS, FILTER RAIL LAYOUT (Direction D's arrangement, C's look)
     ===================================================================== */
  function transactionsD(pg) {
    const EMPTY_F = { q: '', acct: '', cat: '', person: '', from: '', to: '', min: '', max: '', sign: 'all', splits: false, transfer: false };
    const st = { list: M.transactions.map((t) => ({ ...t })), sel: new Set(), month: 8, view: params.get('state') || 'data', f: { ...EMPTY_F } };
    const persons = M.people.map((p) => p.name);
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const mData = (mi) => M.monthly.find((m) => m.m === MONTHS[mi]);
    const tileOf = (t) => { if (t.transfer) return { icon: 'transfer', color: 'var(--ink-3)', name: 'Transfer' }; const c = catOf(t.category_id); return c || { icon: 'other', color: 'var(--ink-3)', name: 'Uncategorised' }; };
    const tile = (t, cls = '') => { const k = tileOf(t); return `<span class="tile ${cls}" style="--c:${k.color}" aria-hidden="true">${ic(k.icon)}</span>`; };
    const nat = (t, n) => M.fmt(n, txCur(t));
    const seg = (id, lbl, opts, cur) => `<div class="field"><span class="lbl" id="${id}-l">${lbl}</span><div class="seg seg-full" role="group" aria-labelledby="${id}-l" id="${id}">${opts.map(([v, l]) => `<button type="button" data-v="${v}" aria-pressed="${v === cur}">${l}</button>`).join('')}</div></div>`;

    pg.innerHTML = `
${pageHead('02', 'Transactions', asOf, quickActions(), layoutToggle('rail'))}
<section class="monthbar scan pwr-me" aria-label="Month summary" style="position:relative">
  <div class="monthnav"><button class="btn btn-icon" id="m-prev" aria-label="Previous month">${ic('chevL')}</button>
    <div class="m" aria-live="polite"><b id="m-label"></b><span id="m-sub"></span></div>
    <button class="btn btn-icon" id="m-next" aria-label="Next month">${ic('chevR')}</button></div>
  <dl class="stats" id="m-stats"></dl>
</section>
<div class="rl">
  <section class="rail pwr-me" aria-labelledby="rl-h" id="rail">
    <div class="rail-in">
      <div class="ph"><h2 id="rl-h">Search and filter</h2><div class="meta"><span class="micro" id="f-n"></span><button class="btn btn-sm rail-toggle" id="f-toggle" aria-expanded="false" aria-controls="rail-body">${ic('filter')}<span>Filters</span><span id="f-count"></span></button></div></div>
      <div class="rail-pb">
        <div class="field search"><label for="q">Search title and notes</label><div style="position:relative">${ic('search')}<input class="input" id="q" type="search" autocomplete="off"></div></div>
        <div class="rail-body" id="rail-body">
          <div class="field"><label for="f-acct">Account</label><select class="input" id="f-acct"><option value="">All accounts</option>${M.accounts.map((a) => `<option value="${a.id}">${esc(a.name)}</option>`).join('')}</select></div>
          <div class="field"><label for="f-cat">Category</label><select class="input" id="f-cat"><option value="">All categories</option>${M.categories.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></div>
          <div class="field"><label for="f-person">Person</label><select class="input" id="f-person"><option value="">Anyone</option>${persons.map((p) => `<option>${p}</option>`).join('')}</select></div>
          <div class="two"><div class="field"><label for="f-from">From date</label><input class="input" type="date" id="f-from"></div><div class="field"><label for="f-to">To date</label><input class="input" type="date" id="f-to"></div></div>
          <div class="two"><div class="field"><label for="f-min">Min amount</label><input class="input" id="f-min" type="number" inputmode="decimal"></div><div class="field"><label for="f-max">Max amount</label><input class="input" id="f-max" type="number" inputmode="decimal"></div></div>
          ${seg('sign', 'Direction', [['all', 'All'], ['in', 'Money in'], ['out', 'Money out']], 'all')}
          <div class="sw-list">
            <label class="sw-row"><span>Has splits</span><input type="checkbox" role="switch" class="sw-in" id="f-splits"></label>
            <label class="sw-row"><span>In a transfer</span><input type="checkbox" role="switch" class="sw-in" id="f-transfer"></label>
          </div>
          <div class="rail-chips" id="chips" aria-live="polite"></div>
          <button class="btn btn-ghost rail-clear" id="f-clear" type="button">${ic('close')}Clear filters</button>
          <div class="rail-mock">${seg('view', 'Mock state (for review)', ['data', 'loading', 'empty', 'error'].map((v) => [v, v]), st.view)}</div>
        </div>
      </div>
    </div>
  </section>
  <section class="ledger pwr-me" aria-labelledby="lg-h">
    <div class="ph lg-top"><div class="meta"><span class="cb-all"><input type="checkbox" id="sel-all" aria-label="Select all shown"></span><h2 id="lg-h">Ledger</h2></div><span class="lg-count" id="l-count" role="status"></span></div>
    <div id="list"></div>
  </section>
</div>
<div class="bulkbar" id="bulk" role="region" aria-label="Bulk actions"><span id="bulk-n"></span><button class="btn btn-sm" id="b-cat">${ic('tag')}Categorize</button><button class="btn btn-sm btn-danger" id="b-del">${ic('trash')}Delete</button><button class="btn btn-sm btn-icon" id="b-clr" aria-label="Clear selection">${ic('close')}</button></div>`;

    const rail = $('#rail');
    const setRail = (o) => { rail.classList.toggle('open', o); $('#f-toggle').setAttribute('aria-expanded', String(o)); };
    $('#f-toggle').addEventListener('click', () => setRail(!rail.classList.contains('open')));
    if (params.get('filters') === 'open') setRail(true);

    function renderMonth() {
      const m = mData(st.month) || { income: 0, spend: 0 };
      $('#m-label').textContent = `${up(MONTHS[st.month])} 2026`;
      $('#m-sub').textContent = st.month === 8 ? 'CURRENT MONTH' : 'MOCK: NO ROWS LOADED';
      const n = m.income - m.spend;
      $('#m-stats').innerHTML = `
        <div class="stat"><dt>${ic('tri_up')}Income</dt><dd class="fig-m amt in" data-count="${m.income}" data-fmt="signed">${esc(signed(m.income))}</dd></div>
        <div class="stat"><dt>${ic('tri_dn')}Spend</dt><dd class="fig-m" data-count="${-m.spend}" data-fmt="signed">${esc(signed(-m.spend))}</dd></div>
        <div class="stat"><dt>Net</dt><dd class="fig-m ${n >= 0 ? 'amt in' : ''}" data-count="${n}" data-fmt="signed">${esc(signed(n))}</dd></div>
        <div class="stat"><dt>Spend of income</dt><dd><span class="fig-m">${m.income ? pct((m.spend / m.income) * 100) : 'n/a'}</span>${meter(m.income ? (m.spend / m.income) * 100 : 0, 'accent', null, 0)}</dd></div>`;
      $('#m-prev').disabled = st.month <= 0; $('#m-next').disabled = st.month >= 8;
    }
    const activeFilters = () => {
      const f = st.f, out = [];
      if (f.q) out.push(['q', `Search: ${f.q}`]);
      if (f.acct) out.push(['acct', M.acct(f.acct).name]);
      if (f.cat) out.push(['cat', M.cat(f.cat).name]);
      if (f.person) out.push(['person', `Person: ${f.person}`]);
      if (f.from) out.push(['from', `From ${f.from}`]);
      if (f.to) out.push(['to', `To ${f.to}`]);
      if (f.min) out.push(['min', `Min ${f.min}`]);
      if (f.max) out.push(['max', `Max ${f.max}`]);
      if (f.sign !== 'all') out.push(['sign', f.sign === 'in' ? 'Money in' : 'Money out']);
      if (f.splits) out.push(['splits', 'Has splits']);
      if (f.transfer) out.push(['transfer', 'In a transfer']);
      return out;
    };
    const match = (t) => {
      const f = st.f, e = Math.abs(txEur(t));
      if (f.q && !(`${t.title} ${t.notes || ''}`.toLowerCase().includes(f.q.toLowerCase()))) return false;
      if (f.acct && t.account_id !== f.acct) return false;
      if (f.cat && t.category_id !== f.cat) return false;
      if (f.person && !((t.splits || []).some((s) => s.person === f.person) || t.debt?.paidBy === f.person || t.title.includes(f.person))) return false;
      if (f.from && t.date < f.from) return false;
      if (f.to && t.date > f.to) return false;
      if (f.min && e < +f.min) return false;
      if (f.max && e > +f.max) return false;
      if (f.sign === 'in' && t.amount <= 0) return false;
      if (f.sign === 'out' && t.amount >= 0) return false;
      if (f.splits && !(t.splits || []).length) return false;
      if (f.transfer && !t.transfer) return false;
      return true;
    };
    const skelRows = (n) => Array.from({ length: n }, (_, i) => `<div class="lr skel-row" aria-hidden="true"><span class="skel" style="width:16px;height:16px"></span><span class="skel" style="width:34px;height:34px"></span><span><span class="skel" style="width:${45 + (i * 17) % 40}%"></span><span class="skel" style="width:${25 + (i * 11) % 20}%;margin-top:8px;height:8px"></span></span><span class="skel" style="width:72px;justify-self:end"></span><span></span></div>`).join('');

    function row(t, k, anim) {
      const b = txBadges(t, { native: true });
      const splitBtn = t.splits ? `<button type="button" class="badge badge-btn" data-exp="${t.id}" aria-expanded="false" aria-controls="ex-${t.id}">${ic('split')}Breakdown</button>` : '';
      return `<div class="lr-wrap" data-id="${t.id}" role="listitem"><div class="lr ${st.sel.has(t.id) ? 'sel' : ''} ${anim ? 'rise' : ''}" style="--i:${Math.min(k, 14)};--boot:${BOOT_MS + 240}ms">
        <span class="cb"><input type="checkbox" aria-label="Select ${esc(t.title)}" ${st.sel.has(t.id) ? 'checked' : ''} data-sel="${t.id}"></span>
        ${tile(t)}
        <div class="lr-main"><button class="open" data-open="${t.id}">${esc(t.title)}</button>
          <div class="lr-meta">${esc(up(tileOf(t).name))}<span class="sl" aria-hidden="true">/</span>${esc(M.acct(t.account_id).name)}</div>
          ${b || splitBtn ? `<div class="badges">${b}${splitBtn}</div>` : ''}</div>
        <span class="lr-amt">${txAmountCell(t)}</span>
        <button class="btn btn-sm btn-icon btn-ghost kebab" aria-label="Actions for ${esc(t.title)}" aria-haspopup="menu" aria-expanded="false" data-menu="${t.id}">${ic('more')}</button>
      </div>${t.splits ? `<div class="lr-exp" id="ex-${t.id}" hidden><dl class="kv">
        <dt>Your share</dt><dd class="num">${esc(nat(t, Math.abs(t.amount) - t.splits.reduce((s, x) => s + x.amount, 0)))}</dd>
        ${t.splits.map((s) => `<dt>${esc(s.person)} owes you</dt><dd>${amt(s.amount, txCur(t))}</dd>`).join('')}</dl></div>` : ''}</div>`;
    }

    function renderList(anim) {
      const box = $('#list');
      const chips = activeFilters();
      $('#f-count').textContent = chips.length ? ` (${chips.length})` : '';
      $('#f-n').textContent = chips.length ? `${chips.length} active` : '';
      $('#f-clear').hidden = !chips.length;
      $('#chips').innerHTML = chips.map(([k, l]) => `<span class="chip">${esc(l)}<button data-k="${k}" aria-label="Remove filter ${esc(l)}">${ic('close')}</button></span>`).join('');
      $$('#chips button').forEach((b) => b.addEventListener('click', () => clearOne(b.dataset.k)));
      const cnt = $('#l-count'); const sa = $('.cb-all');
      sa.style.visibility = 'hidden';
      if (st.view === 'loading') { cnt.innerHTML = '<span class="cursor-blink">Loading</span>'; box.innerHTML = `<div class="lg-body" aria-busy="true" aria-label="Loading transactions"><div class="lday"><span class="skel" style="width:120px"></span></div>${skelRows(8)}</div>`; return; }
      if (st.view === 'error') {
        cnt.textContent = '';
        box.innerHTML = `<div class="state-box err" role="alert"><span class="state-glyph" aria-hidden="true">ERR 503 / LEDGER LINK LOST</span><h3>Could not load transactions</h3><p>The server did not answer in time. Your data is safe; nothing was changed.</p><button class="btn btn-primary" id="retry">${ic('sync')}Retry</button></div>`;
        $('#retry').onclick = () => { st.view = 'loading'; syncSeg('view', st.view); renderList(); setTimeout(() => { st.view = 'data'; syncSeg('view', st.view); renderList(true); }, 900); };
        return;
      }
      const rows = st.month === 8 && st.view === 'data' ? st.list.filter(match) : [];
      if (!rows.length) {
        const filtered = chips.length && st.month === 8 && st.view === 'data';
        cnt.innerHTML = filtered ? 'No matches' : 'Showing <b>0</b>';
        box.innerHTML = `<div class="state-box"><span class="state-glyph" aria-hidden="true">[ 0 RECORDS ]</span><h3>${filtered ? 'Nothing matches' : 'No transactions yet'}</h3><p>${filtered ? 'No loaded transactions match these filters. Try widening the amount range or clearing a filter.' : 'Nothing recorded for this month. Add one, or import a CSV from your bank.'}</p><div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center">${filtered ? '<button class="btn" id="e-clear">Clear filters</button>' : `<button class="btn" data-act="import">${ic('upload')}Import CSV</button><button class="btn btn-primary" data-act="add">${ic('plus')}Add transaction</button>`}</div></div>`;
        $('#e-clear') && ($('#e-clear').onclick = clearAll); wireQuick(box);
        return;
      }
      sa.style.visibility = 'visible';
      cnt.innerHTML = chips.length ? `Showing <b>${rows.length}</b> of <b>${rows.length}</b> matching` : `Showing <b>${rows.length}</b> of <b>${TOTAL_TX - (M.transactions.length - st.list.length)}</b>`;
      const groups = {};
      rows.forEach((t) => (groups[t.date] = groups[t.date] || []).push(t));
      let i = 0;
      box.innerHTML = `<div class="lg-body" role="list" aria-label="Transactions grouped by day">${Object.entries(groups).map(([d, ts]) => {
        const sub = ts.reduce((s, t) => s + txEur(t), 0);
        return `<div class="lday" role="presentation"><span>${dShort(d)}</span><span class="sub"><span>${ts.length} TXN</span>${amt(sub)}</span></div>` + ts.map((t) => row(t, i++, anim)).join('');
      }).join('')}
      <div class="tx-foot" role="presentation"><span>Showing <b>${rows.length}</b> of <b>${chips.length ? rows.length : TOTAL_TX}</b>${chips.length ? ' matching in loaded rows' : ''}</span><span id="sentinel">${chips.length ? 'End of results' : 'Scroll to load more'}</span></div>
      <div id="more-rows" role="presentation"></div></div>`;
      wireRows();
      if (!chips.length) watchSentinel();
    }
    let loadedMore = false;
    function watchSentinel() {
      const s = $('#sentinel'); if (!s || loadedMore) return;
      const io = new IntersectionObserver((es) => {
        if (!es[0].isIntersecting) return; io.disconnect(); loadedMore = true;
        const mr = $('#more-rows'); mr.innerHTML = skelRows(3); s.textContent = 'Loading next page'; s.classList.add('cursor-blink');
        setTimeout(() => { mr.innerHTML = ''; s.classList.remove('cursor-blink'); s.textContent = `End of mock data, ${TOTAL_TX - st.list.length} more on the server`; }, 1400);
      }, { rootMargin: '0px 0px -40px 0px' });
      io.observe(s);
    }
    function updateBulk() {
      const n = st.sel.size; $('#bulk').classList.toggle('on', n > 0); $('#bulk-n').textContent = `${n} selected`;
      const all = $('#sel-all'); const vis = $$('[data-sel]'); const c = vis.filter((v) => v.checked).length; all.checked = !!c && c === vis.length; all.indeterminate = c > 0 && c < vis.length;
    }
    function removeTx(ids) {
      const removed = st.list.filter((t) => ids.includes(t.id));
      ids.map((id) => $(`.lr-wrap[data-id="${id}"]`)).filter(Boolean).forEach((r) => r.classList.add('leaving'));
      setTimeout(() => { st.list = st.list.filter((t) => !ids.includes(t.id)); ids.forEach((id) => st.sel.delete(id)); renderList(); updateBulk(); }, RM ? 0 : 200);
      toast(removed.length > 1 ? `${removed.length} transactions moved to Trash` : `${removed[0].title} moved to Trash`, 'Kept for 30 days, then purged', () => {
        st.list = M.transactions.filter((t) => st.list.some((x) => x.id === t.id) || ids.includes(t.id)).map((t) => st.list.find((x) => x.id === t.id) || { ...t });
        renderList(); ids.forEach((id) => $(`.lr-wrap[data-id="${id}"] .lr`)?.classList.add('flash'));
      });
    }
    function duplicate(t) {
      const c = { ...t, id: t.id + '-copy' + Math.floor(Math.random() * 999), title: t.title + ' (copy)' };
      const at = st.list.findIndex((x) => x.id === t.id); st.list.splice(at + 1, 0, c); renderList();
      $(`.lr-wrap[data-id="${c.id}"] .lr`)?.classList.add('flash'); toast('Duplicated', c.title);
    }
    const txMenu = (t) => [
      { label: 'Open details', icon: 'note', act: () => openTx(t) },
      { label: 'Edit', icon: 'edit', act: () => forms.addTx(t) },
      { label: 'Duplicate', icon: 'copy', act: () => duplicate(t) },
      ...(t.transfer ? [] : [{ label: 'Convert to transfer', icon: 'transfer', act: () => forms.transfer(t) }]),
      '-',
      { label: 'Delete', icon: 'trash', danger: true, act: () => removeTx([t.id]) },
    ];
    const find = (id) => st.list.find((t) => t.id === id);
    function wireRows() {
      $$('[data-open]').forEach((b) => b.addEventListener('click', () => openTx(find(b.dataset.open), b)));
      $$('[data-menu]').forEach((b) => b.addEventListener('click', () => openMenu(b, txMenu(find(b.dataset.menu)))));
      $$('[data-sel]').forEach((c) => c.addEventListener('change', () => { c.checked ? st.sel.add(c.dataset.sel) : st.sel.delete(c.dataset.sel); c.closest('.lr').classList.toggle('sel', c.checked); updateBulk(); }));
      $$('[data-exp]').forEach((b) => b.addEventListener('click', () => {
        const ex = $('#ex-' + b.dataset.exp); const on = ex.hidden; ex.hidden = !on; b.setAttribute('aria-expanded', String(on));
        if (on && !RM) ex.animate([{ clipPath: 'inset(0 0 100% 0)', opacity: 0.4 }, { clipPath: 'inset(0 0 0 0)', opacity: 1 }], { duration: 300, easing: FLOW });
      }));
      updateBulk();
    }
    $('#sel-all').addEventListener('change', (e) => { $$('[data-sel]').forEach((c) => { c.checked = e.target.checked; e.target.checked ? st.sel.add(c.dataset.sel) : st.sel.delete(c.dataset.sel); c.closest('.lr').classList.toggle('sel', e.target.checked); }); updateBulk(); });

    function openTx(t, trigger) {
      const d = $('#drawer'); const cur = txCur(t); const a = M.acct(t.account_id); const k = tileOf(t);
      const b = txBadges(t, { native: true });
      const splitSum = (t.splits || []).reduce((s, x) => s + x.amount, 0), share = Math.abs(t.amount) - splitSum;
      d.innerHTML = `<div class="drawer-in">
        <div class="ph"><h2 id="drawer-title">Transaction</h2><div class="meta"><span class="micro">TXN/${up(t.id)}</span><button class="btn btn-sm btn-icon btn-ghost" data-close aria-label="Close details">${ic('close')}</button></div></div>
        <div class="drawer-body dd">
          <div class="dd-head" style="--i:0">${tile(t, 'lg')}<div style="min-width:0"><h3>${esc(t.title)}</h3><div class="micro">${esc(up(dLong(t.date)))}</div></div></div>
          <div class="dd-amt scan" style="--i:1"><div class="kicker">${t.amount < 0 ? `${ic('tri_dn')}Money out` : `${ic('tri_up')}Money in`}</div>
            <div class="dd-fig amt ${t.amount > 0 ? 'in' : 'out'}"><span class="sr-only">${t.amount > 0 ? 'money in' : 'money out'}, </span><span data-count="${t.amount}" data-fmt="signed" data-cur="${cur}">${esc(signed(t.amount, cur))}</span></div>
            <span class="eq">${cur !== 'EUR' ? `approx. ${esc(signed(txEur(t)))} at ${fx(cur).toFixed(4)} ${cur}/EUR` : 'EUR, no conversion'}</span></div>
          ${b ? `<div class="dd-badges" style="--i:2">${b}</div>` : ''}
          <dl class="kv dd-kv" style="--i:3">
            <dt>Category</dt><dd>${catChip(t.category_id, { transfer: !!t.transfer })}</dd>
            <dt>Account</dt><dd>${esc(a.name)} <span class="tag neutral">${a.currency}</span></dd>
            ${t.transfer ? `<dt>Linked account</dt><dd>${ic('link')}${esc(t.transfer.linked)}</dd>` : ''}
            ${t.debt ? `<dt>Paid by</dt><dd>${esc(t.debt.paidBy)}, ${esc(eur(t.debt.total))} total</dd>` : ''}
            ${t.recurring ? '<dt>Repeats</dt><dd>Monthly</dd>' : ''}
          </dl>
          ${t.splits ? `<div class="dd-sec" style="--i:4"><div class="dd-h"><span class="kicker">[ Split ]</span><span class="micro">${t.splits.length + 1} ways, ${cur}</span></div>
            <div class="tape-wrap" data-a="clipx" data-d="200" data-dur="800" role="img" aria-label="Your share ${esc(nat(t, share))}, ${t.splits.map((s) => `${esc(s.person)} ${esc(nat(t, s.amount))}`).join(', ')}"><div class="tape" style="height:10px"><span style="flex:${share};--c:var(--ink-2)"></span>${t.splits.map((s) => `<span style="flex:${s.amount};--c:var(--accent)"></span>`).join('')}</div></div>
            <dl class="kv split-kv">
              <dt><span class="sw" style="--c:var(--ink-2)"></span>You</dt><dd class="num">${esc(nat(t, share))}</dd>
              ${t.splits.map((s) => `<dt><span class="sw" style="--c:var(--accent)"></span>${esc(s.person)} owes you</dt><dd>${amt(s.amount, cur)}</dd>`).join('')}
              <dt class="tot">Total</dt><dd class="num tot">${esc(nat(t, Math.abs(t.amount)))}</dd>
            </dl></div>` : ''}
          ${t.debt ? `<div class="dd-sec" style="--i:5"><div class="dd-h"><span class="kicker">[ Paid by someone else ]</span></div><p class="note">${esc(t.debt.paidBy)} paid ${esc(eur(t.debt.total))}. Your share of ${esc(eur(Math.abs(t.amount)))} is recorded as a debt you owe ${esc(t.debt.paidBy)}.</p></div>` : ''}
          <div class="dd-sec" style="--i:6"><div class="dd-h"><span class="kicker">[ Notes ]</span></div>${t.notes ? `<p class="note">${esc(t.notes)}</p>` : '<p class="note ink3">No notes</p>'}</div>
        </div>
        <div class="drawer-foot"><button class="btn btn-primary" data-d="edit">${ic('edit')}Edit</button><button class="btn" data-d="dup">${ic('copy')}Duplicate</button>${t.transfer ? '' : `<button class="btn" data-d="xfer">${ic('transfer')}Convert to transfer</button>`}<button class="btn btn-icon btn-danger" data-d="del" style="margin-left:auto" aria-label="Delete transaction" title="Delete">${ic('trash')}</button></div>
      </div>`;
      $$('[data-d]', d).forEach((bt) => bt.addEventListener('click', () => { const key = bt.dataset.d; closeDlg(d); setTimeout(() => ({ edit: () => forms.addTx(t), dup: () => duplicate(t), xfer: () => forms.transfer(t), del: () => removeTx([t.id]) })[key](), RM ? 0 : 220); }));
      openDlg(d, trigger || document.activeElement);
      runAnims(d, 160);
    }
    const syncSeg = (id, v) => $$(`#${id} button`).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === v)));
    function clearOne(k) {
      if (k === 'sign') { st.f.sign = 'all'; syncSeg('sign', 'all'); } else if (k === 'splits' || k === 'transfer') { st.f[k] = false; $('#f-' + k).checked = false; } else if (k === 'q') { st.f.q = ''; $('#q').value = ''; } else { st.f[k] = ''; $('#f-' + k).value = ''; }
      renderList();
    }
    function clearAll() { st.f = { ...EMPTY_F }; $$('#rail-body input, #rail-body select, #q').forEach((el) => (el.type === 'checkbox' ? (el.checked = false) : (el.value = ''))); syncSeg('sign', 'all'); renderList(); }
    $('#q').addEventListener('input', (e) => { st.f.q = e.target.value.trim(); renderList(); });
    $$('#sign button').forEach((b) => b.addEventListener('click', () => { st.f.sign = b.dataset.v; syncSeg('sign', st.f.sign); renderList(); }));
    $$('#view button').forEach((b) => b.addEventListener('click', () => { st.view = b.dataset.v; syncSeg('view', st.view); renderList(true); }));
    ['acct', 'cat', 'person', 'from', 'to', 'min', 'max'].forEach((k) => $('#f-' + k).addEventListener('input', (e) => { st.f[k] = e.target.value; renderList(); }));
    ['splits', 'transfer'].forEach((k) => $('#f-' + k).addEventListener('change', (e) => { st.f[k] = e.target.checked; renderList(); }));
    $('#f-clear').addEventListener('click', clearAll);
    $('#m-prev').addEventListener('click', () => { st.month--; st.sel.clear(); renderMonth(); renderList(); runAnims($('#m-stats'), 0); updateBulk(); });
    $('#m-next').addEventListener('click', () => { st.month++; st.sel.clear(); renderMonth(); renderList(true); runAnims($('#m-stats'), 0); updateBulk(); });
    $('#b-clr').addEventListener('click', () => { st.sel.clear(); renderList(); updateBulk(); });
    $('#b-del').addEventListener('click', () => removeTx([...st.sel]));
    $('#b-cat').addEventListener('click', () => openForm({ title: `Categorize ${st.sel.size}`, code: 'BULK', submit: 'Apply category', done: `${st.sel.size} transactions recategorized`, fields: [{ id: 'bc', label: 'Category', type: 'select', options: catOpts(), full: true }] }));
    // URL-driven review states: ?q= ?sign=in|out ?splits=1 ?transfer=1 ?select=t1,t2 ?open=t2 ?menu=t2 ?filters=open
    if (params.get('q')) { st.f.q = params.get('q'); $('#q').value = st.f.q; }
    if (['in', 'out'].includes(params.get('sign'))) { st.f.sign = params.get('sign'); syncSeg('sign', st.f.sign); }
    ['splits', 'transfer'].forEach((k) => { if (params.get(k) === '1') { st.f[k] = true; $('#f-' + k).checked = true; } });
    if (params.get('select')) params.get('select').split(',').forEach((id) => st.sel.add(id));
    renderMonth(); renderList(true);
    const open = params.get('open');
    if (open) { const t = find(open); if (t) setTimeout(() => openTx(t), RM ? 0 : BOOT_MS + 700); }
    if (params.get('menu')) setTimeout(() => { const b = $(`[data-menu="${params.get('menu')}"]`); b && b.click(); }, BOOT_MS + 1500);
  }

  /* =====================================================================
     ACCOUNTS
     ===================================================================== */
  function accounts(pg) {
    const groups = TYPES.map((t) => ({ ...t, accts: M.accounts.filter((a) => a.account_type === t.k) })).filter((g) => g.accts.length);
    const curs = [...new Set(M.accounts.map((a) => a.currency))];
    const expo = groups.map((g) => ({ ...g, total: g.accts.reduce((s, a) => s + M.toEur(a), 0) }));
    const maxAbs = Math.max(...expo.map((g) => Math.abs(g.total)));
    let ci = 0;
    const card = (a) => {
      const t = typeOf(a.account_type), eq = M.toEur(a), liab = !!t.liab;
      const share = liab ? (eq / liabs) * 100 : (eq / assets) * 100;
      const dayAmt = a.dayChange != null ? a.balance - a.balance / (1 + a.dayChange / 100) : null;
      return `<article class="acc pwr-me ${liab ? 'liab' : ''}" aria-labelledby="acc-${a.id}">
        <span class="corner c1" aria-hidden="true"></span><span class="corner c2" aria-hidden="true"></span><span class="corner c3" aria-hidden="true"></span><span class="corner c4" aria-hidden="true"></span>
        <div class="acc-top"><div><h3 id="acc-${a.id}">${esc(a.name)}</h3><div class="sub"><span class="tag neutral">${t.c}</span><span class="tag neutral">${a.currency}</span>${liab ? `<span class="tag crit">${ic('warn')}Liability</span>` : ''}</div></div>
          <button class="btn btn-sm btn-icon btn-ghost" aria-label="Actions for ${esc(a.name)}" aria-haspopup="menu" aria-expanded="false" data-amenu="${a.id}">${ic('more')}</button></div>
        <div class="bal">
          <span class="kicker">${liab ? 'Owed' : 'Balance'}</span>
          <span class="fig-l" style="margin-top:6px">${amt(a.balance, a.currency, { liab })}</span>
          ${a.currency !== 'EUR' ? `<span class="eq">approx. ${esc(eur(eq))} at ${fx(a.currency).toFixed(4)}</span>` : ''}
          ${dayAmt != null ? `<span class="delta ${a.dayChange >= 0 ? 'up' : 'down'}" style="margin-top:8px">${ic(a.dayChange >= 0 ? 'tri_up' : 'tri_dn')}${a.dayChange >= 0 ? '+' : ''}${a.dayChange.toFixed(2)}% today, ${esc(signed(dayAmt))}</span>` : ''}
          <div class="reveal" style="margin-top:8px" aria-hidden="true">ID ACC/${up(a.id)} / ${pct(share, 1)} OF ${liab ? 'LIABILITIES' : 'ASSETS'}</div>
        </div>
        <div class="acc-foot">${a.provider ? `<span class="st" data-sync-st="${a.id}"><i aria-hidden="true"></i>${esc(up(a.provider))}, synced ${esc(a.synced)}</span><button class="btn btn-sm" data-sync="${a.id}">${ic('sync')}<span>Sync now</span></button>` : `<span class="st"><i aria-hidden="true" style="background:var(--ink-3)"></i>Manual ledger</span><button class="btn btn-sm btn-ghost" data-act="connect">${ic('link')}Connect</button>`}</div>
      </article>`;
    };
    pg.innerHTML = `
${pageHead('03', 'Accounts', asOf, `<button class="btn" data-act="connect">${ic('link')}Connect provider</button><button class="btn btn-primary" data-act="account">${ic('plus')}Add account</button>`)}
<div class="grid">
  <section class="panel s-5 scan xh pwr-me" aria-labelledby="h-tot">
    <div class="ph"><h2 id="h-tot">Total balance</h2><span class="micro">EUR base, ${curs.length} currencies</span></div>
    <div class="pb">
      <div class="kicker">All accounts, converted to EUR</div>
      <div class="hero-fig" style="margin:10px 0 16px;font-size:clamp(40px,4.6vw,76px)">${rollHTML(M.netWorth)}</div>
      <dl class="stats" style="margin:0 -14px -14px;border-top:1px solid var(--line)">
        <div class="stat"><dt>${ic('tri_up')}Assets</dt><dd class="fig-m" data-count="${assets}">${esc(eur(assets))}</dd></div>
        <div class="stat"><dt>${ic('tri_dn')}Liabilities</dt><dd class="fig-m amt liab" data-count="${liabs}">${esc(eur(liabs))}</dd></div>
        <div class="stat"><dt>Accounts</dt><dd class="fig-m" data-count="${M.accounts.length}" data-fmt="int">${M.accounts.length}</dd></div>
      </dl>
    </div>
  </section>
  <section class="panel s-7 pwr-me" aria-labelledby="h-exp">
    <div class="ph"><h2 id="h-exp">Exposure by type</h2><span class="micro">EUR equivalent</span></div>
    <div class="pb">
      <table class="tbl"><caption class="sr-only">Balance by account type</caption><thead><tr><th scope="col" style="padding-left:0">Type</th><th scope="col" style="width:45%"><span class="sr-only">Bar</span></th><th scope="col" class="r">Share</th><th scope="col" class="r" style="padding-right:0">EUR</th></tr></thead>
      <tbody>${expo.map((g, i) => `<tr><td style="padding-left:0;white-space:nowrap"><span class="tag ${g.liab ? 'crit' : 'neutral'}">${g.c}</span> <span style="margin-left:6px">${g.n}</span></td>
        <td><span style="display:block;height:8px;background:var(--line);position:relative" aria-hidden="true"><i style="position:absolute;inset:0;background:${g.liab ? 'var(--crit)' : 'var(--viz-line)'};transform-origin:left;transform:scaleX(${Math.abs(g.total) / maxAbs})" data-a="scalex" data-d="${i * 60}"></i></span></td>
        <td class="r n ink2">${pct((Math.abs(g.total) / (g.liab ? -liabs : assets)) * 100, 1)}</td><td class="r" style="padding-right:0">${amt(g.total, 'EUR', { liab: g.liab })}</td></tr>`).join('')}</tbody></table>
      <p class="micro" style="margin:12px 0 0">Share is of total assets, or of total liabilities for CC and DBT.</p>
    </div>
  </section>
</div>
${groups.map((g) => {
  const tot = g.accts.reduce((s, a) => s + M.toEur(a), 0);
  return `<section aria-labelledby="g-${g.k}"><div class="grp-h"><h2 id="g-${g.k}">${g.n}<small>${g.accts.length} ${g.accts.length > 1 ? 'accounts' : 'account'}${g.liab ? ', liability' : ''}</small></h2>${amt(tot, 'EUR', { liab: g.liab })}</div>
    <div class="acc-grid" style="border:1px solid var(--line)">${g.accts.map(card).join('')}<button class="acc-slot" data-act="account" aria-label="Add ${g.n.toLowerCase()} account">${ic('plus')}Add ${g.n.toLowerCase()}</button></div></section>`;
}).join('')}`;
    void ci;
    $$('[data-amenu]', pg).forEach((b) => b.addEventListener('click', () => {
      const a = M.acct(b.dataset.amenu);
      openMenu(b, [
        { label: 'Edit', icon: 'edit', act: () => forms.account(a) },
        { label: 'View transactions', icon: 'list', act: () => (location.href = 'transactions.html') },
        a.provider ? { label: 'Sync now', icon: 'sync', act: () => $(`[data-sync="${a.id}"]`).click() } : { label: 'Connect provider', icon: 'link', act: forms.connect },
        { label: 'Archive', icon: 'archive', disabled: true, chip: nb() },
        '-',
        { label: 'Delete', icon: 'trash', danger: true, act: () => openForm({ title: `Delete ${a.name}?`, code: `ACC/${up(a.id)}`, submit: 'Delete account', danger: true, done: `${a.name} deleted`, fields: [{ id: 'confirm', label: `Type ${a.name} to confirm`, full: true }] }) },
      ]);
    }));
    wireSync(pg);
    const fitSlots = () => $$('.acc-grid', pg).forEach((g) => {
      const cols = getComputedStyle(g).gridTemplateColumns.split(' ').length;
      const n = $$('.acc', g).length, rem = n % cols ? cols - (n % cols) : 0;
      const sl = $('.acc-slot', g); sl.hidden = !rem; sl.style.gridColumn = `span ${rem || 1}`;
    });
    fitSlots(); onResize(fitSlots);
  }

  /* =====================================================================
     BUDGETS
     ===================================================================== */
  function budgets(pg) {
    const PERIODS = ['ALL', 'DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY'];
    const st = { period: params.get('period') || 'ALL', open: params.get('open') || 'b-dine', list: M.budgets.slice() };
    pg.innerHTML = `
${pageHead('04', 'Budgets', asOf, `<button class="btn btn-primary" data-act="budget">${ic('plus')}Create budget</button>`)}
<div style="display:flex;flex-wrap:wrap;gap:10px;justify-content:space-between;align-items:end;margin-bottom:14px">
  <div class="field"><span class="lbl" id="per-l">Period</span><div class="seg" role="group" aria-labelledby="per-l" id="per" style="flex-wrap:wrap"></div></div>
  <span class="micro">Status: OK under 80%, Warning 80 to 100%, Exceeded over 100%</span>
</div>
<div class="grid" id="b-top"></div>
<div class="grid">
  <section class="panel s-8 pb-0 pwr-me" aria-labelledby="h-bl"><div class="ph"><h2 id="h-bl">Budgets</h2><span class="micro" id="b-count"></span></div><div class="bud-grid" id="b-list"></div></section>
  <section class="panel s-4 pwr-me" aria-labelledby="h-bd" id="b-detail"></section>
</div>`;
    function renderTop(anim) {
      const L = st.list.filter((b) => st.period === 'ALL' || b.period === st.period);
      const lim = L.reduce((s, b) => s + b.limit, 0), sp = L.reduce((s, b) => s + b.spent, 0), p = lim ? (sp / lim) * 100 : 0;
      const S = L.map(budStats); const cnt = (k) => S.filter((x) => x.status === k).length;
      const status = p > 100 ? 'EXCEEDED' : p >= 80 ? 'WARNING' : 'OK';
      // pace scatter
      const topW = $('#b-top').clientWidth || 1160; const W = innerWidth <= 960 ? 520 : Math.max(420, Math.round(topW * 7 / 12 - 34)), H = 230, pl = 40, pr = 14, pt = 12, pb = 28;
      const X = (v) => pl + ((v - 40) / 60) * (W - pl - pr), Y = (v) => pt + (1 - (v - 20) / 120) * (H - pt - pb);
      const pts = L.map((b, i) => ({ b, s: S[i] }));
      $('#b-top').innerHTML = `
      <section class="panel s-5 scan xh ${anim ? 'pwr-me' : ''}" aria-labelledby="h-ov">
        <div class="ph"><h2 id="h-ov">Overall</h2><span class="micro">${st.period === 'ALL' ? 'All active budgets' : st.period}</span></div>
        <div class="pb ov-body">
          ${gauge(p, { size: 168, stroke: 12, status: L.length ? status : 'ACC', animate: anim, read: `<span class="fig-l" data-count="${p}" data-fmt="pct">${pct(p)}</span><span class="micro" style="margin-top:6px">used</span>` })}
          <dl class="kv">
            <dt>Limit</dt><dd class="num">${esc(eur(lim))}</dd>
            <dt>Spent</dt><dd class="num" data-count="${sp}">${esc(eur(sp))}</dd>
            <dt>${lim - sp >= 0 ? 'Remaining' : 'Over by'}</dt><dd class="num" ${lim - sp < 0 ? 'style="color:var(--crit)"' : ''}>${esc(eur(Math.abs(lim - sp)))}</dd>
            <dt>Status</dt><dd style="display:flex;gap:4px;justify-content:flex-end;flex-wrap:wrap"><span class="tag ok">${ic('check')}${cnt('OK')}</span><span class="tag warn">${ic('warn')}${cnt('WARNING')}</span><span class="tag crit">${ic('xoct')}${cnt('EXCEEDED')}</span></dd>
          </dl>
        </div>
        <p class="sr-only">${pct(p)} of the combined limit used. ${cnt('OK')} OK, ${cnt('WARNING')} warning, ${cnt('EXCEEDED')} exceeded.</p>
      </section>
      <section class="panel s-7 ${anim ? 'pwr-me' : ''}" aria-labelledby="h-pace">
        <div class="ph"><h2 id="h-pace">Pace monitor</h2><span class="micro">Above the line = spending ahead of time</span></div>
        <div class="pb"><figure style="margin:0"><div class="chart pace-chart"><svg viewBox="0 0 ${W} ${H}" height="${H}" aria-hidden="true">
          ${[20, 60, 100, 140].map((v) => `<line class="gridl" x1="${pl}" x2="${W - pr}" y1="${Y(v)}" y2="${Y(v)}"/><text x="${pl - 6}" y="${Y(v) + 3.5}" text-anchor="end">${v}%</text>`).join('')}
          ${[40, 60, 80, 100].map((v) => `<text x="${X(v)}" y="${H - 8}" text-anchor="${v === 100 ? 'end' : 'middle'}">${v}%</text>`).join('')}
          <text x="${pl}" y="${H - 8}" text-anchor="start" style="fill:var(--ink-3)" dx="${(W - pl - pr) / 2 - 60}"></text>
          <rect x="${pl}" y="${Y(140)}" width="${W - pl - pr}" height="${Y(100) - Y(140)}" fill="var(--crit)" opacity="0.07"/>
          <line class="axis" x1="${pl}" x2="${W - pr}" y1="${H - pb}" y2="${H - pb}"/>
          <line x1="${X(40)}" y1="${Y(40)}" x2="${X(100)}" y2="${Y(100)}" stroke="var(--ink-2)" stroke-width="1" stroke-dasharray="4 4" ${anim ? 'data-a="draw" data-dur="900"' : ''}/>
          <text x="${X(52)}" y="${Y(52) + 16}" text-anchor="middle" style="fill:var(--ink-2)">ON PACE</text>
          <text x="${pl + 6}" y="${Y(140) + 14}" style="fill:var(--crit)">OVER LIMIT</text>
          ${pts.map(({ b, s }, i) => { const x = X(Math.max(40, s.ePct)), y = Y(Math.min(140, s.p)); const left = /Fun|Travel/.test(b.name); const col = { OK: 'var(--pos)', WARNING: 'var(--warn)', EXCEEDED: 'var(--crit)' }[s.status];
            return `<g ${anim ? `data-a="fade" data-d="${500 + i * 80}"` : ''}><rect x="${x - 5}" y="${y - 5}" width="10" height="10" fill="${col}" stroke="var(--panel)" stroke-width="2"/>${s.status === 'EXCEEDED' ? `<rect x="${x - 9}" y="${y - 9}" width="18" height="18" fill="none" stroke="${col}"/>` : ''}<text x="${left ? x - 12 : x + 12}" y="${y + 3.5}" text-anchor="${left ? 'end' : 'start'}" style="fill:var(--ink);font-weight:600">${up(b.name)} ${pct(s.p)}</text></g>`; }).join('')}
        </svg></div>
        <figcaption class="micro" style="margin-top:6px;display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><span>X: period elapsed. Y: limit used.</span><span>${pts.filter((x) => x.s.pace !== 'ON TRACK').length} of ${pts.length} off pace</span></figcaption>
        <p class="sr-only">${pts.map(({ b, s }) => `${b.name}: ${pct(s.p)} used with ${pct(s.ePct)} of the period elapsed, ${s.pace.toLowerCase()}`).join('. ')}.</p></figure></div>
      </section>`;
    }
    function renderPer() {
      $('#per').innerHTML = PERIODS.map((p) => { const n = p === 'ALL' ? st.list.length : st.list.filter((b) => b.period === p).length; return `<button type="button" data-p="${p}" aria-pressed="${p === st.period}" ${n ? '' : 'disabled'}>${p} <span style="opacity:.7">${n}</span></button>`; }).join('');
      $$('#per button').forEach((b) => b.addEventListener('click', () => { st.period = b.dataset.p; renderPer(); renderTop(false); renderList(false); kickoffLocal(); }));
    }
    function renderList(anim) {
      const L = st.list.filter((b) => st.period === 'ALL' || b.period === st.period);
      $('#b-count').textContent = `${L.length} shown`;
      $('#b-list').innerHTML = L.map((b, i) => {
        const s = budStats(b), c = catOf(b.category_id);
        return `<article class="bud ${anim ? 'pwr-me' : ''}" aria-current="${b.id === st.open}" aria-pressed="${b.id === st.open}" data-bid="${b.id}">
          ${gauge(s.p, { size: 96, stroke: 7, status: s.status, pace: s.ePct, d: i * 80, animate: true, read: `<span style="font:600 17px/1 var(--mono)">${pct(s.p)}</span>` })}
          <div style="min-width:0">
            <div class="row"><h3><button class="open-b" data-open-b="${b.id}" style="all:unset;cursor:pointer" aria-describedby="bs-${b.id}">${esc(b.name)}</button></h3>
              <span style="display:flex;gap:4px;align-items:center" id="bs-${b.id}">${statusTag(s.status)}<button class="btn btn-sm btn-icon btn-ghost" aria-label="Actions for ${esc(b.name)}" aria-haspopup="menu" aria-expanded="false" data-bmenu="${b.id}">${ic('more')}</button></span></div>
            <div style="display:flex;gap:6px;align-items:center;margin-top:6px;flex-wrap:wrap">${catChip(b.category_id)}<span class="tag neutral">${b.period}</span></div>
            <dl class="nums"><div><dt>Limit</dt><dd>${esc(eur(b.limit))}</dd></div><div><dt>Spent</dt><dd>${esc(eur(b.spent))}</dd></div><div><dt>${s.remaining >= 0 ? 'Left' : 'Over'}</dt><dd ${s.remaining < 0 ? 'style="color:var(--crit)"' : ''}>${esc(eur(Math.abs(s.remaining)))}</dd></div></dl>
            ${meter(s.p, ST[s.status].cls, s.ePct, i * 80)}
            <div class="foot"><span>${s.left} ${s.left === 1 ? 'day' : 'days'} left</span><span class="${s.pace === 'ON TRACK' ? 'pace-ok' : 'pace-ahead'}">${s.pace}</span></div>
          </div></article>`;
      }).join('') + (L.length % 2 ? '<div class="bud" aria-hidden="true" style="cursor:default"></div>' : '');
      void c0;
      $$('.bud[data-bid]').forEach((el) => el.addEventListener('click', (e) => { if (e.target.closest('[data-bmenu]')) return; select(el.dataset.bid); }));
      $$('[data-bmenu]').forEach((b) => b.addEventListener('click', () => { const bud = st.list.find((x) => x.id === b.dataset.bmenu); openMenu(b, [
        { label: 'Open details', icon: 'gauge', act: () => select(bud.id) },
        { label: 'Edit', icon: 'edit', act: () => forms.budget(bud) },
        '-',
        { label: 'Delete', icon: 'trash', danger: true, act: () => delBud(bud) },
      ]); }));
    }
    const c0 = 0;
    function delBud(b) {
      st.list = st.list.filter((x) => x.id !== b.id); if (st.open === b.id) st.open = st.list[0]?.id;
      renderPer(); renderTop(false); renderList(false); renderDetail(); kickoffLocal();
      toast(`${b.name} budget deleted`, 'Undo within 6 seconds', () => { st.list = M.budgets.filter((x) => st.list.includes(x) || x.id === b.id); renderPer(); renderTop(false); renderList(false); renderDetail(); kickoffLocal(); });
    }
    function select(id) { st.open = id; $$('.bud[data-bid]').forEach((el) => { const on = el.dataset.bid === id; el.setAttribute('aria-pressed', String(on)); el.setAttribute('aria-current', String(on)); }); renderDetail(true); kickoffLocal($('#b-detail')); if (innerWidth < 1180) $('#b-detail').scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'start' }); }
    function renderDetail(anim) {
      const b = st.list.find((x) => x.id === st.open); const el = $('#b-detail');
      if (!b) { el.innerHTML = `<div class="ph"><h2 id="h-bd">Budget detail</h2></div><div class="state-box"><h3>No budget</h3><p>Create one to start tracking.</p></div>`; return; }
      const s = budStats(b), c = catOf(b.category_id);
      const txs = M.transactions.filter((t) => t.category_id === b.category_id && t.date >= b.start && t.date <= b.end);
      el.innerHTML = `<div class="ph"><h2 id="h-bd">Budget detail</h2><div class="meta"><button class="btn btn-sm" id="bd-edit">${ic('edit')}Edit</button><button class="btn btn-sm btn-icon btn-danger" id="bd-del" aria-label="Delete ${esc(b.name)}">${ic('trash')}</button></div></div>
        <div class="pb" ${anim ? 'style="animation:fade 300ms ease both"' : ''}>
          <div style="display:flex;justify-content:space-between;gap:8px;align-items:center">${catChip(b.category_id)}${statusTag(s.status)}</div>
          <h3 style="margin:14px 0 4px;font:800 32px/0.9 var(--sans);letter-spacing:-0.04em;text-transform:uppercase">${esc(b.name)}</h3>
          <div class="micro">${b.period}, ${dRange(b.start)} to ${dRange(b.end)}</div>
          <div style="display:flex;align-items:baseline;gap:10px;margin:18px 0 10px;flex-wrap:wrap"><span class="fig-l" data-count="${b.spent}">${esc(eur(b.spent))}</span><span class="ink3" style="font-size:13px">of ${esc(eur(b.limit))}</span></div>
          ${meter(s.p, ST[s.status].cls, s.ePct, 0)}
          <dl class="kv" style="margin-top:12px">
            <dt>Used</dt><dd class="num">${pct(s.p, 1)}</dd>
            <dt>Period elapsed</dt><dd class="num">${pct(s.ePct, 1)} (day ${s.elapsed} of ${s.total})</dd>
            <dt>${s.remaining >= 0 ? 'Remaining' : 'Over by'}</dt><dd class="num" ${s.remaining < 0 ? 'style="color:var(--crit)"' : ''}>${esc(eur(Math.abs(s.remaining)))}</dd>
            <dt>Safe to spend per day</dt><dd class="num">${s.remaining > 0 && s.left ? esc(eur(s.remaining / s.left)) : esc(eur(0))}</dd>
            <dt>Pace</dt><dd class="${s.pace === 'ON TRACK' ? '' : 'pace-ahead'}">${s.pace}</dd>
          </dl>
          <div class="kicker" style="margin:20px 0 8px">Counting toward this budget</div>
          ${txs.length ? `<table class="tbl" style="border:1px solid var(--line)"><caption class="sr-only">Transactions counting toward ${esc(b.name)}</caption><tbody>${txs.map((t) => `<tr class="clk" data-href="transactions.html?open=${t.id}"><td style="font-size:12px" class="ink2 n">${dShort(t.date).replace(/^\w+ /, '')}</td><td><a href="transactions.html?open=${t.id}" style="text-decoration:none;font-weight:600">${esc(t.title)}</a></td><td class="r">${txAmountCell(t)}</td></tr>`).join('')}</tbody></table><p class="micro" style="margin:6px 0 0">${txs.length} of the loaded transactions. Full list on the server.</p>` : '<p class="micro">No loaded transactions in this range.</p>'}
          <div style="display:flex;justify-content:space-between;align-items:center;margin:22px 0 8px"><span class="kicker">Range history</span>${nb()}</div>
          <table class="tbl" style="border:1px solid var(--line)"><thead><tr><th scope="col">Range</th><th scope="col" class="r">Limit</th></tr></thead><tbody><tr><td style="font-size:12px">${dRange(b.start)} to ${dRange(b.end)} <span class="tag solid" style="margin-left:4px">Current</span></td><td class="r n">${esc(eur(b.limit))}</td></tr><tr><td colspan="2" class="micro">Earlier ranges appear here once the API exposes them</td></tr></tbody></table>
          <button class="btn" disabled style="margin-top:8px;width:100%">${ic('edit')}Edit ranges</button>
          <div class="field" style="margin-top:20px"><div style="display:flex;justify-content:space-between;align-items:center"><label for="bnote">Notes</label>${nb()}</div><textarea class="input" id="bnote" disabled></textarea></div>
        </div>`;
      $('#bd-edit').onclick = () => forms.budget(b);
      $('#bd-del').onclick = () => delBud(b);
      $$('tr.clk', el).forEach((tr) => tr.addEventListener('click', (e) => { if (!e.target.closest('a')) location.href = tr.dataset.href; }));
    }
    const kickoffLocal = (sc = pg) => { runAnims(sc, 0); };
    renderPer(); renderTop(true); renderList(true); renderDetail();
    onResize(() => renderTop(false));
  }

  /* ---------------- resize ---------------- */
  let rzT, rzFns = [];
  const onResize = (fn) => rzFns.push(fn);
  let lastW = innerWidth;
  addEventListener('resize', () => { clearTimeout(rzT); rzT = setTimeout(() => { if (innerWidth !== lastW) { lastW = innerWidth; rzFns.forEach((f) => f()); } }, 150); });

  /* ---------------- boot ---------------- */
  shell();
  const pg = $('#page');
  const boot = bootSequence();
  ({ dashboard, transactions, accounts, budgets, 'transactions-d': transactionsD })[PAGE](pg);
  wireQuick(pg);
  powerOn();
  kickoff(pg);
  boot.then(() => {});
})();
