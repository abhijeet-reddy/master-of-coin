/* Master of Coin v2, direction B: Editorial.
   Classic script (works over file://). Renders the shell + one page from
   window.MOC. Motion runs once per load; everything respects reduced motion. */
(() => {
  'use strict';
  const M = window.MOC;
  const PAGE = document.body.dataset.page;
  const TODAY = new Date(2026, 8, 25); // the sample data's "today"
  const params = new URLSearchParams(location.search);
  const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FLOW = 'cubic-bezier(0.22, 0, 0.12, 1)';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ---------------- icons (one set, 1.75 stroke, currentColor) ---------------- */
  const P = {
    dashboard: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>',
    transactions: '<path d="M8.5 6h12M8.5 12h12M8.5 18h12"/><path d="M3.5 6h1M3.5 12h1M3.5 18h1" stroke-width="2.4"/>',
    accounts: '<path d="M4 8V7a2 2 0 0 1 2-2h11v3"/><rect x="4" y="8" width="16" height="11.5" rx="2"/><path d="M16 13.8h.01" stroke-width="2.6"/>',
    budgets: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><path d="M12 12h.01" stroke-width="2.6"/>',
    categories: '<path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3a1.5 1.5 0 0 1 0 2.1l-6 6a1.5 1.5 0 0 1-2.1 0z"/><circle cx="8" cy="8" r="1.3"/>',
    people: '<circle cx="9" cy="8.5" r="3.5"/><path d="M2.5 19.5c.8-3.3 3.4-5 6.5-5s5.7 1.7 6.5 5"/><path d="M15.5 5.2a3.5 3.5 0 0 1 0 6.6M17.5 14.8c2 .6 3.4 2.2 4 4.7"/>',
    reports: '<path d="M4 20V4M4 20h16"/><path d="M8.5 16v-4M12.5 16V8M16.5 16v-6"/>',
    jobs: '<path d="M12 3.5 21 8l-9 4.5L3 8z"/><path d="m3 12 9 4.5 9-4.5M3 16l9 4.5 9-4.5"/>',
    schedules: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    trash: '<path d="M4 7h16M9.5 7V4.5h5V7M6 7l1 13h10l1-13"/>',
    settings: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    transfer: '<path d="M4 8h14l-3.5-3.5M20 16H6l3.5 3.5"/>',
    import: '<path d="M12 15V4M7.5 8.5 12 4l4.5 4.5M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15"/>',
    chevL: '<path d="m14.5 6-6 6 6 6"/>',
    chevR: '<path d="m9.5 6 6 6-6 6"/>',
    chevD: '<path d="m6 9.5 6 6 6-6"/>',
    more: '<path d="M5.5 12h.01M12 12h.01M18.5 12h.01" stroke-width="2.8"/>',
    note: '<path d="M5 4.5h14v10l-5 5H5z"/><path d="M14 19.5v-5h5M8.5 9h7M8.5 12.5h4"/>',
    split: '<circle cx="8" cy="9" r="3"/><circle cx="16" cy="9" r="3"/><path d="M3 19c.6-2.6 2.6-4 5-4s4.4 1.4 5 4M11 19c.6-2.6 2.6-4 5-4s4.4 1.4 5 4"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
    moon: '<path d="M19.5 14.5A7.5 7.5 0 0 1 9.5 4.5a7.5 7.5 0 1 0 10 10z"/>',
    sync: '<path d="M19.5 12a7.5 7.5 0 0 1-13 5.1M4.5 12a7.5 7.5 0 0 1 13-5.1"/><path d="M17.5 3.5v3.4h-3.4M6.5 20.5v-3.4h3.4"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    alert: '<path d="M12 4 2.8 19.5h18.4z"/><path d="M12 10v4M12 17h.01"/>',
    up: '<path d="m4 16 5.5-5.5 4 4L20 8"/><path d="M15 8h5v5"/>',
    down: '<path d="m4 8 5.5 5.5 4-4L20 16"/><path d="M15 16h5v-5"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/>',
    edit: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
    sidebar: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M9.5 4.5v15M15 10l-2 2 2 2"/>',
    globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.5 3.5 5.5 3.5 8.5s-1 6-3.5 8.5c-2.5-2.5-3.5-5.5-3.5-8.5s1-6 3.5-8.5"/>',
    receipt: '<path d="M6 3.5h12v17l-2-1.3-2 1.3-2-1.3-2 1.3-2-1.3-2 1.3z"/><path d="M9 8.5h6M9 12h6"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    archive: '<rect x="3.5" y="4.5" width="17" height="4" rx="1"/><path d="M5 8.5V19a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19V8.5M10 12.5h4"/>',
    bank: '<path d="M3.5 9.5 12 4l8.5 5.5M5 10v7M9.5 10v7M14.5 10v7M19 10v7M3.5 20h17"/>',
    filter: '<path d="M4 6.5h16M7 12h10M10 17.5h4"/>',
    coins: '<ellipse cx="9" cy="7" rx="5.5" ry="2.5"/><path d="M3.5 7v4c0 1.4 2.5 2.5 5.5 2.5s5.5-1.1 5.5-2.5V7"/><path d="M9.5 16.2c.9.2 1.9.3 3 .3 3 0 5.5-1.1 5.5-2.5V10M14.5 10.2c2.1.3 3.5 1.2 3.5 2.3"/>',
    cart: '<path d="M3 4h2.2l2.2 11h10.4l2-7.5H6.4"/><circle cx="9" cy="19" r="1.3"/><circle cx="17" cy="19" r="1.3"/>',
    fork: '<path d="M7 3v7a2 2 0 0 0 2 2v9M11 3v7a2 2 0 0 1-2 2M9 3v6M17 21V3c-2 1.5-3 4-3 7s1 3 3 3"/>',
    home: '<path d="M4 10.5 12 4l8 6.5V20h-5.5v-6h-5v6H4z"/>',
    bolt: '<path d="M13 3 5 13.5h6L10 21l8-10.5h-6z"/>',
    train: '<rect x="6" y="3.5" width="12" height="13" rx="3"/><path d="M6 10.5h12M9 16.5 7 20.5M15 16.5l2 4M9.5 13.5h.01M14.5 13.5h.01"/>',
    bag: '<path d="M5 8h14l-1 12.5H6z"/><path d="M9 10V6.5a3 3 0 0 1 6 0V10"/>',
    film: '<rect x="3.5" y="5" width="17" height="14" rx="2"/><path d="M8 5v14M16 5v14M3.5 9.5H8M3.5 14.5H8M16 9.5h4.5M16 14.5h4.5"/>',
    heart: '<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/>',
    plane: '<path d="M21 4.5 3.5 11l6.5 2.5L12.5 20z"/><path d="m10 13.5 4-4"/>',
    briefcase: '<rect x="3.5" y="7" width="17" height="12.5" rx="2"/><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3.5 12.5h17"/>',
    repeat: '<path d="M4 11V9.5A2.5 2.5 0 0 1 6.5 7H19l-3-3M20 13v1.5a2.5 2.5 0 0 1-2.5 2.5H5l3 3"/>',
    question: '<circle cx="12" cy="12" r="8.5"/><path d="M9.8 9.5a2.3 2.3 0 0 1 4.4.8c0 1.5-2.2 2-2.2 3.2M12 16.5h.01"/>',
  };
  const icon = (n, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${P[n] || P.question}</svg>`;

  /* ---------------- money + dates ---------------- */
  const fmt = (n, cur = 'EUR') => M.fmt(n, cur);
  const signed = (n, cur = 'EUR') => M.fmt(n, cur, { signDisplay: 'exceptZero' });
  const compact = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR', notation: 'compact', maximumFractionDigits: 1 }).format(n);
  const pct = (n, d = 0) => new Intl.NumberFormat('en-US', { maximumFractionDigits: d, minimumFractionDigits: d }).format(n) + '%';
  // serif figure with small raised cents
  function figHTML(n, cur = 'EUR', { sign = false } = {}) {
    const s = sign ? signed(n, cur) : fmt(n, cur);
    const i = s.lastIndexOf('.');
    if (i < 0) return esc(s);
    return `${esc(s.slice(0, i))}<span class="cents">${esc(s.slice(i))}</span>`;
  }
  const parseD = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
  const dayName = (d) => d.toLocaleDateString('en-US', { weekday: 'long' });
  const monthDay = (d) => d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  const shortDate = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const daysBetween = (a, b) => Math.round((b - a) / 86400000);
  const txCur = (t) => t.currency || M.acct(t.account_id).currency;
  const txEur = (t) => t.amount * (M.fx[txCur(t)] || 1);
  const initials = (name) => name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

  /* ---------------- motion helpers ---------------- */
  let firstPaint = true; // entrance motion only on the first render of a page
  const rv = (i) => (firstPaint ? ` rv" style="--i:${i}` : '');
  function anim(el, frames, opts) {
    if (!el || reduce() || !firstPaint) return;
    el.animate(frames, { easing: FLOW, fill: 'backwards', ...opts });
  }
  function countUp(el, to, { cur = 'EUR', dur = 1300, delay = 150, sign = false } = {}) {
    const done = () => { el.innerHTML = figHTML(to, cur, { sign }); };
    if (reduce() || !firstPaint) return done();
    const from = to * 0.82; // start near the value: calm, not a slot machine
    const t0 = performance.now() + delay;
    el.innerHTML = figHTML(from, cur, { sign });
    const tick = (now) => {
      const t = Math.min(1, Math.max(0, (now - t0) / dur));
      const e = 1 - Math.pow(1 - t, 4);
      el.innerHTML = figHTML(from + (to - from) * e, cur, { sign });
      if (t < 1) requestAnimationFrame(tick); else done();
    };
    requestAnimationFrame(tick);
  }

  /* ---------------- theme ---------------- */
  function applyTheme(t) {
    const root = document.documentElement;
    const kill = document.createElement('style');
    kill.textContent = '*,*::before,*::after{transition:none!important}';
    document.head.appendChild(kill);
    root.dataset.theme = t;
    try { localStorage.setItem('moc-b-theme', t); } catch (e) { /* file:// may block */ }
    void root.offsetHeight;
    requestAnimationFrame(() => requestAnimationFrame(() => kill.remove()));
    $$('.theme-btn').forEach((b) => b.setAttribute('aria-label', t === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'));
  }
  function toggleTheme(ev) {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    if (!document.startViewTransition || reduce()) return applyTheme(next);
    const r = ev.currentTarget.getBoundingClientRect();
    document.documentElement.style.setProperty('--vx', `${r.left + r.width / 2}px`);
    document.documentElement.style.setProperty('--vy', `${r.top + r.height / 2}px`);
    document.startViewTransition(() => applyTheme(next));
  }

  /* ---------------- shell ---------------- */
  const NAV_ICON = ['dashboard', 'transactions', 'accounts', 'budgets', 'categories', 'people', 'reports', 'jobs', 'schedules', 'trash', 'settings'];
  const LIVE = ['dashboard', 'transactions', 'accounts', 'budgets'];
  function navLinks() {
    return M.nav.map((label, i) => {
      const key = NAV_ICON[i];
      const live = LIVE.includes(key);
      const cur = key === PAGE ? ' aria-current="page"' : '';
      const href = live ? `${key}.html` : '#';
      const dis = live ? '' : ' aria-disabled="true" tabindex="-1" title="Not mocked"';
      const sep = i === 7 ? '<li class="nav-sep" role="separator"></li>' : '';
      return `${sep}<li><a href="${href}"${cur}${dis}>${icon(key)}<span class="nav-label">${label}</span></a></li>`;
    }).join('');
  }
  function themeBtn(cls = '') {
    return `<button class="btn icon ghost theme-btn ${cls}" type="button" aria-label="Switch to dark theme"><span class="sun">${icon('sun')}</span><span class="moon">${icon('moon')}</span></button>`;
  }
  function shell(inner) {
    const u = M.user;
    const collapsed = (() => { try { return localStorage.getItem('moc-b-side') === '1'; } catch (e) { return false; } })();
    return `
<a class="skip" href="#main">Skip to content</a>
<div class="shell" data-collapsed="${collapsed}">
  <aside class="side" aria-label="Primary">
    <div class="brand"><span class="brand-mark" aria-hidden="true">M</span><span class="brand-name">Master of Coin</span></div>
    <nav aria-label="Main"><ul class="nav">${navLinks()}</ul></nav>
    <div class="side-foot">
      <div class="user"><span class="avatar" aria-hidden="true">${initials(u.name)}</span>
        <div class="user-meta"><div class="user-name">${esc(u.name)}</div><div class="user-mail">${esc(u.email)}</div></div></div>
      <div class="version"><span class="ver-text">v${esc(u.version)}</span>
        <button class="collapse-btn" type="button" aria-label="Collapse sidebar" aria-expanded="${!collapsed}" data-collapse>${icon('sidebar', 'sm')}</button></div>
    </div>
  </aside>
  <div class="main">
    <div class="mobile-top">
      <div class="brand"><span class="brand-mark" aria-hidden="true">M</span><span class="brand-name">Master of Coin</span></div>
      <div class="top-actions">${themeBtn()}</div>
    </div>
    <main id="main" class="page" tabindex="-1">${inner}</main>
  </div>
</div>
<nav class="tabbar" aria-label="Main, compact">
  ${LIVE.map((k, i) => `<a href="${k}.html"${k === PAGE ? ' aria-current="page"' : ''}>${icon(k)}<span>${M.nav[i]}</span></a>`).join('')}
  <button type="button" data-more aria-haspopup="dialog">${icon('more')}<span>More</span></button>
</nav>
<div class="scrim" data-scrim></div>
<aside class="drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title" data-drawer>
  <div class="drawer-head"><div id="drawer-title" class="eyebrow" style="margin:0"></div>
    <button class="btn icon ghost sm" type="button" aria-label="Close panel" data-close>${icon('x')}</button></div>
  <div class="drawer-body"></div>
  <div class="drawer-foot" hidden></div>
</aside>
<div class="toasts" role="status" aria-live="polite"></div>`;
  }
  function topbar(eyebrow, titleHTML, actionsHTML) {
    return `<header class="topbar${rv(0)}"><div><p class="eyebrow">${eyebrow}</p><h1 class="title">${titleHTML}</h1></div>
      <div class="top-actions">${actionsHTML}<span class="hide-m">${themeBtn()}</span></div></header>`;
  }
  const quickActions = () => `
    <button class="btn hide-m" type="button" data-form="import">${icon('import')}Import CSV</button>
    <button class="btn hide-m" type="button" data-form="transfer">${icon('transfer')}Transfer</button>
    <button class="btn primary" type="button" data-form="transaction">${icon('plus')}Add transaction</button>`;

  /* ---------------- drawer, menu, toast ---------------- */
  let lastTrigger = null;
  function openDrawer({ eyebrow, body, foot, trigger }) {
    const d = $('[data-drawer]');
    lastTrigger = trigger || document.activeElement;
    $('#drawer-title').textContent = eyebrow;
    $('.drawer-body', d).innerHTML = body;
    const f = $('.drawer-foot', d);
    f.hidden = !foot; f.innerHTML = foot || '';
    $('.shell').inert = true; $('.tabbar').inert = true;
    $('[data-scrim]').classList.add('on');
    d.classList.add('on');
    setTimeout(() => ($('[data-close]', d)).focus(), 60);
    wireCommon(d);
    return d;
  }
  function closeDrawer() {
    const d = $('[data-drawer]');
    if (!d.classList.contains('on')) return;
    d.classList.remove('on');
    $('[data-scrim]').classList.remove('on');
    $('.shell').inert = false; $('.tabbar').inert = false;
    if (lastTrigger && lastTrigger.focus) lastTrigger.focus();
  }
  let openMenuEl = null;
  function closeMenu() { if (openMenuEl) { openMenuEl.btn.setAttribute('aria-expanded', 'false'); openMenuEl.el.remove(); openMenuEl = null; } }
  function openMenu(btn, items) {
    if (openMenuEl && openMenuEl.btn === btn) return closeMenu();
    closeMenu();
    const el = document.createElement('div');
    el.className = 'menu'; el.setAttribute('role', 'menu');
    el.innerHTML = items.map((it) => it === '-' ? '<hr>' :
      `<button type="button" role="menuitem" class="${it.danger ? 'danger' : ''}" ${it.disabled ? 'aria-disabled="true"' : ''}>${icon(it.icon)}<span>${it.label}</span>${it.chip ? `<span class="needs" style="margin-left:auto">${it.chip}</span>` : ''}</button>`).join('');
    const host = btn.closest('[data-menu-host]') || btn.parentElement;
    host.style.position = host.style.position || 'relative';
    host.appendChild(el);
    btn.setAttribute('aria-expanded', 'true');
    const btns = $$('button', el);
    btns.forEach((b, i) => {
      const it = items.filter((x) => x !== '-')[i];
      b.addEventListener('click', (e) => { e.stopPropagation(); closeMenu(); if (!it.disabled && it.run) it.run(); btn.focus(); });
    });
    el.addEventListener('keydown', (e) => {
      const i = btns.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); btns[(i + 1) % btns.length].focus(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); btns[(i - 1 + btns.length) % btns.length].focus(); }
      if (e.key === 'Escape') { closeMenu(); btn.focus(); }
    });
    openMenuEl = { el, btn };
    btns[0].focus();
  }
  function toast(msg, action) {
    const host = $('.toasts');
    const t = document.createElement('div');
    t.className = 'toast'; t.dataset.state = 'enter';
    t.innerHTML = `<span>${msg}</span>${action ? `<button class="btn sm" type="button">${action.label}</button>` : ''}<button class="btn icon sm" type="button" aria-label="Dismiss" style="border:0">${icon('x', 'sm')}</button>`;
    host.appendChild(t);
    requestAnimationFrame(() => requestAnimationFrame(() => { t.dataset.state = ''; }));
    const kill = () => { t.dataset.state = 'exit'; setTimeout(() => t.remove(), 320); };
    const bs = $$('button', t);
    if (action) bs[0].addEventListener('click', () => { action.run(); kill(); });
    bs[bs.length - 1].addEventListener('click', kill);
  }

  /* ---------------- forms (add/edit entry points) ---------------- */
  const opt = (arr, sel) => arr.map(([v, l]) => `<option value="${v}"${v === sel ? ' selected' : ''}>${esc(l)}</option>`).join('');
  const acctOpts = (sel) => opt(M.accounts.map((a) => [a.id, `${a.name} (${a.currency})`]), sel);
  const catOpts = (sel) => opt([['', 'Uncategorised'], ...M.categories.map((c) => [c.id, c.name])], sel);
  function formDrawer(kind, trigger, preset = {}) {
    const f = (id, label, ctl) => `<div class="field dstag" style="--i:${fi++}"><label for="${id}">${label}</label>${ctl}</div>`;
    let fi = 0;
    const forms = {
      transaction: () => ['New transaction', `
        ${f('f-title', 'Title', `<input class="input" id="f-title" name="title" autocomplete="off" value="${esc(preset.title || '')}">`)}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
        ${f('f-amt', 'Amount', `<input class="input num" id="f-amt" name="amount" inputmode="decimal" value="${preset.amount != null ? Math.abs(preset.amount).toFixed(2) : ''}">`)}
        ${f('f-date', 'Date', `<input class="input" type="date" id="f-date" name="date" value="${preset.date || '2026-09-25'}">`)}</div>
        <div class="field dstag" style="--i:${fi++}"><span class="label" id="dir-l">Direction</span>
          <div class="seg" role="radiogroup" aria-labelledby="dir-l"><label><input type="radio" name="dir" ${preset.amount > 0 ? '' : 'checked'}><span>${icon('down', 'sm')}Money out</span></label><label><input type="radio" name="dir" ${preset.amount > 0 ? 'checked' : ''}><span>${icon('up', 'sm')}Money in</span></label></div></div>
        ${f('f-acc', 'Account', `<select class="select" id="f-acc">${acctOpts(preset.account_id)}</select>`)}
        ${f('f-cat', 'Category', `<select class="select" id="f-cat">${catOpts(preset.category_id)}</select>`)}
        ${f('f-split', 'Split with', `<select class="select" id="f-split">${opt([['', 'Nobody'], ...M.people.map((p) => [p.id, p.name])])}</select>`)}
        ${f('f-notes', 'Notes', `<input class="input" id="f-notes" value="${esc(preset.notes || '')}">`)}`, 'Save transaction'],
      transfer: () => ['New transfer', `
        ${f('f-from', 'From account', `<select class="select" id="f-from">${acctOpts('a-main')}</select>`)}
        ${f('f-to', 'To account', `<select class="select" id="f-to">${acctOpts('a-save')}</select>`)}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
        ${f('f-out', 'Amount sent', '<input class="input num" id="f-out" inputmode="decimal" value="500.00">')}
        ${f('f-in', 'Amount received', '<input class="input num" id="f-in" inputmode="decimal" value="500.00">')}</div>
        <p class="dstag" style="--i:${fi++};color:var(--muted);font-size:12.5px;margin:4px 0 0">Unequal legs are fine: a difference is recorded as a fee or discount.</p>`, 'Create transfer'],
      import: () => ['Import CSV', `
        ${f('f-file', 'CSV file', '<input class="input" type="file" id="f-file" accept=".csv" style="padding-top:6px">')}
        ${f('f-iacc', 'Into account', `<select class="select" id="f-iacc">${acctOpts('a-main')}</select>`)}
        <p class="dstag" style="--i:${fi++};color:var(--muted);font-size:12.5px">Columns are matched on the next step. Duplicates are flagged before anything is saved.</p>`, 'Continue'],
      account: () => [preset.id ? 'Edit account' : 'New account', `
        ${f('f-aname', 'Name', `<input class="input" id="f-aname" value="${esc(preset.name || '')}">`)}
        ${f('f-atype', 'Type', `<select class="select" id="f-atype">${opt(['CHECKING', 'SAVINGS', 'CREDIT_CARD', 'INVESTMENT', 'CASH', 'DEBT', 'GIFT_CARD'].map((t) => [t, TYPE_LABEL[t]]), preset.account_type)}</select>`)}
        ${f('f-acur', 'Currency', `<select class="select" id="f-acur">${opt(['EUR', 'GBP', 'INR', 'USD'].map((c) => [c, c]), preset.currency || 'EUR')}</select>`)}
        ${f('f-abal', 'Opening balance', `<input class="input num" id="f-abal" inputmode="decimal" value="${preset.balance != null ? preset.balance.toFixed(2) : ''}">`)}`, preset.id ? 'Save changes' : 'Create account'],
      connect: () => ['Connect a provider', `
        <p class="dstag" style="--i:${fi++};margin-top:0;color:var(--muted)">Link a bank or broker. Balances and transactions sync in the background worker.</p>
        <ul class="rows dstag" style="--i:${fi++}">
          <li><span class="l"><span class="cat-ico" style="--c:#2F9BBF">${icon('bank')}</span><span><span class="name" style="display:block">TrueLayer</span><span class="meta">UK and EU open banking</span></span></span><button class="btn sm" type="button">Connect</button></li>
          <li><span class="l"><span class="cat-ico" style="--c:#3FA672">${icon('reports')}</span><span><span class="name" style="display:block">Trading 212</span><span class="meta">Portfolio via API key</span></span></span><button class="btn sm" type="button">Connect</button></li></ul>`, ''],
      budget: () => [preset.id ? 'Edit budget' : 'New budget', `
        ${f('f-bname', 'Name', `<input class="input" id="f-bname" value="${esc(preset.name || '')}">`)}
        ${f('f-bcat', 'Category', `<select class="select" id="f-bcat">${catOpts(preset.category_id)}</select>`)}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
        ${f('f-bper', 'Period', `<select class="select" id="f-bper">${opt(['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY'].map((p) => [p, p[0] + p.slice(1).toLowerCase()]), preset.period || 'MONTHLY')}</select>`)}
        ${f('f-blim', 'Limit', `<input class="input num" id="f-blim" inputmode="decimal" value="${preset.limit != null ? preset.limit.toFixed(2) : ''}">`)}</div>`, preset.id ? 'Save changes' : 'Create budget'],
    };
    const [title, body, cta] = forms[kind]();
    openDrawer({
      eyebrow: title, trigger,
      body: `<h2 class="dstag" style="--i:0;font:400 30px/1.1 var(--serif);letter-spacing:-0.03em;color:var(--ink);margin:0 0 22px">${title}</h2><form onsubmit="return false" style="display:grid;gap:16px">${body}</form>`,
      foot: cta ? `<button class="btn ghost" type="button" data-close>Cancel</button><button class="btn primary" type="button" data-save style="margin-left:auto">${cta}</button>` : '',
    });
    const s = $('[data-save]');
    if (s) s.addEventListener('click', () => { closeDrawer(); toast(`${title.replace('New ', '')} saved`); });
  }

  function wireCommon(root = document) {
    $$('[data-form]', root).forEach((b) => { if (b._w) return; b._w = 1; b.addEventListener('click', (e) => formDrawer(b.dataset.form, e.currentTarget)); });
    $$('[data-close]', root).forEach((b) => { if (b._w) return; b._w = 1; b.addEventListener('click', closeDrawer); });
    $$('.theme-btn', root).forEach((b) => { if (b._w) return; b._w = 1; b.addEventListener('click', toggleTheme); });
  }

  /* ---------------- charts ---------------- */
  const svgNS = (w, h, inner, label) => `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(label)}">${inner}</svg>`;
  const roundTop = (x, y, w, h, r) => {
    r = Math.min(r, w / 2, h);
    if (h <= 0) return '';
    return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
  };
  function tipAt(box, html, x, y) {
    let t = $('.tip', box);
    if (!t) { t = document.createElement('div'); t.className = 'tip'; t.setAttribute('aria-hidden', 'true'); box.appendChild(t); }
    t.innerHTML = html;
    const bw = box.clientWidth; const tw = 160;
    t.style.left = `${Math.min(Math.max(0, x - tw / 2), bw - tw)}px`;
    t.style.top = `${y}px`;
    t.classList.add('on');
  }

  // Net worth: 2px line in accent over a 8% flat wash, crosshair on hover
  function netWorthChart(box) {
    const w = box.clientWidth; const h = box.clientHeight || 170;
    const data = M.netWorthHistory; const labels = M.monthly.map((m) => m.m);
    const min = Math.min(...data) * 0.97; const max = Math.max(...data) * 1.01;
    const pad = 32;
    const x = (i) => pad + (i * (w - pad * 2)) / (data.length - 1);
    const y = (v) => 14 + (1 - (v - min) / (max - min)) * (h - 40);
    const pts = data.map((v, i) => [x(i), y(v)]);
    // gentle monotone-ish curve
    let d = `M${pts[0][0]},${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1]; const [x1, y1] = pts[i]; const cx = (x0 + x1) / 2;
      d += ` C${cx},${y0} ${cx},${y1} ${x1},${y1}`;
    }
    const area = `${d} L${pts[pts.length - 1][0]},${h - 22} L${pts[0][0]},${h - 22} Z`;
    const last = pts[pts.length - 1];
    const ticks = labels.map((l, i) => (i % 2 === 1 || i === labels.length - 1) ? `<text x="${x(i)}" y="${h - 6}" text-anchor="middle">${l}</text>` : '').join('');
    box.innerHTML = svgNS(w, h, `
      <line class="gridline" x1="0" x2="${w}" y1="${h - 22}" y2="${h - 22}"/>
      <path class="nw-area" d="${area}" fill="var(--accent)" fill-opacity="0.07"/>
      <path class="nw-line" d="${d}" pathLength="1" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="stroke-dasharray:1"/>
      <g class="axis">${ticks}</g>
      <line class="xhair" y1="8" y2="${h - 22}" x1="0" x2="0"/>
      <circle class="nw-hover" r="4.5" cx="-20" cy="-20" fill="var(--accent)" stroke="var(--surface)" stroke-width="2"/>
      <circle class="nw-end" cx="${last[0]}" cy="${last[1]}" r="4.5" fill="var(--accent)" stroke="var(--surface)" stroke-width="2"/>
      <rect class="hit" x="0" y="0" width="${w}" height="${h}" fill="transparent"/>`,
      `Net worth over 12 months, from ${fmt(data[0])} in ${labels[0]} to ${fmt(data[data.length - 1])} in ${labels[labels.length - 1]}`);
    anim($('.nw-line', box), [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 1600, delay: 300 });
    anim($('.nw-area', box), [{ clipPath: 'inset(0 100% 0 0)', opacity: 0 }, { clipPath: 'inset(0 0 0 0)', opacity: 1 }], { duration: 1600, delay: 300 });
    anim($('.nw-end', box), [{ opacity: 0, transform: 'scale(0.4)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 400, delay: 1700 });
    $('.nw-end', box).style.transformBox = 'fill-box'; $('.nw-end', box).style.transformOrigin = 'center';
    const hit = $('.hit', box); const xh = $('.xhair', box); const hv = $('.nw-hover', box);
    hit.addEventListener('pointermove', (e) => {
      const r = box.getBoundingClientRect(); const px = e.clientX - r.left;
      const i = Math.max(0, Math.min(data.length - 1, Math.round(((px - pad) / (w - pad * 2)) * (data.length - 1))));
      xh.setAttribute('x1', pts[i][0]); xh.setAttribute('x2', pts[i][0]); xh.classList.add('on');
      hv.setAttribute('cx', pts[i][0]); hv.setAttribute('cy', pts[i][1]);
      tipAt(box, `<b>${labels[i]} ${i >= 3 ? 2026 : 2025}</b><div><span>Net worth</span><span>${fmt(data[i])}</span></div>`, pts[i][0], Math.max(0, pts[i][1] - 70));
    });
    hit.addEventListener('pointerleave', () => { xh.classList.remove('on'); hv.setAttribute('cx', -20); const t = $('.tip', box); if (t) t.classList.remove('on'); });
  }

  // Income vs spend: paired columns, one axis, hover per month
  function incomeSpendChart(box) {
    const w = box.clientWidth; const h = 220; const L = 40; const B = 24; const T = 8;
    const data = M.monthly; const max = 8000;
    const band = (w - L) / data.length;
    const bw = Math.max(4, Math.min(10, band * 0.3));
    const y = (v) => T + (1 - v / max) * (h - T - B);
    let bars = '';
    data.forEach((m, i) => {
      const cx = L + band * i + band / 2;
      bars += `<path class="gy" style="--i:${i}" d="${roundTop(cx - bw - 1, y(m.income), bw, h - B - y(m.income), 3)}" fill="var(--series-income)"/>`;
      bars += `<path class="gy" style="--i:${i}" d="${roundTop(cx + 1, y(m.spend), bw, h - B - y(m.spend), 3)}" fill="var(--series-spend)"/>`;
    });
    if (!firstPaint || reduce()) bars = bars.replace(/class="gy"/g, '');
    const grid = [0, 2000, 4000, 6000, 8000].map((v) => `<line class="gridline" x1="${L}" x2="${w}" y1="${y(v)}" y2="${y(v)}"/><text x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${v ? compact(v).replace('.0', '') : '0'}</text>`).join('');
    const labels = data.map((m, i) => `<text x="${L + band * i + band / 2}" y="${h - 6}" text-anchor="middle">${m.m}</text>`).join('');
    const hits = data.map((m, i) => `<rect data-i="${i}" x="${L + band * i}" y="0" width="${band}" height="${h - B}" fill="transparent"/>`).join('');
    const avg = data.reduce((s, m) => s + (m.income - m.spend), 0) / data.length;
    box.innerHTML = svgNS(w, h, `<g class="axis">${grid}${labels}</g>${bars}<g class="hits">${hits}</g>`,
      `Income and spending by month for the last 12 months. Average monthly surplus ${fmt(avg)}.`);
    $$('.hits rect', box).forEach((r) => {
      r.addEventListener('pointerenter', () => {
        const m = data[+r.dataset.i];
        tipAt(box, `<b>${m.m}</b><div><span>Income</span><span>${signed(m.income)}</span></div><div><span>Spent</span><span>${signed(-m.spend)}</span></div><div><span>Net</span><span>${signed(m.income - m.spend)}</span></div>`,
          L + band * (+r.dataset.i) + band / 2, 0);
        r.setAttribute('fill', 'var(--grid)'); r.setAttribute('fill-opacity', '0.5');
      });
      r.addEventListener('pointerleave', () => { r.setAttribute('fill', 'transparent'); const t = $('.tip', box); if (t) t.classList.remove('on'); });
    });
  }

  // ring svg with animated stroke-dashoffset
  function ringSVG(p, color, size = 56, stroke = 5) {
    const r = (size - stroke) / 2; const c = 2 * Math.PI * r;
    const off = c * (1 - Math.min(1, p / 100));
    return `<svg viewBox="0 0 ${size} ${size}" aria-hidden="true"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--grid)" stroke-width="${stroke}"/>
      <circle class="ring-fill" data-c="${c}" data-off="${off}" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${off}"/></svg>`;
  }
  function animateRings(root) {
    $$('.ring-fill', root).forEach((el, i) => anim(el, [{ strokeDashoffset: el.dataset.c }, { strokeDashoffset: el.dataset.off }], { duration: 1200, delay: 350 + i * 90 }));
  }

  /* ---------------- derived data ---------------- */
  const TYPE_LABEL = { CHECKING: 'Checking', SAVINGS: 'Savings', CREDIT_CARD: 'Credit card', INVESTMENT: 'Investment', CASH: 'Cash', DEBT: 'Debt', GIFT_CARD: 'Gift card' };
  const isLiab = (a) => a.account_type === 'CREDIT_CARD' || a.account_type === 'DEBT';
  const assets = M.accounts.filter((a) => !isLiab(a));
  const liabs = M.accounts.filter(isLiab);
  const sumEur = (arr) => arr.reduce((s, a) => s + M.toEur(a), 0);
  const assetTotal = sumEur(assets); const liabTotal = sumEur(liabs);
  const status = (b) => { const p = (b.spent / b.limit) * 100; return p > 100 ? 'EXCEEDED' : p >= 80 ? 'WARNING' : 'OK'; };
  const STATUS = {
    OK: { chip: 'green', label: 'OK', icon: 'check', color: 'var(--ink)' },
    WARNING: { chip: 'yellow', label: 'Warning', icon: 'alert', color: 'var(--chip-yellow-fg)' },
    EXCEEDED: { chip: 'red', label: 'Exceeded', icon: 'x', color: 'var(--neg)' },
  };
  const statusChip = (b) => { const s = STATUS[status(b)]; return `<span class="chip ${s.chip}">${icon(s.icon)}${s.label}</span>`; };
  function budgetPace(b) {
    const s = parseD(b.start); const e = parseD(b.end);
    const total = daysBetween(s, e) + 1; const elapsed = Math.min(total, daysBetween(s, TODAY) + 1);
    const expected = (elapsed / total) * 100; const used = (b.spent / b.limit) * 100;
    const left = Math.max(0, daysBetween(TODAY, e));
    let pace = used > 100 ? 'Over limit' : used > expected + 5 ? 'Ahead of pace' : 'On track';
    return { expected, used, left, pace, total, elapsed };
  }
  const catIco = (t) => {
    const c = t.category_id ? M.cat(t.category_id) : null;
    if (t.transfer) return `<span class="cat-ico" style="--c:#6F6D68">${icon('transfer')}</span>`;
    if (!c) return `<span class="cat-ico" style="--c:#6F6D68">${icon('coins')}</span>`;
    return `<span class="cat-ico" style="--c:${c.color}">${icon(c.icon)}</span>`;
  };
  const catName = (t) => t.transfer ? 'Transfer' : (t.category_id ? M.cat(t.category_id).name : 'Uncategorised');
  function amountHTML(t) {
    const cur = txCur(t);
    const main = `<span class="a ${t.amount > 0 ? 'pos' : ''}">${signed(t.amount, cur)}</span>`;
    const eur = cur !== 'EUR' ? `<span class="eur">${signed(txEur(t))}</span>` : '';
    return `<div class="tx-amt">${main}${eur}</div>`;
  }
  function badges(t) {
    const b = [];
    if (t.splits) t.splits.forEach((s) => b.push(`<span class="chip blue lower">${icon('split')}Split with ${esc(s.person)}</span>`));
    if (t.transfer) b.push(`<span class="chip lower">${icon('link')}Transfer, ${esc(t.transfer.linked)}</span>`);
    if (t.debt) b.push(`<span class="chip yellow lower">${icon('receipt')}Paid by ${esc(t.debt.paidBy)}</span>`);
    if (t.recurring) b.push(`<span class="chip lower">${icon('repeat')}Recurring</span>`);
    if (t.notes) b.push(`<span class="chip lower" title="${esc(t.notes)}">${icon('note')}Note</span>`);
    if (txCur(t) !== 'EUR') b.push(`<span class="chip lower">${icon('globe')}${txCur(t)}</span>`);
    return b.join('');
  }

  /* ================================================================ */
  /* DASHBOARD                                                         */
  /* ================================================================ */
  function dashboard() {
    const nw = M.netWorth; const first = M.netWorthHistory[0];
    const sep = M.monthly[M.monthly.length - 1];
    const topB = [...M.budgets].sort((a, b) => b.spent / b.limit - a.spent / a.limit);
    const groups = [
      ['Checking', ['CHECKING']], ['Savings', ['SAVINGS']], ['Investments', ['INVESTMENT']], ['Cash and gift cards', ['CASH', 'GIFT_CARD']],
    ];
    const liabGroups = [['Credit cards', ['CREDIT_CARD']], ['Debt', ['DEBT']]];
    const grpRow = ([label, types]) => {
      const accs = M.accounts.filter((a) => types.includes(a.account_type));
      return `<li><span class="l"><span class="name">${label}</span><span class="meta">${accs.length} ${accs.length === 1 ? 'account' : 'accounts'}</span></span><span class="v">${fmt(sumEur(accs))}</span></li>`;
    };
    const owed = M.people.filter((p) => p.owes_me > 0); const iowe = M.people.filter((p) => p.i_owe > 0);
    const netDebt = M.people.reduce((s, p) => s + p.owes_me - p.i_owe, 0);
    const recent = M.transactions.slice(0, 7);
    const brk = M.categoryBreakdown;
    const totalSpend = brk.reduce((s, c) => s + c.total, 0);
    const colorOf = (c) => c.category_id === 'other' ? 'var(--series-spend)' : `color-mix(in oklab, ${M.cat(c.category_id).color} 78%, var(--surface))`;
    const nameOf = (c) => c.category_id === 'other' ? 'Everything else' : M.cat(c.category_id).name;
    // donut geometry
    const R = 80; const C = 2 * Math.PI * R; let acc = 0;
    const gap = 3;
    const segs = brk.map((c, i) => {
      const len = (c.total / totalSpend) * C; const s = `<circle class="seg-arc" data-len="${Math.max(0, len - gap)}" cx="100" cy="100" r="${R}" fill="none" stroke="${colorOf(c)}" stroke-width="18" stroke-dasharray="${Math.max(0, len - gap)} ${C}" stroke-dashoffset="${-acc}" style="--i:${i}"/>`;
      acc += len; return s;
    }).join('');
    const topCats = brk.filter((c) => c.category_id !== 'other').slice(0, 5);
    const txCount = (cid) => M.transactions.filter((t) => t.category_id === cid).length;

    const html = `
    ${topbar('Friday, September 25', 'Good evening, <em>Abhijeet</em>', quickActions())}
    <div class="bento">
      <section class="card hero span-8${rv(1)}" aria-labelledby="nw-h">
        <div class="hero-top">
          <div><h2 id="nw-h" class="eyebrow" style="margin-bottom:14px">Net worth</h2>
            <div class="fig xl" data-count="${nw}" aria-label="${fmt(nw)}">${figHTML(nw)}</div></div>
          <span class="needs" title="Net worth history has no backend route yet">Needs backend</span>
        </div>
        <div class="hero-meta"><span class="delta pos">${icon('up', 'sm')}${signed(nw - first)}</span><span>since October 2025, ${pct(((nw - first) / first) * 100, 1)} up</span><span class="dotsep" aria-hidden="true"></span><span>${M.accounts.length} accounts in 3 currencies</span></div>
        <div class="hero-chart chart-box" data-chart="nw" style="height:170px"></div>
      </section>

      <section class="card span-4${rv(2)}" aria-labelledby="m-h">
        <div class="card-head"><h2 id="m-h">September so far</h2><span class="sub">6 days left</span></div>
        <ul class="rows">
          <li><span class="l"><span class="delta pos">${icon('up', 'sm')}</span><span class="name">Income</span></span><span class="v fig sm pos">${figHTML(sep.income, 'EUR', { sign: true })}</span></li>
          <li><span class="l"><span class="delta" style="color:var(--muted)">${icon('down', 'sm')}</span><span class="name">Spent</span></span><span class="v fig sm">${figHTML(-sep.spend, 'EUR', { sign: true })}</span></li>
          <li><span class="l"><span class="delta" style="color:var(--muted)">${icon('coins', 'sm')}</span><span class="name">Kept</span></span><span class="v fig sm">${figHTML(sep.income - sep.spend, 'EUR', { sign: true })}</span></li>
        </ul>
        <p style="margin:12px 0 0;color:var(--muted);font-size:12.5px">You kept ${pct(((sep.income - sep.spend) / sep.income) * 100)} of income this month.</p>
        <div class="qa">
          <button class="btn primary" type="button" data-form="transaction">${icon('plus')}Add transaction<kbd style="color:inherit;background:transparent;border-color:rgba(127,127,127,.4)">N</kbd></button>
          <button class="btn" type="button" data-form="transfer">${icon('transfer')}Transfer between accounts</button>
          <button class="btn" type="button" data-form="import">${icon('import')}Import a CSV statement</button>
        </div>
      </section>

      <section class="card span-5${rv(3)}" aria-labelledby="acc-h">
        <div class="card-head"><h2 id="acc-h">Accounts</h2><a class="link" href="accounts.html">All accounts</a></div>
        <div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px">
          <div><div class="stat-label">Assets</div><div class="fig md">${figHTML(assetTotal)}</div></div>
          <div style="text-align:right"><div class="stat-label" style="justify-content:flex-end">Liabilities</div><div class="fig md neg">${figHTML(liabTotal)}</div></div>
        </div>
        <div class="balance-bar" role="img" aria-label="Assets ${fmt(assetTotal)}, liabilities ${fmt(liabTotal)}">
          <span class="gx" style="--i:0;flex:${assetTotal};background:var(--ink)"></span><span class="gx" style="--i:1;flex:${-liabTotal};background:var(--neg)"></span>
        </div>
        <div class="group-label"><span>Assets</span></div>
        <ul class="rows">${groups.map(grpRow).join('')}</ul>
        <div class="group-label"><span>Liabilities</span></div>
        <ul class="rows">${liabGroups.map(([l, t]) => grpRow([l, t]).replace('class="v"', 'class="v neg"')).join('')}</ul>
      </section>

      <section class="card span-4${rv(4)}" aria-labelledby="b-h">
        <div class="card-head"><h2 id="b-h">Budgets</h2><a class="link" href="budgets.html">All budgets</a></div>
        <div class="ring-grid">
          ${topB.map((b) => { const p = (b.spent / b.limit) * 100; return `<div class="ring-item"><div class="ring">${ringSVG(p, STATUS[status(b)].color)}<span class="pct">${Math.round(p)}%</span></div>
            <div style="min-width:0"><div class="n">${esc(b.name)}</div><div class="m">${fmt(b.spent)} of ${fmt(b.limit, 'EUR', {})}</div><div style="margin-top:6px">${statusChip(b)}</div></div></div>`; }).join('')}
        </div>
        <p style="margin:22px 0 0;padding-top:14px;border-top:1px solid var(--line);color:var(--muted);font-size:12.5px">${M.budgets.filter((b) => status(b) === 'EXCEEDED').length} over, ${M.budgets.filter((b) => status(b) === 'WARNING').length} close to the limit, ${M.budgets.filter((b) => status(b) === 'OK').length} comfortable.</p>
      </section>

      <section class="card span-3${rv(5)}" aria-labelledby="d-h">
        <div class="card-head"><h2 id="d-h">Debts</h2><a class="link" href="#" aria-disabled="true">People</a></div>
        <div class="stat-label">Net, in your favour</div>
        <div class="fig md pos" style="margin-bottom:10px">${figHTML(netDebt, 'EUR', { sign: true })}</div>
        <div class="group-label"><span>Owed to you</span></div>
        ${owed.map((p) => `<div class="person"><span class="avatar" style="background:var(--chip-green-bg);color:var(--chip-green-fg)" aria-hidden="true">${initials(p.name)}</span><span style="flex:1;color:var(--ink);font-weight:500">${p.name}</span><span class="num pos">${signed(p.owes_me)}</span></div>`).join('')}
        <div class="group-label" style="margin-top:12px"><span>You owe</span></div>
        ${iowe.map((p) => `<div class="person"><span class="avatar" style="background:var(--chip-red-bg);color:var(--chip-red-fg)" aria-hidden="true">${initials(p.name)}</span><span style="flex:1;color:var(--ink);font-weight:500">${p.name}</span><span class="num neg">${signed(-p.i_owe)}</span></div>`).join('')}
      </section>

      <section class="card span-6${rv(6)}" aria-labelledby="c-h">
        <div class="card-head"><h2 id="c-h">Spending by category</h2><span class="sub">September</span></div>
        <div class="donut-wrap">
          <div class="donut">${`<svg viewBox="0 0 200 200" role="img" aria-label="Spending by category in September: ${brk.map((c) => `${nameOf(c)} ${pct(c.percentage, 1)}`).join(', ')}">${segs}</svg>`}
            <div class="donut-center"><div class="stat-label" style="justify-content:center">Spent</div><div class="fig md">${figHTML(totalSpend)}</div></div></div>
          <ul class="rows" style="width:100%">${brk.map((c) => `<li><span class="l"><span class="dot" style="background:${colorOf(c)}"></span><span class="name">${nameOf(c)}</span></span><span class="v">${fmt(c.total)} <span style="color:var(--muted);display:inline-block;min-width:3.4em">${pct(c.percentage, 1)}</span></span></li>`).join('')}</ul>
        </div>
      </section>

      <section class="card span-6${rv(7)}" aria-labelledby="is-h">
        <div class="card-head"><h2 id="is-h">Income and spending</h2><div class="right"><span class="needs" title="Monthly trend has no route yet">Needs backend</span></div></div>
        <div class="legend" style="margin-bottom:10px"><span><i style="background:var(--series-income)"></i>Income</span><span><i style="background:var(--series-spend)"></i>Spent</span><span style="margin-left:auto">Last 12 months</span></div>
        <div class="chart-box" data-chart="is"></div>
      </section>

      <section class="card span-8${rv(8)}" aria-labelledby="r-h">
        <div class="card-head"><h2 id="r-h">Recent transactions</h2><a class="link" href="transactions.html">See all ${icon('chevR', 'sm')}</a></div>
        <div>${recent.map((t) => `<div class="tx">${catIco(t)}<div class="tx-main"><div class="tx-title">${esc(t.title)}</div><div class="tx-sub"><span>${catName(t)}</span><span class="sep"></span><span>${esc(M.acct(t.account_id).name)}</span><span class="sep"></span><span>${shortDate(parseD(t.date))}</span></div></div>${amountHTML(t)}</div>`).join('')}</div>
      </section>

      <section class="card span-4${rv(9)}" aria-labelledby="tc-h">
        <div class="card-head"><h2 id="tc-h">Top spending categories</h2><span class="sub">September</span></div>
        <ol class="rows rank" style="counter-reset:r">${topCats.map((c, i) => `<li><span class="l"><span class="fig sm" style="color:var(--faint);width:1.1em">${i + 1}</span><span><span class="name" style="display:block">${nameOf(c)}</span><span class="meta">${txCount(c.category_id)} ${txCount(c.category_id) === 1 ? 'transaction' : 'transactions'}</span></span></span><span class="v">${fmt(c.total)}</span>
          <span class="bar"><i class="gx" style="--i:${i};width:${(c.total / topCats[0].total) * 100}%;background:${colorOf(c)}"></i></span></li>`).join('')}</ol>
      </section>
    </div>`;
    return html;
  }
  function afterDashboard() {
    const el = $('[data-count]'); countUp(el, +el.dataset.count);
    netWorthChart($('[data-chart="nw"]'));
    incomeSpendChart($('[data-chart="is"]'));
    animateRings(document);
    $$('.seg-arc').forEach((s, i) => anim(s, [{ strokeDasharray: `0 ${2 * Math.PI * 80}` }, { strokeDasharray: `${s.dataset.len} ${2 * Math.PI * 80}` }], { duration: 900, delay: 450 + i * 110 }));
  }

  /* ================================================================ */
  /* TRANSACTIONS                                                      */
  /* ================================================================ */
  const TX = { items: M.transactions.map((t) => ({ ...t })), filters: { q: '', account: '', category: '', person: '', from: '', to: '', min: '', max: '', sign: 'all', splits: false, transfer: false }, state: params.get('state') || 'data', selected: new Set(), expanded: new Set(), panel: params.get('filters') === '1' };
  function txFiltered() {
    const f = TX.filters;
    return TX.items.filter((t) => {
      if (f.q && !(`${t.title} ${t.notes || ''}`.toLowerCase().includes(f.q.toLowerCase()))) return false;
      if (f.account && t.account_id !== f.account) return false;
      if (f.category && t.category_id !== f.category) return false;
      if (f.person && !((t.splits || []).some((s) => s.person === f.person) || (t.debt && t.debt.paidBy === f.person))) return false;
      if (f.from && t.date < f.from) return false;
      if (f.to && t.date > f.to) return false;
      const a = Math.abs(txEur(t));
      if (f.min !== '' && a < +f.min) return false;
      if (f.max !== '' && a > +f.max) return false;
      if (f.sign === 'in' && t.amount < 0) return false;
      if (f.sign === 'out' && t.amount > 0) return false;
      if (f.splits && !t.splits) return false;
      if (f.transfer && !t.transfer) return false;
      return true;
    });
  }
  function transactions() {
    const sep = M.monthly[M.monthly.length - 1];
    const f = TX.filters;
    return `
    ${topbar('Ledger', 'Transactions', quickActions())}
    <section class="card month-bar${rv(1)}" aria-label="Month summary">
      <div class="month-nav">
        <button class="btn icon" type="button" aria-label="Previous month, August 2026">${icon('chevL')}</button>
        <h2 aria-live="polite">September <em>2026</em></h2>
        <button class="btn icon" type="button" aria-label="Next month, October 2026" disabled>${icon('chevR')}</button>
      </div>
      <div class="month-sum">
        <div><div class="stat-label">${icon('up', 'sm')}Income</div><div class="fig sm pos">${figHTML(sep.income, 'EUR', { sign: true })}</div></div>
        <div><div class="stat-label">${icon('down', 'sm')}Spent</div><div class="fig sm">${figHTML(-sep.spend, 'EUR', { sign: true })}</div></div>
        <div><div class="stat-label">${icon('coins', 'sm')}Net</div><div class="fig sm">${figHTML(sep.income - sep.spend, 'EUR', { sign: true })}</div></div>
      </div>
    </section>
    <div class="${firstPaint ? 'rv' : ''}" style="--i:2">
      <div class="toolbar">
        <div class="field"><label for="q">Search title and notes</label>
          <div class="input-icon">${icon('search', 'sm')}<input class="input" id="q" type="search" autocomplete="off" value="${esc(f.q)}"><kbd>/</kbd></div></div>
        <div class="field seg-wrap"><span class="label" id="sign-l">Direction</span>
          <div class="seg" role="radiogroup" aria-labelledby="sign-l">
            ${[['all', 'All'], ['in', 'Money in'], ['out', 'Money out']].map(([v, l]) => `<label><input type="radio" name="sign" value="${v}" ${f.sign === v ? 'checked' : ''}><span>${l}</span></label>`).join('')}
          </div></div>
        <button class="btn" type="button" data-panel aria-expanded="${TX.panel}" aria-controls="fpanel">${icon('filter')}Filters<span class="num" data-fcount></span></button>
      </div>
      <div class="card filters-panel ${TX.panel ? 'open' : ''}" id="fpanel">
        <div class="field"><label for="f-account">Account</label><select class="select" id="f-account" data-f="account">${opt([['', 'Any account'], ...M.accounts.map((a) => [a.id, a.name])], f.account)}</select></div>
        <div class="field"><label for="f-category">Category</label><select class="select" id="f-category" data-f="category">${opt([['', 'Any category'], ...M.categories.map((c) => [c.id, c.name])], f.category)}</select></div>
        <div class="field"><label for="f-person">Person</label><select class="select" id="f-person" data-f="person">${opt([['', 'Anyone'], ...M.people.map((p) => [p.name, p.name])], f.person)}</select></div>
        <div class="field"><span class="label">Date range</span><div class="range"><label class="sr-only" for="f-from">From</label><input class="input" type="date" id="f-from" data-f="from" value="${f.from}" min="2026-09-01" max="2026-09-30"><label class="sr-only" for="f-to">To</label><input class="input" type="date" id="f-to" data-f="to" value="${f.to}" min="2026-09-01" max="2026-09-30"></div></div>
        <div class="field"><label for="f-min">Min amount, EUR</label><input class="input num" id="f-min" data-f="min" inputmode="decimal" value="${f.min}"></div>
        <div class="field"><label for="f-max">Max amount, EUR</label><input class="input num" id="f-max" data-f="max" inputmode="decimal" value="${f.max}"></div>
        <div class="toggles" style="grid-column:span 2">
          <label class="check"><input type="checkbox" data-f="splits" ${f.splits ? 'checked' : ''}>Has splits</label>
          <label class="check"><input type="checkbox" data-f="transfer" ${f.transfer ? 'checked' : ''}>In a transfer</label>
          <button class="btn ghost sm" type="button" data-clear style="margin-left:auto">Clear all</button>
        </div>
      </div>
      <div class="active-filters" data-active aria-live="polite"></div>
    </div>
    <div class="list-head${rv(3)}">
      <div class="count" data-count-line></div>
      <div class="state-switch"><span class="lbl" id="st-l">Mock state</span>
        <div class="seg" role="radiogroup" aria-labelledby="st-l">${[['data', 'Data'], ['loading', 'Loading'], ['empty', 'Empty'], ['error', 'Error']].map(([v, l]) => `<label><input type="radio" name="mstate" value="${v}" ${TX.state === v ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div></div>
    </div>
    <div data-list></div>
    <div class="bulk" data-bulk role="region" aria-label="Bulk actions"><b data-bulk-n>0</b><span>selected</span>
      <button class="btn sm" type="button" data-bulk-cat>${icon('categories', 'sm')}Set category</button>
      <button class="btn sm" type="button" data-bulk-del>${icon('trash', 'sm')}Delete</button>
      <button class="btn icon sm" type="button" aria-label="Clear selection" data-bulk-clear>${icon('x', 'sm')}</button></div>`;
  }
  function skeletonRows(n) {
    return Array.from({ length: n }, () => `<div class="txr" aria-hidden="true"><span></span><span class="skel" style="width:36px;height:36px;border-radius:9px"></span><span><span class="skel" style="display:block;width:46%;height:12px"></span><span class="skel" style="display:block;width:28%;height:10px;margin-top:8px"></span></span><span class="skel" style="width:70px;height:12px"></span><span></span></div>`).join('');
  }
  function txRow(t, i, animate) {
    const a = M.acct(t.account_id);
    const expandable = t.splits || t.notes || t.transfer || t.debt || t.recurring;
    return `<div class="txr${TX.selected.has(t.id) ? ' selected' : ''}${animate ? ' rv' : ''}" style="--i:${Math.min(i, 12) + 4}" data-row="${t.id}" data-menu-host>
      <label class="check"><input type="checkbox" data-sel="${t.id}" ${TX.selected.has(t.id) ? 'checked' : ''} aria-label="Select ${esc(t.title)}"></label>
      ${catIco(t)}
      <button class="open" type="button" data-open="${t.id}" aria-label="Open ${esc(t.title)}, ${signed(t.amount, txCur(t))}">
        <span class="tx-title" style="display:block">${esc(t.title)}</span>
        <span class="tx-sub"><span>${catName(t)}</span><span class="sep"></span><span>${esc(a.name)}</span></span>
        ${badges(t) ? `<span class="badges">${badges(t)}</span>` : ''}
      </button>
      ${amountHTML(t)}
      <div class="row-actions">
        ${expandable ? `<button class="btn icon ghost sm exp-btn" type="button" aria-expanded="${TX.expanded.has(t.id)}" aria-controls="exp-${t.id}" aria-label="Details for ${esc(t.title)}" data-exp="${t.id}">${icon('chevD', 'sm')}</button>` : '<span style="width:30px"></span>'}
        <button class="btn icon ghost sm" type="button" aria-haspopup="menu" aria-expanded="false" aria-label="Actions for ${esc(t.title)}" data-more-row="${t.id}">${icon('more')}</button>
      </div>
    </div>
    ${expandable ? `<div class="row-exp" id="exp-${t.id}" ${TX.expanded.has(t.id) ? '' : 'hidden'}><div class="inner">
      ${t.splits ? t.splits.map((s) => `<div><b>${esc(s.person)} owes you ${fmt(s.amount, txCur(t))}</b>Your share ${fmt(Math.abs(t.amount) - s.amount, txCur(t))}</div>`).join('') : ''}
      ${t.debt ? `<div><b>${esc(t.debt.paidBy)} paid ${fmt(t.debt.total)}</b>You owe ${esc(t.debt.paidBy)} your ${fmt(Math.abs(t.amount))} share</div>` : ''}
      ${t.transfer ? `<div><b>Linked to ${esc(t.transfer.linked)}</b>Other leg ${signed(-t.amount)}</div>` : ''}
      ${t.recurring ? '<div><b>Repeats monthly</b>Next on October ' + parseD(t.date).getDate() + '</div>' : ''}
      ${t.notes ? `<div><b>Note</b>${esc(t.notes)}</div>` : ''}
    </div></div>` : ''}`;
  }
  function renderTxList(animate = false) {
    const host = $('[data-list]');
    const items = txFiltered();
    const total = TX.state === 'data' ? 214 - (M.transactions.length - TX.items.length) : 0;
    const f = TX.filters;
    const active = [];
    const nm = { account: (v) => M.acct(v).name, category: (v) => M.cat(v).name, person: (v) => v, from: (v) => `From ${shortDate(parseD(v))}`, to: (v) => `To ${shortDate(parseD(v))}`, min: (v) => `At least ${fmt(+v)}`, max: (v) => `At most ${fmt(+v)}` };
    Object.keys(nm).forEach((k) => { if (f[k] !== '') active.push([k, nm[k](f[k])]); });
    if (f.splits) active.push(['splits', 'Has splits']);
    if (f.transfer) active.push(['transfer', 'In a transfer']);
    if (f.sign !== 'all') active.push(['sign', f.sign === 'in' ? 'Money in' : 'Money out']);
    if (f.q) active.push(['q', `Matches "${f.q}"`]);
    $('[data-active]').innerHTML = active.map(([k, l]) => `<span class="fchip">${esc(l)}<button type="button" aria-label="Remove filter ${esc(l)}" data-rm="${k}">${icon('x', 'sm')}</button></span>`).join('');
    $('[data-fcount]').textContent = active.length ? ` ${active.length}` : '';
    const filtered = active.length > 0;
    $('[data-count-line]').innerHTML = TX.state !== 'data' ? '&nbsp;' : filtered
      ? `<b>${items.length}</b> ${items.length === 1 ? 'match' : 'matches'} in September`
      : `Showing <b>${items.length}</b> of <b>${total}</b> transactions`;

    if (TX.state === 'loading') { host.innerHTML = `<div class="day"><div class="day-head"><span class="skel" style="width:180px;height:18px"></span></div>${skeletonRows(6)}</div><p class="sr-only">Loading transactions</p>`; return; }
    if (TX.state === 'error') { host.innerHTML = `<div class="error card"><div class="empty-mark">${icon('alert')}</div><h3>We could not load September</h3><p>The server did not answer in time. Nothing was lost; your filters are kept.</p><button class="btn primary" type="button" data-retry>${icon('sync')}Try again</button></div>`; return; }
    if (TX.state === 'empty' || !items.length) {
      host.innerHTML = `<div class="empty card"><div class="empty-mark">${icon(filtered ? 'search' : 'transactions')}</div><h3>${filtered ? 'Nothing matches those filters' : 'A quiet month, so far'}</h3><p>${filtered ? 'Try widening the date range or removing a filter.' : 'No transactions in September yet. Add one, or import a statement from your bank.'}</p>${filtered ? '<button class="btn" type="button" data-clear>Clear filters</button>' : `<div style="display:flex;gap:8px;justify-content:center"><button class="btn" type="button" data-form="import">${icon('import')}Import CSV</button><button class="btn primary" type="button" data-form="transaction">${icon('plus')}Add transaction</button></div>`}</div>`;
      return;
    }
    const days = {};
    items.forEach((t) => { (days[t.date] = days[t.date] || []).push(t); });
    let i = 0;
    host.innerHTML = Object.keys(days).sort().reverse().map((d) => {
      const dt = parseD(d); const sum = days[d].filter((t) => !t.transfer).reduce((s, t) => s + txEur(t), 0);
      return `<section class="day" aria-label="${dayName(dt)}, ${monthDay(dt)}"><div class="day-head${animate ? ' rv' : ''}" style="--i:${Math.min(i, 12) + 4}"><h3>${dayName(dt)} <span>${monthDay(dt)}</span></h3><span class="num">${signed(sum)}</span></div>
        ${days[d].map((t) => txRow(t, i++, animate)).join('')}</section>`;
    }).join('') + (filtered ? '' : `<div class="sentinel" data-sentinel>${skeletonRows(2).replace(/class="txr"/g, 'class="txr" style="width:100%;opacity:.6"')}<span>Loading older transactions, ${items.length} of ${total} shown</span></div>`);
    wireCommon(host);
  }
  function openTx(id, trigger) {
    const t = TX.items.find((x) => x.id === id); if (!t) return;
    const a = M.acct(t.account_id); const cur = txCur(t); const d = parseD(t.date);
    let k = 0; const st = (c = '', y = '') => `class="dstag ${c}" style="--i:${k++};${y}"`;
    openDrawer({
      eyebrow: 'Transaction', trigger,
      body: `
        <div ${st('', 'display:flex;gap:12px;align-items:center')}>${catIco(t)}<div><div style="color:var(--muted);font-size:12.5px">${catName(t)}</div><div style="color:var(--ink);font-weight:550">${esc(t.title)}</div></div></div>
        <div ${st()}><div class="fig lg ${t.amount > 0 ? 'pos' : ''}" style="margin:22px 0 4px">${figHTML(t.amount, cur, { sign: true })}</div>
          <div style="color:var(--muted);font-size:13px">${t.amount < 0 ? 'Money out' : 'Money in'}${cur !== 'EUR' ? `, ${signed(txEur(t))} at ${M.fx[cur]} EUR per ${cur}` : ''}</div></div>
        <div ${st('badges', 'margin-top:14px')}>${badges(t)}</div>
        <dl ${st('kv', 'margin-top:22px')}>
          <dt>Date</dt><dd>${dayName(d)}, ${monthDay(d)}, 2026</dd>
          <dt>Account</dt><dd>${esc(a.name)} (${a.currency})</dd>
          <dt>Category</dt><dd>${catName(t)}</dd>
          ${t.recurring ? '<dt>Repeats</dt><dd>Monthly, next October ' + d.getDate() + '</dd>' : ''}
        </dl>
        ${t.splits ? `<div ${st()}><div class="section-title">Split</div><ul class="rows">${t.splits.map((s) => `<li><span class="l"><span class="avatar" style="width:28px;height:28px;font-size:11px">${initials(s.person)}</span><span class="name">${esc(s.person)} owes you</span></span><span class="v pos">${signed(s.amount, cur)}</span></li>`).join('')}<li><span class="l"><span class="avatar" style="width:28px;height:28px;font-size:11px;background:var(--chip-gray-bg);color:var(--chip-gray-fg)">${initials(M.user.name)}</span><span class="name">Your share</span></span><span class="v">${fmt(Math.abs(t.amount) - t.splits.reduce((s, x) => s + x.amount, 0), cur)}</span></li></ul></div>` : ''}
        ${t.debt ? `<div ${st()}><div class="section-title">Paid by someone else</div><p style="margin:0">${esc(t.debt.paidBy)} paid ${fmt(t.debt.total)} in total. Your share of ${fmt(Math.abs(t.amount))} is recorded as money you owe ${esc(t.debt.paidBy)}.</p></div>` : ''}
        ${t.transfer ? `<div ${st()}><div class="section-title">Transfer</div><ul class="rows"><li><span class="l">${icon('link', 'sm')}<span class="name">${esc(a.name)}</span></span><span class="v">${signed(t.amount)}</span></li><li><span class="l">${icon('link', 'sm')}<span class="name">${esc(t.transfer.linked)}</span></span><span class="v pos">${signed(-t.amount)}</span></li></ul></div>` : ''}
        ${t.notes ? `<div ${st()}><div class="section-title">Notes</div><p class="note">${esc(t.notes)}</p></div>` : ''}`,
      foot: `<button class="btn" type="button" data-d-edit>${icon('edit', 'sm')}Edit</button><button class="btn" type="button" data-d-dup>${icon('copy', 'sm')}Duplicate</button>${t.transfer ? '' : `<button class="btn" type="button" data-d-conv>${icon('transfer', 'sm')}Convert to transfer</button>`}<button class="btn icon ghost danger" type="button" data-d-del style="margin-left:auto" aria-label="Delete transaction" title="Delete">${icon('trash', 'sm')}</button>`,
    });
    const on = (s, fn) => { const b = $(s); if (b) b.addEventListener('click', fn); };
    on('[data-d-edit]', () => { closeDrawer(); formDrawer('transaction', trigger, t); });
    on('[data-d-dup]', () => { closeDrawer(); duplicateTx(t.id); });
    on('[data-d-conv]', () => { closeDrawer(); formDrawer('transfer', trigger); });
    on('[data-d-del]', () => { closeDrawer(); deleteTx([t.id]); });
  }
  function duplicateTx(id) {
    const i = TX.items.findIndex((x) => x.id === id);
    const copy = { ...TX.items[i], id: id + '-copy' + Date.now(), date: '2026-09-25' };
    TX.items.unshift(copy); renderTxList(); toast(`Duplicated ${esc(copy.title)}`);
  }
  function deleteTx(ids) {
    const removed = ids.map((id) => [TX.items.findIndex((x) => x.id === id), TX.items.find((x) => x.id === id)]).filter((r) => r[1]);
    const finish = () => {
      TX.items = TX.items.filter((x) => !ids.includes(x.id)); ids.forEach((id) => TX.selected.delete(id));
      renderTxList(); updateBulk();
      toast(`${removed.length === 1 ? esc(removed[0][1].title) : removed.length + ' transactions'} moved to Trash`, {
        label: 'Undo', run: () => { removed.sort((a, b) => a[0] - b[0]).forEach(([idx, t]) => TX.items.splice(idx, 0, t)); renderTxList(); },
      });
    };
    const rows = ids.map((id) => $(`[data-row="${id}"]`)).filter(Boolean);
    if (reduce() || !rows.length) return finish();
    rows.forEach((r) => r.classList.add('removing'));
    setTimeout(finish, 280);
  }
  function updateBulk() {
    const n = TX.selected.size;
    $('[data-bulk]').classList.toggle('on', n > 0);
    $('[data-bulk-n]').textContent = n;
  }
  function afterTransactions() {
    renderTxList(true);
    const f = TX.filters;
    $('#q').addEventListener('input', (e) => { f.q = e.target.value; renderTxList(); });
    document.addEventListener('keydown', (e) => { if (e.key === '/' && document.activeElement.tagName !== 'INPUT') { e.preventDefault(); $('#q').focus(); } });
    $$('input[name="sign"]').forEach((r) => r.addEventListener('change', () => { f.sign = r.value; renderTxList(); }));
    $$('input[name="mstate"]').forEach((r) => r.addEventListener('change', () => { TX.state = r.value; renderTxList(); }));
    $$('[data-f]').forEach((el) => el.addEventListener(el.type === 'checkbox' ? 'change' : 'input', () => { f[el.dataset.f] = el.type === 'checkbox' ? el.checked : el.value; renderTxList(); }));
    $('[data-panel]').addEventListener('click', (e) => { TX.panel = !TX.panel; $('#fpanel').classList.toggle('open', TX.panel); e.currentTarget.setAttribute('aria-expanded', TX.panel); });
    const clear = () => { Object.assign(f, { q: '', account: '', category: '', person: '', from: '', to: '', min: '', max: '', sign: 'all', splits: false, transfer: false }); $('#q').value = ''; $$('[data-f]').forEach((el) => { if (el.type === 'checkbox') el.checked = false; else el.value = ''; }); $('input[name="sign"][value="all"]').checked = true; renderTxList(); };
    document.addEventListener('click', (e) => {
      const t = e.target.closest('button, input'); if (!t) return;
      if (t.dataset.clear !== undefined) return clear();
      if (t.dataset.retry !== undefined) { TX.state = 'loading'; renderTxList(); setTimeout(() => { TX.state = 'data'; $('input[name="mstate"][value="data"]').checked = true; renderTxList(); }, 900); return; }
      if (t.dataset.rm) { const k = t.dataset.rm; if (k === 'splits' || k === 'transfer') f[k] = false; else if (k === 'sign') { f.sign = 'all'; $('input[name="sign"][value="all"]').checked = true; } else f[k] = ''; const el = $(`[data-f="${k}"]`); if (el) { if (el.type === 'checkbox') el.checked = false; else el.value = ''; } if (k === 'q') $('#q').value = ''; return renderTxList(); }
      if (t.dataset.open) return openTx(t.dataset.open, t);
      if (t.dataset.sel) { t.checked ? TX.selected.add(t.dataset.sel) : TX.selected.delete(t.dataset.sel); t.closest('.txr').classList.toggle('selected', t.checked); return updateBulk(); }
      if (t.dataset.exp) {
        const id = t.dataset.exp; const panel = $(`#exp-${id}`); const open = panel.hidden;
        panel.hidden = !open; t.setAttribute('aria-expanded', open);
        open ? TX.expanded.add(id) : TX.expanded.delete(id);
        panel.classList.toggle('anim', open && !reduce()); return;
      }
      if (t.dataset.moreRow) {
        e.stopPropagation(); const id = t.dataset.moreRow; const tx = TX.items.find((x) => x.id === id);
        return openMenu(t, [
          { icon: 'edit', label: 'Edit', run: () => formDrawer('transaction', t, tx) },
          { icon: 'copy', label: 'Duplicate', run: () => duplicateTx(id) },
          { icon: 'transfer', label: 'Convert to transfer', run: () => formDrawer('transfer', t) },
          '-',
          { icon: 'trash', label: 'Delete', danger: true, run: () => deleteTx([id]) },
        ]);
      }
    });
    $('[data-bulk-clear]').addEventListener('click', () => { TX.selected.clear(); $$('[data-sel]').forEach((c) => { c.checked = false; c.closest('.txr').classList.remove('selected'); }); updateBulk(); });
    $('[data-bulk-del]').addEventListener('click', () => deleteTx([...TX.selected]));
    $('[data-bulk-cat]').addEventListener('click', () => toast(`Category set on ${TX.selected.size} transactions`));
    if (params.get('open')) setTimeout(() => openTx(params.get('open'), $(`[data-open="${params.get('open')}"]`)), reduce() ? 0 : 700);
    if (params.get('select')) { params.get('select').split(',').forEach((id) => TX.selected.add(id)); renderTxList(); updateBulk(); }
    if (params.get('expand')) { const b = $(`[data-exp="${params.get('expand')}"]`); if (b) b.click(); }
  }

  /* ================================================================ */
  /* ACCOUNTS                                                          */
  /* ================================================================ */
  function accountCard(a, i) {
    const liab = isLiab(a); const eur = M.toEur(a);
    const prov = a.provider ? `<span class="sync" data-sync-line><span class="live" aria-hidden="true"></span><span><span data-sync-text>${esc(a.provider)}, synced ${esc(a.synced)}</span></span></span>
      <button class="btn sm ghost" type="button" data-sync aria-label="Sync ${esc(a.name)} now">${icon('sync', 'sm')}Sync now</button>`
      : `<span>Manual account, updated by you</span>`;
    return `<article class="card acc${liab ? ' liab' : ''}${rv(i)}" data-menu-host aria-label="${esc(a.name)}">
      <div class="acc-top"><div><div class="acc-name">${esc(a.name)}</div><div class="acc-type">${TYPE_LABEL[a.account_type]}<span class="dotsep" aria-hidden="true"></span>${a.currency}${a.provider ? `<span class="chip lower" style="margin-left:4px">${icon('link')}${esc(a.provider)}</span>` : ''}</div></div>
        <div class="acts"><button class="btn icon ghost sm" type="button" aria-haspopup="menu" aria-expanded="false" aria-label="Actions for ${esc(a.name)}" data-acc-more="${a.id}">${icon('more')}</button></div></div>
      <div>
        ${liab ? '<div class="stat-label" style="margin-bottom:6px"><span class="chip red">Liability</span><span>you owe</span></div>' : ''}
        <div class="acc-bal"><div class="fig md">${figHTML(a.balance, a.currency)}</div>
        ${a.dayChange != null ? `<span class="delta ${a.dayChange >= 0 ? 'pos' : 'neg'}">${icon(a.dayChange >= 0 ? 'up' : 'down', 'sm')}${a.dayChange >= 0 ? '+' : ''}${pct(a.dayChange, 2)} today</span>` : ''}</div>
        ${a.currency !== 'EUR' ? `<div style="color:var(--muted);font-size:12.5px;margin-top:6px" class="num">About ${fmt(eur)} at ${M.fx[a.currency]} EUR per ${a.currency}</div>` : ''}
        ${a.dayChange != null ? `<div style="color:var(--muted);font-size:12.5px;margin-top:6px" class="num">${signed(a.balance * a.dayChange / (100 + a.dayChange))} since yesterday's close</div>` : ''}
      </div>
      <div class="acc-foot">${prov}</div>
      <span class="rule" aria-hidden="true"></span>
    </article>`;
  }
  function accounts() {
    const groups = [
      ['Checking', ['CHECKING']], ['Savings', ['SAVINGS']], ['Investments', ['INVESTMENT']], ['Cash and gift cards', ['CASH', 'GIFT_CARD']], ['Credit and debt', ['CREDIT_CARD', 'DEBT']],
    ];
    let idx = 3;
    return `
    ${topbar('Accounts', 'Everything you <em>hold</em>, and owe', `<button class="btn" type="button" data-form="connect">${icon('link')}Connect provider</button><button class="btn primary" type="button" data-form="account">${icon('plus')}Add account</button>`)}
    <section class="card acc-hero${rv(1)}" aria-labelledby="tb-h">
      <div><h2 id="tb-h" class="eyebrow" style="margin-bottom:14px">Total balance, in EUR</h2><div class="fig xl" data-count="${M.netWorth}">${figHTML(M.netWorth)}</div>
        <div class="hero-meta">${M.accounts.length} accounts, 3 currencies, converted at today's rates</div></div>
      <div>
        <div class="split2">
          <div><div class="stat-label">${icon('up', 'sm')}Assets</div><div class="fig md">${figHTML(assetTotal)}</div></div>
          <div><div class="stat-label">${icon('down', 'sm')}Liabilities</div><div class="fig md neg">${figHTML(liabTotal)}</div></div>
        </div>
        <div class="balance-bar" role="img" aria-label="Assets ${fmt(assetTotal)}, liabilities ${fmt(liabTotal)}" style="margin-bottom:0"><span class="gx" style="--i:0;flex:${assetTotal};background:var(--ink)"></span><span class="gx" style="--i:1;flex:${-liabTotal};background:var(--neg)"></span></div>
      </div>
    </section>
    ${groups.map(([label, types], gi) => {
      const accs = M.accounts.filter((a) => types.includes(a.account_type)); const tot = sumEur(accs); const liab = gi === groups.length - 1;
      return `<section class="acc-group" aria-labelledby="g-${gi}"><div class="acc-group-head${rv(idx++)}"><h2 id="g-${gi}">${label}<span>${accs.length}</span></h2><span class="num ${liab ? 'neg' : ''}" style="font-weight:500;${liab ? '' : 'color:var(--ink)'}">${fmt(tot)}</span></div>
        <div class="acc-grid">${accs.map((a) => accountCard(a, idx++)).join('')}${gi === 2 ? `<button class="card connect${rv(idx++)}" type="button" data-form="connect"><span><span class="empty-mark" style="width:48px;height:48px">${icon('bank')}</span><h3>Connect a bank</h3><span style="font-size:12.5px">TrueLayer or Trading 212, synced in the background</span></span></button>` : ''}</div></section>`;
    }).join('')}`;
  }
  function afterAccounts() {
    const el = $('[data-count]'); countUp(el, +el.dataset.count);
    document.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.sync !== undefined) {
        const card = b.closest('.acc'); const txt = $('[data-sync-text]', card); const ic = $('svg', b);
        b.disabled = true; ic.classList.add('spin'); txt.textContent = txt.textContent.split(',')[0] + ', syncing';
        setTimeout(() => { ic.classList.remove('spin'); b.disabled = false; txt.textContent = txt.textContent.split(',')[0] + ', synced just now'; toast(`${esc($('.acc-name', card).textContent)} is up to date`); }, 1400);
      }
      if (b.dataset.accMore) {
        e.stopPropagation(); const a = M.acct(b.dataset.accMore);
        openMenu(b, [
          { icon: 'edit', label: 'Edit account', run: () => formDrawer('account', b, a) },
          ...(a.provider ? [{ icon: 'sync', label: 'Reconnect provider', run: () => formDrawer('connect', b) }] : []),
          { icon: 'archive', label: 'Archive', disabled: true, chip: 'Needs backend' },
          '-',
          { icon: 'trash', label: 'Delete account', danger: true, run: () => toast(`${esc(a.name)} deleted`, { label: 'Undo', run: () => {} }) },
        ]);
      }
    });
  }

  /* ================================================================ */
  /* BUDGETS                                                           */
  /* ================================================================ */
  function budgets() {
    const monthly = M.budgets.filter((b) => b.period === 'MONTHLY');
    const lim = monthly.reduce((s, b) => s + b.limit, 0); const sp = monthly.reduce((s, b) => s + b.spent, 0);
    const overall = (sp / lim) * 100;
    const elapsed = (25 / 30) * 100;
    const counts = { OK: 0, WARNING: 0, EXCEEDED: 0 }; M.budgets.forEach((b) => counts[status(b)]++);
    return `
    ${topbar('Budgets', 'September <em>budgets</em>', `<button class="btn primary" type="button" data-form="budget">${icon('plus')}Create budget</button>`)}
    <section class="card bud-hero${rv(1)}" aria-labelledby="ov-h">
      <div class="big-ring">${ringSVG(overall, 'var(--ink)', 150, 8)}<div class="c"><div class="fig md">${Math.round(overall)}%</div><div class="stat-label" style="justify-content:center">used</div></div></div>
      <div><h2 id="ov-h" class="eyebrow" style="margin-bottom:12px">Monthly budgets, September 1 to 30</h2>
        <div class="fig lg">${figHTML(sp)} <span style="font-size:.5em;color:var(--muted);letter-spacing:-0.01em">of ${fmt(lim)}</span></div>
        <p style="margin:10px 0 0;color:var(--muted)">${fmt(lim - sp)} left with 5 days to go. The month is ${Math.round(elapsed)}% through, so you are ${overall > elapsed ? 'slightly ahead of pace' : 'on track'} overall.</p></div>
      <div class="tally">
        <div><div class="stat-label">${icon('check', 'sm')}OK</div><div class="fig md">${counts.OK}</div></div>
        <div><div class="stat-label">${icon('alert', 'sm')}Warning</div><div class="fig md">${counts.WARNING}</div></div>
        <div><div class="stat-label">${icon('x', 'sm')}Exceeded</div><div class="fig md neg">${counts.EXCEEDED}</div></div>
      </div>
    </section>
    <div class="bud-grid">${M.budgets.map((b, i) => budgetCard(b, i + 2)).join('')}</div>`;
  }
  function budgetCard(b, i) {
    const p = budgetPace(b); const c = M.cat(b.category_id); const s = STATUS[status(b)];
    const fillColor = s.color;
    return `<article class="card bud${rv(i)}" data-menu-host aria-labelledby="bn-${b.id}">
      <div><h3 class="bud-name" id="bn-${b.id}">${esc(b.name)}</h3>
        <div class="bud-chips"><span class="chip lower"><span class="dot" style="background:${c.color}"></span>${esc(c.name)}</span><span class="chip">${b.period}</span>${statusChip(b)}</div></div>
      <div class="ring">${ringSVG(p.used, fillColor, 88, 6)}<span class="pct">${Math.round(p.used)}%</span></div>
      <div class="pace" role="img" aria-label="${pct(p.used)} of limit used, ${pct(p.expected)} of the period elapsed"><span class="fill gx" style="--i:${i};background:${fillColor};width:${Math.min(100, p.used)}%"></span><span class="mark" style="left:calc(${p.expected}% - 1px)" title="Today"></span></div>
      <div class="bud-nums">
        <div><div class="k">Spent</div><div class="v">${fmt(b.spent)}</div></div>
        <div><div class="k">Limit</div><div class="v">${fmt(b.limit)}</div></div>
        <div><div class="k">${b.spent > b.limit ? 'Over by' : 'Remaining'}</div><div class="v ${b.spent > b.limit ? 'neg' : ''}">${fmt(Math.abs(b.limit - b.spent))}</div></div>
      </div>
      <div class="bud-foot"><span>${icon('clock', 'sm')} ${p.left} ${p.left === 1 ? 'day' : 'days'} left<span class="dotsep" aria-hidden="true"></span><b style="color:var(--ink);font-weight:550">${p.pace}</b></span>
        <span class="acts"><button class="btn sm ghost" type="button" data-bud-open="${b.id}">Details</button><button class="btn icon ghost sm" type="button" aria-haspopup="menu" aria-expanded="false" aria-label="Actions for ${esc(b.name)}" data-bud-more="${b.id}">${icon('more')}</button></span></div>
    </article>`;
  }
  function openBudget(id, trigger) {
    const b = M.budgets.find((x) => x.id === id); const p = budgetPace(b); const s = STATUS[status(b)];
    const txs = M.transactions.filter((t) => t.category_id === b.category_id && t.date >= b.start && t.date <= b.end);
    const hist = [0.84, 0.97, 0.71, 1.08, 0.9].map((r) => r * b.limit).concat([b.spent]);
    const labels = b.period === 'YEARLY' ? ['2021', '2022', '2023', '2024', '2025', '2026'] : b.period === 'WEEKLY' ? ['Aug 17', 'Aug 24', 'Aug 31', 'Sep 7', 'Sep 14', 'Now'] : ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'];
    const mx = Math.max(b.limit, ...hist) * 1.05;
    let k = 0; const st = (c = '', y = '') => `class="dstag ${c}" style="--i:${k++};${y}"`;
    openDrawer({
      eyebrow: 'Budget', trigger,
      body: `
        <div ${st()}><h2 style="font:400 32px/1.1 var(--serif);letter-spacing:-0.03em;color:var(--ink);margin:0 0 10px">${esc(b.name)}</h2><div class="bud-chips">${statusChip(b)}<span class="chip">${b.period}</span></div></div>
        <div ${st('', 'display:flex;gap:22px;align-items:center;margin-top:24px')}><div class="ring" style="width:96px;height:96px">${ringSVG(p.used, s.color, 96, 7)}<span class="pct" style="font:400 22px/1 var(--serif)">${Math.round(p.used)}%</span></div>
          <div><div class="fig md">${figHTML(b.spent)}</div><div style="color:var(--muted);font-size:13px;margin-top:4px">of ${fmt(b.limit)}, ${p.left} days left, ${p.pace.toLowerCase()}</div></div></div>
        <div ${st()}><div class="section-title">Counting toward this budget <span>${txs.length}</span></div>
          ${txs.length ? txs.map((t) => `<div class="tx">${catIco(t)}<div class="tx-main"><div class="tx-title">${esc(t.title)}</div><div class="tx-sub"><span>${shortDate(parseD(t.date))}</span><span class="sep"></span><span>${esc(M.acct(t.account_id).name)}</span></div></div>${amountHTML(t)}</div>`).join('') : '<p style="color:var(--muted)">Only a sample of transactions is loaded in this mock.</p>'}</div>
        <div ${st()}><div class="section-title">Range history <span class="needs">Needs backend</span></div>
          <div class="hist" role="img" aria-label="Illustrative spend for the last six periods against the ${fmt(b.limit)} limit">${hist.map((v, j) => `<div><i class="gy" style="--i:${j};height:${(v / mx) * 80}px;background:${v > b.limit ? 'var(--neg)' : j === 5 ? 'var(--ink)' : 'var(--series-spend)'}"></i><span>${labels[j]}</span></div>`).join('')}</div>
          <button class="btn sm" type="button" disabled style="margin-top:14px">${icon('edit', 'sm')}Edit ranges</button></div>
        <div ${st()}><div class="section-title">Notes <span class="needs">Needs backend</span></div>
          <div class="field"><label for="b-notes">Budget notes</label><input class="input" id="b-notes" disabled value=""></div></div>`,
      foot: `<button class="btn" type="button" data-b-edit>${icon('edit', 'sm')}Edit budget</button><button class="btn ghost danger" type="button" data-b-del style="margin-left:auto">${icon('trash', 'sm')}Delete</button>`,
    });
    const d = $('[data-drawer]');
    $$('.ring-fill', d).forEach((el) => { if (!reduce()) el.animate([{ strokeDashoffset: el.dataset.c }, { strokeDashoffset: el.dataset.off }], { duration: 1100, delay: 250, easing: FLOW, fill: 'backwards' }); });
    $$('.gy', d).forEach((el) => { el.style.transformOrigin = 'bottom'; });
    $('[data-b-edit]').addEventListener('click', () => { closeDrawer(); formDrawer('budget', trigger, b); });
    $('[data-b-del]').addEventListener('click', () => { closeDrawer(); toast(`${esc(b.name)} deleted`, { label: 'Undo', run: () => {} }); });
  }
  function afterBudgets() {
    animateRings(document);
    document.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.budOpen) openBudget(b.dataset.budOpen, b);
      if (b.dataset.budMore) {
        e.stopPropagation(); const bd = M.budgets.find((x) => x.id === b.dataset.budMore);
        openMenu(b, [
          { icon: 'budgets', label: 'Open details', run: () => openBudget(bd.id, b) },
          { icon: 'edit', label: 'Edit budget', run: () => formDrawer('budget', b, bd) },
          '-',
          { icon: 'trash', label: 'Delete budget', danger: true, run: () => toast(`${esc(bd.name)} deleted`, { label: 'Undo', run: () => {} }) },
        ]);
      }
    });
    if (params.get('open')) setTimeout(() => openBudget(params.get('open'), $(`[data-bud-open="${params.get('open')}"]`)), reduce() ? 0 : 700);
  }

  /* ---------------- boot ---------------- */
  const PAGES = { dashboard: [dashboard, afterDashboard], transactions: [transactions, afterTransactions], accounts: [accounts, afterAccounts], budgets: [budgets, afterBudgets] };
  function boot() {
    const [render, after] = PAGES[PAGE];
    document.body.innerHTML = shell(render());
    wireCommon(document);
    after();
    // shared listeners
    $('[data-scrim]').addEventListener('click', closeDrawer);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeMenu(); closeDrawer(); } });
    document.addEventListener('click', (e) => { if (openMenuEl && !openMenuEl.el.contains(e.target)) closeMenu(); });
    $('[data-collapse]').addEventListener('click', (e) => {
      const s = $('.shell'); const c = s.dataset.collapsed !== 'true';
      s.dataset.collapsed = c; e.currentTarget.setAttribute('aria-expanded', !c);
      e.currentTarget.setAttribute('aria-label', c ? 'Expand sidebar' : 'Collapse sidebar');
      try { localStorage.setItem('moc-b-side', c ? '1' : '0'); } catch (err) { /* ignore */ }
      rerenderCharts();
    });
    $('[data-more]').addEventListener('click', (e) => openDrawer({ eyebrow: 'Menu', trigger: e.currentTarget, body: `<nav aria-label="All sections"><ul class="nav">${navLinks()}</ul></nav><div class="user" style="margin-top:20px"><span class="avatar">${initials(M.user.name)}</span><div class="user-meta"><div class="user-name">${esc(M.user.name)}</div><div class="user-mail">${esc(M.user.email)}</div></div></div><div class="version">v${esc(M.user.version)}</div>` }));
    document.addEventListener('keydown', (e) => { if (e.key.toLowerCase() === 'n' && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName) && !e.metaKey && !e.ctrlKey && !$('[data-drawer]').classList.contains('on')) formDrawer('transaction', null); });
    applyTheme(document.documentElement.dataset.theme || 'light');
    setTimeout(() => { firstPaint = false; }, 50);
    let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(rerenderCharts, 150); });
    if (params.get('menu') === '1') setTimeout(() => $('[data-more]').click(), 100);
  }
  function rerenderCharts() {
    const nw = $('[data-chart="nw"]'); if (nw) netWorthChart(nw);
    const is = $('[data-chart="is"]'); if (is) incomeSpendChart(is);
  }
  boot();
})();
