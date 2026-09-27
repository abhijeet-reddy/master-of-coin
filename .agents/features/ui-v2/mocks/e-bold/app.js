/* Master of Coin v2 mock, direction E: Bold. Vanilla JS, no modules so it runs from file://.
   Every figure comes from window.MOC (../shared/data.js). */
(() => {
  const M = window.MOC;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const TODAY = new Date('2026-09-26T12:00:00');
  const page = document.body.dataset.page;

  /* ---------- Money ---------- */
  const fmt = (n, cur = 'EUR', opts) => M.fmt(n, cur, opts);
  const signed = (n, cur = 'EUR') => (n > 0 ? '+' : n < 0 ? '-' : '') + M.fmt(Math.abs(n), cur);
  const compact = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR', notation: 'compact', maximumFractionDigits: 1 }).format(n);
  const txCur = (t) => t.currency || M.acct(t.account_id).currency;
  const txEur = (t) => t.amount * (M.fx[txCur(t)] || 1);

  /* ---------- Colour engine: any stored category colour becomes a bold block ----------
     Hue is kept, lightness normalised and chroma boosted in OKLCH, clamped to sRGB.
     Text colour on each block is whichever of white / ink measures higher contrast. */
  const INK = '#15102E';
  const hex2rgb = (h) => { h = h.replace('#', ''); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255); };
  const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const delin = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
  function toOklch(hex) {
    const [r, g, b] = hex2rgb(hex).map(lin);
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
    const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
    const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
    return [L, Math.hypot(A, B), Math.atan2(B, A)];
  }
  function fromOklch(L, C, H) {
    const A = C * Math.cos(H), B = C * Math.sin(H);
    const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
    const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
    const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
    return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
  }
  const inGamut = (rgb) => rgb.every((c) => c >= -0.0005 && c <= 1.0005);
  const rgb2hex = (rgb) => '#' + rgb.map((c) => Math.round(Math.min(1, Math.max(0, delin(c))) * 255).toString(16).padStart(2, '0')).join('');
  const vividCache = {};
  function vivid(hex, L = 0.66) {
    const k = hex + L; if (vividCache[k]) return vividCache[k];
    const [, C0, H] = toOklch(hex);
    let C = C0 < 0.05 ? C0 : Math.min(C0 * 1.5 + 0.02, 0.32);
    let rgb = fromOklch(L, C, H);
    while (!inGamut(rgb) && C > 0) { C -= 0.004; rgb = fromOklch(L, C, H); }
    return (vividCache[k] = rgb2hex(rgb));
  }
  const lum = (hex) => { const [r, g, b] = hex2rgb(hex).map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const textOn = (bg) => (contrast(bg, '#FFFFFF') >= contrast(bg, INK) ? '#FFFFFF' : INK);
  // A block colour whose best text colour clears AA (4.5:1) with margin; nudges lightness if it does not.
  function blockColor(hex, L = 0.66) {
    let bg = vivid(hex, L), fg = textOn(bg), n = 0;
    while (contrast(bg, fg) < 4.7 && n++ < 20) { L += fg === INK ? 0.02 : -0.02; bg = vivid(hex, L); fg = textOn(bg); }
    return { bg, fg };
  }
  const OTHER = { id: 'other', name: 'Other', icon: 'dots', color: '#8A879C' };
  const catOf = (id) => (id === 'other' ? OTHER : M.cat(id)) || { id: 'none', name: 'Uncategorised', icon: 'coin', color: '#8A879C' };
  function catStyle(id) {
    const c = catOf(id);
    const { bg, fg } = blockColor(c.color);
    return { bg, fg, css: `background:${bg};color:${fg}`, dark: fg !== '#FFFFFF', cat: c };
  }
  const soft = (hex) => `color-mix(in oklab, ${hex} 18%, var(--surface))`;

  /* ---------- Icons (24px grid, 2px round strokes, currentColor) ---------- */
  const P = {
    cart: '<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2.5 3.5h2.8l2.4 11.6a2 2 0 0 0 2 1.6h8a2 2 0 0 0 2-1.5L21.5 7.5H6.2"/>',
    fork: '<path d="M7 2.5v7a2 2 0 0 0 2 2m0 0a2 2 0 0 0 2-2v-7M9 11.5v10M9 2.5v5.5M17 21.5v-19c-2.4 0-4 2.6-4 7 0 3 1.4 4.6 4 4.6"/>',
    home: '<path d="M3.5 10.5 12 3.5l8.5 7V20a1 1 0 0 1-1 1H15v-6H9v6H4.5a1 1 0 0 1-1-1z"/>',
    bolt: '<path d="M13 2.5 4.5 13.5H11l-1 8 8.5-11H12z"/>',
    train: '<rect x="5" y="3" width="14" height="13" rx="3.5"/><path d="M5 10h14M8.5 19.5 7 21.5M15.5 19.5l1.5 2M8.8 13h.01M15.2 13h.01"/>',
    bag: '<path d="M5 8h14l-1.2 12.2a1 1 0 0 1-1 .8H7.2a1 1 0 0 1-1-.8z"/><path d="M9 10V6.5a3 3 0 0 1 6 0V10"/>',
    film: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M7.5 4v16M16.5 4v16M3 9h4.5M3 15h4.5M16.5 9H21M16.5 15H21"/>',
    heart: '<path d="M12 20.5s-7.5-4.6-9.2-9.3A4.8 4.8 0 0 1 12 7.1a4.8 4.8 0 0 1 9.2 4.1C19.5 15.9 12 20.5 12 20.5z"/>',
    plane: '<path d="M21 15.5v-2l-8-5V3.8a1.5 1.5 0 0 0-3 0v4.7l-8 5v2l8-2.5v5l-2 1.5v1.5l3.5-1 3.5 1v-1.5l-2-1.5v-5z"/>',
    briefcase: '<rect x="3" y="7" width="18" height="13" rx="2.5"/><path d="M9 7V5.5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2V7M3 12.5h18"/>',
    repeat: '<path d="m17 2.5 3.5 3.5L17 9.5"/><path d="M3.5 11V9.5a3.5 3.5 0 0 1 3.5-3.5h13.5"/><path d="M7 21.5 3.5 18 7 14.5"/><path d="M20.5 13v1.5A3.5 3.5 0 0 1 17 18H3.5"/>',
    dots: '<circle cx="5.5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="18.5" cy="12" r="1.6"/>',
    coin: '<circle cx="12" cy="12" r="8.5"/><path d="M14.8 9.2a3.2 3.2 0 1 0 0 5.6M8 11h5M8 13h5"/>',
    dashboard: '<rect x="3.5" y="3.5" width="7" height="9" rx="2"/><rect x="13.5" y="3.5" width="7" height="5" rx="2"/><rect x="13.5" y="11.5" width="7" height="9" rx="2"/><rect x="3.5" y="15.5" width="7" height="5" rx="2"/>',
    transactions: '<path d="M4 6.5h16M4 12h16M4 17.5h10"/>',
    accounts: '<rect x="2.5" y="5.5" width="19" height="14" rx="3"/><path d="M2.5 10h19M6.5 15h4"/>',
    budgets: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5V12l6 6"/>',
    categories: '<path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3a1.5 1.5 0 0 1 0 2.1l-6.6 6.6a1.5 1.5 0 0 1-2.1 0z"/><circle cx="8" cy="8" r="1.5"/>',
    people: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.8a3.5 3.5 0 0 1 0 6.4M18.5 14.5a6.5 6.5 0 0 1 3 5.5"/>',
    reports: '<path d="M4 20.5V10M10 20.5V4M16 20.5v-7M21 20.5H3"/>',
    jobs: '<path d="M12 3 3 7.5l9 4.5 9-4.5z"/><path d="m3 12 9 4.5 9-4.5M3 16.5 12 21l9-4.5"/>',
    schedules: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    trash: '<path d="M4 7h16M9.5 7V4.5h5V7M6 7l1 13a1 1 0 0 0 1 .9h8a1 1 0 0 0 1-.9l1-13M10 11v6M14 11v6"/>',
    settings: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    swap: '<path d="M16 3.5 20 7.5l-4 4M20 7.5H8M8 20.5l-4-4 4-4M4 16.5h12"/>',
    upload: '<path d="M12 15.5V4M7 8.5l5-5 5 5M4.5 15v3.5a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V15"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20.5 20.5-4.5-4.5"/>',
    filter: '<path d="M3.5 5.5h17l-6.5 7.8v5.2l-4 2v-7.2z"/>',
    chevL: '<path d="m15 5-7 7 7 7"/>', chevR: '<path d="m9 5 7 7-7 7"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>', check: '<path d="m4.5 12.5 5 5 10-11"/>',
    alert: '<path d="M12 3.5 2.5 20h19z"/><path d="M12 10v4.5M12 17.2h.01"/>',
    xcircle: '<circle cx="12" cy="12" r="8.5"/><path d="m9 9 6 6M15 9l-6 6"/>',
    okcircle: '<circle cx="12" cy="12" r="8.5"/><path d="m8 12.3 2.8 2.7L16 9.5"/>',
    split: '<path d="M6 3.5v5a4 4 0 0 0 4 4h4a4 4 0 0 1 4 4v4M18 3.5v5a4 4 0 0 1-4 4"/><circle cx="6" cy="20.5" r=".5"/>',
    link: '<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/>',
    note: '<path d="M5 3.5h10l4 4V20a.5.5 0 0 1-.5.5h-13A.5.5 0 0 1 5 20z"/><path d="M8.5 11h7M8.5 15h5"/>',
    globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.6 3.5 5.4 3.5 8.5s-1 5.9-3.5 8.5c-2.5-2.6-3.5-5.4-3.5-8.5s1-5.9 3.5-8.5z"/>',
    sync: '<path d="M20 12a8 8 0 0 1-14.3 4.9M4 12a8 8 0 0 1 14.3-4.9"/><path d="M18.5 3v4.3h-4.3M5.5 21v-4.3h4.3"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"/>',
    moon: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/>',
    up: '<path d="m4 16.5 6-6 4 4 6.5-7"/><path d="M15.5 7.5h5v5"/>', down: '<path d="m4 7.5 6 6 4-4 6.5 7"/><path d="M15.5 16.5h5v-5"/>',
    inflow: '<circle cx="12" cy="12" r="8.5"/><path d="M12 8v8M8 12h8"/>', outflow: '<circle cx="12" cy="12" r="8.5"/><path d="M8 12h8"/>',
    pencil: '<path d="M14.5 5.5 18.5 9.5M4 20l1-4.5L15.8 4.7a1.8 1.8 0 0 1 2.5 0l1 1a1.8 1.8 0 0 1 0 2.5L8.5 19z"/>',
    copy: '<rect x="8.5" y="8.5" width="12" height="12" rx="2.5"/><path d="M15.5 8.5V5.5a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h3"/>',
    panel: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9 4v16M14 10l-2 2 2 2"/>',
    plug: '<path d="M9 3v5M15 3v5M6.5 8h11v3a5.5 5.5 0 0 1-11 0zM12 16.5V21"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 20.5a8 8 0 0 1 16 0"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    hand: '<path d="M7 11.5V6a1.5 1.5 0 0 1 3 0v4.5M10 10V4.5a1.5 1.5 0 0 1 3 0V10M13 10V5.5a1.5 1.5 0 0 1 3 0V11M16 9a1.5 1.5 0 0 1 3 0v5a7 7 0 0 1-7 7h-.5a6 6 0 0 1-5-2.7L4 14.5a1.6 1.6 0 0 1 2.6-1.8L7 13.5"/>',
    archive: '<rect x="3" y="4" width="18" height="4.5" rx="1.5"/><path d="M5 8.5V19a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19V8.5M10 12.5h4"/>',
    target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  };
  const ic = (n, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${P[n] || P.coin}</svg>`;
  const logo = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M8 15.5v-7l4 4.5 4-4.5v7"/></svg>';
  const nb = (what = 'Needs backend') => `<span class="nb" title="This panel needs data the backend does not provide yet">${ic('plug')}${what}</span>`;

  /* ---------- Shell ---------- */
  const PAGES = { Dashboard: 'dashboard.html', Transactions: 'transactions.html', Accounts: 'accounts.html', Budgets: 'budgets.html' };
  const initials = M.user.name.split(' ').map((w) => w[0]).join('').slice(0, 2);
  function navList(mobile = false) {
    return `<ul class="nav">${M.nav.map((n, i) => {
      const key = n.toLowerCase();
      const cur = key === page;
      const inner = `${ic(key)}<span class="nav-label">${n}</span>`;
      const sep = !mobile && i === 4 ? '<li class="nav-sep" role="presentation"></li>' : '';
      return sep + (PAGES[n]
        ? `<li><a href="${PAGES[n]}" ${cur ? 'aria-current="page"' : ''} title="${n}">${inner}</a></li>`
        : `<li><span class="inert" title="${n} (not part of this mock)">${inner}${mobile ? '' : '<span class="soon">Mock</span>'}</span></li>`);
    }).join('')}</ul>`;
  }
  const themeBtn = (id) => `<button class="icon-btn theme-btn" id="${id}" type="button" aria-label="Switch to dark theme"><span style="display:grid">${ic('sun', 'class="sun-i"')}${ic('moon', 'class="moon-i"')}</span></button>`;

  function shell(content) {
    const app = $('#app');
    if (localStorage.getItem('moc-e-collapsed') === '1') app.classList.add('collapsed');
    app.innerHTML = `
      <nav class="side" aria-label="Main">
        <a class="brand" href="dashboard.html"><span class="brand-mark">${logo}</span><span class="brand-name">Master of Coin<small>Personal finance</small></span></a>
        ${navList()}
        <div class="side-foot">
          <div class="user"><span class="avatar" aria-hidden="true">${initials}</span><span class="user-meta"><b>${esc(M.user.name)}</b><span>${esc(M.user.email)}</span></span></div>
          <div class="side-row">
            <span class="version">v${M.user.version}</span>
            <span style="display:flex;gap:8px">${themeBtn('theme-side')}
            <button class="icon-btn collapse-btn" type="button" aria-label="Collapse sidebar" aria-expanded="true">${ic('panel')}</button></span>
          </div>
        </div>
      </nav>
      <div class="main" id="main" tabindex="-1">
        <div class="mobile-top">
          <a class="brand" href="dashboard.html"><span class="brand-mark">${logo}</span><span class="brand-name">Master of Coin<small>v${M.user.version}</small></span></a>
          <span style="display:flex;gap:8px">${themeBtn('theme-mob')}<span class="avatar" aria-label="${esc(M.user.name)}, ${esc(M.user.email)}" role="img">${initials}</span></span>
        </div>
        ${content}
      </div>
      <nav class="bottombar" aria-label="Main, mobile">
        ${['Dashboard', 'Transactions', 'Accounts', 'Budgets'].map((n) => `<a href="${PAGES[n]}" ${n.toLowerCase() === page ? 'aria-current="page"' : ''}>${ic(n.toLowerCase())}<span>${n === 'Transactions' ? 'Activity' : n}</span></a>`).join('')}
        <button type="button" id="more-btn" aria-expanded="false" aria-controls="drawer">${ic('menu')}<span>More</span></button>
      </nav>
      <div class="drawer" id="drawer" role="dialog" aria-modal="true" aria-label="All sections">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <div class="user" style="flex:1;margin-inline-end:8px"><span class="avatar" aria-hidden="true">${initials}</span><span class="user-meta"><b>${esc(M.user.name)}</b><span>${esc(M.user.email)}</span></span></div>
          <button class="icon-btn" type="button" data-close-drawer aria-label="Close menu">${ic('x')}</button>
        </div>
        ${navList(true)}
        <p class="version" style="margin-top:12px;text-align:center">Master of Coin v${M.user.version}</p>
      </div>
      <div class="scrim" id="scrim"></div>
      <aside class="sheet" id="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title"></aside>
      <div class="menu" id="menu" role="menu" hidden></div>
      <div class="tip" id="tip" role="tooltip"></div>
      <div class="toasts" id="toasts" aria-live="polite"></div>`;

    const cb = $('.collapse-btn');
    const syncCollapse = () => { const c = app.classList.contains('collapsed'); cb.setAttribute('aria-expanded', String(!c)); cb.setAttribute('aria-label', c ? 'Expand sidebar' : 'Collapse sidebar'); };
    syncCollapse();
    cb.addEventListener('click', () => { app.classList.toggle('collapsed'); localStorage.setItem('moc-e-collapsed', app.classList.contains('collapsed') ? '1' : '0'); syncCollapse(); });
    $$('.theme-btn').forEach((b) => b.addEventListener('click', (e) => toggleTheme(e.currentTarget)));
    syncThemeLabels();
    const drawer = $('#drawer'), more = $('#more-btn');
    more.addEventListener('click', () => openOverlay(drawer, more));
    $('[data-close-drawer]').addEventListener('click', closeOverlay);
    $('#scrim').addEventListener('click', closeOverlay);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { if (!$('#menu').hidden) closeMenu(); else closeOverlay(); } });
    initTips();
  }

  /* ---------- Theme: circular reveal from the toggle ---------- */
  function syncThemeLabels() {
    const dark = document.documentElement.dataset.theme === 'dark';
    $$('.theme-btn').forEach((b) => b.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme'));
  }
  function toggleTheme(btn) {
    const root = document.documentElement;
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    const apply = () => { root.dataset.theme = next; localStorage.setItem('moc-e-theme', next); syncThemeLabels(); };
    if (!document.startViewTransition || reduced()) { apply(); return; }
    const r = btn.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    root.style.setProperty('--vx', x + 'px'); root.style.setProperty('--vy', y + 'px');
    root.style.setProperty('--vr', Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y)) + 'px');
    document.startViewTransition(apply);
  }

  /* ---------- Overlays: sheet + drawer, with focus trap and restore ---------- */
  let overlay = null, returnFocus = null;
  function openOverlay(el, trigger) {
    closeMenu();
    if (overlay && overlay !== el) overlay.classList.remove('open');
    overlay = el; returnFocus = trigger || document.activeElement;
    el.classList.add('open'); $('#scrim').classList.add('open');
    $$('.side, .main, .bottombar').forEach((n) => (n.inert = true));
    if (el.id === 'drawer') $('#more-btn').setAttribute('aria-expanded', 'true');
    requestAnimationFrame(() => { const f = el.querySelector('[data-autofocus]') || el.querySelector('button, a, input, select, textarea'); f && f.focus({ preventScroll: true }); });
  }
  function closeOverlay() {
    if (!overlay) return;
    overlay.classList.remove('open'); $('#scrim').classList.remove('open');
    $$('.side, .main, .bottombar').forEach((n) => (n.inert = false));
    $('#more-btn').setAttribute('aria-expanded', 'false');
    overlay = null;
    if (returnFocus && document.contains(returnFocus)) returnFocus.focus({ preventScroll: true });
  }
  function openSheet(html, trigger) {
    const s = $('#sheet');
    s.innerHTML = html;
    s.scrollTop = 0;
    $$('[data-close-sheet]', s).forEach((b) => b.addEventListener('click', closeOverlay));
    // restart the one-shot entrance for the new content
    s.classList.remove('open'); void s.offsetWidth;
    openOverlay(s, trigger);
    return s;
  }
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab' || !overlay) return;
    const f = $$('button:not([disabled]), a[href], input, select, textarea, [tabindex="0"]', overlay).filter((n) => n.offsetParent !== null);
    if (!f.length) return;
    if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
  });

  /* ---------- Menu popover (row + card actions) ---------- */
  let menuTrigger = null;
  function openMenu(trigger, items) {
    const m = $('#menu');
    m.innerHTML = items.map((it) => it === '-' ? '<hr>' : `<button role="menuitem" type="button" class="${it.danger ? 'danger' : ''}" ${it.disabled ? 'aria-disabled="true"' : ''}>${ic(it.icon)}<span>${it.label}</span>${it.chip || ''}</button>`).join('');
    const btns = $$('button', m);
    items.filter((x) => x !== '-').forEach((it, i) => btns[i].addEventListener('click', () => { closeMenu(); it.run && it.run(); }));
    m.hidden = false; menuTrigger = trigger; trigger.setAttribute('aria-expanded', 'true');
    const r = trigger.getBoundingClientRect();
    const w = m.offsetWidth, h = m.offsetHeight;
    let left = Math.min(r.right - w, innerWidth - w - 8); left = Math.max(8, left);
    let top = r.bottom + 6; if (top + h > innerHeight - 8) { top = r.top - h - 6; m.style.transformOrigin = 'bottom right'; } else m.style.transformOrigin = 'top right';
    m.style.left = left + 'px'; m.style.top = top + 'px';
    m.style.animation = 'none'; void m.offsetWidth; m.style.animation = '';
    btns[0].focus();
    m.onkeydown = (e) => {
      const i = btns.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); btns[(i + 1) % btns.length].focus(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); btns[(i - 1 + btns.length) % btns.length].focus(); }
      if (e.key === 'Tab') closeMenu(false);
    };
  }
  function closeMenu(refocus = true) {
    const m = $('#menu'); if (!m || m.hidden) return;
    m.hidden = true;
    if (menuTrigger) { menuTrigger.setAttribute('aria-expanded', 'false'); if (refocus) menuTrigger.focus(); }
    menuTrigger = null;
  }
  document.addEventListener('pointerdown', (e) => { const m = $('#menu'); if (m && !m.hidden && !m.contains(e.target) && e.target !== menuTrigger && !menuTrigger?.contains(e.target)) closeMenu(false); });

  /* ---------- Tooltip ---------- */
  function initTips() {
    const tip = $('#tip');
    const show = (el, x, y) => { tip.innerHTML = el.dataset.tip; tip.classList.add('show'); const w = tip.offsetWidth; tip.style.left = Math.min(innerWidth - w - 8, Math.max(8, x - w / 2)) + 'px'; tip.style.top = Math.max(8, y - tip.offsetHeight - 12) + 'px'; };
    const hide = () => tip.classList.remove('show');
    document.addEventListener('pointermove', (e) => { const el = e.target.closest?.('[data-tip]'); if (el) show(el, e.clientX, e.clientY); else hide(); });
    document.addEventListener('focusin', (e) => { const el = e.target.closest?.('[data-tip]'); if (el) { const r = el.getBoundingClientRect(); show(el, r.left + r.width / 2, r.top); } else hide(); });
    document.addEventListener('scroll', hide, true);
  }

  /* ---------- Toast with undo ---------- */
  function toast(msg, undo) {
    const t = document.createElement('div');
    t.className = 'toast'; t.setAttribute('role', 'status');
    t.innerHTML = `${ic('check')}<span>${msg}</span>${undo ? '<button class="btn sm" type="button">Undo</button>' : '<span style="width:10px"></span>'}`;
    $('#toasts').appendChild(t);
    const kill = () => { t.classList.add('out'); setTimeout(() => t.remove(), 220); };
    if (undo) $('button', t).addEventListener('click', () => { undo(); kill(); });
    setTimeout(kill, 6000);
  }

  /* ---------- Count-up (once per mount) ---------- */
  function countUps(root = document) {
    $$('[data-count]', root).forEach((el) => {
      const to = +el.dataset.count, cur = el.dataset.cur || 'EUR', mode = el.dataset.mode || 'money';
      const render = (v) => {
        if (mode === 'pct') el.textContent = Math.round(v) + '%';
        else if (mode === 'signed') el.textContent = signed(v, cur);
        else if (mode === 'split') { const s = fmt(v, cur); const i = s.lastIndexOf('.'); el.innerHTML = i > 0 ? `${s.slice(0, i)}<span class="cents">${s.slice(i)}</span>` : s; }
        else el.textContent = fmt(v, cur);
      };
      el.setAttribute('aria-label', mode === 'pct' ? Math.round(to) + '%' : mode === 'signed' ? signed(to, cur) : fmt(to, cur));
      if (reduced()) { render(to); return; }
      const dur = +(el.dataset.dur || 1400), delay = +(el.dataset.delay || 150);
      render(0);
      const t0 = performance.now() + delay;
      const step = (now) => {
        const p = Math.min(1, Math.max(0, (now - t0) / dur));
        const e = p === 1 ? 1 : 1 - 2 ** (-10 * p); // expo out: fast start, gentle landing
        render(to * e);
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }
  function stagger(root = document) { $$('.pop', root).forEach((el, i) => el.style.setProperty('--i', Math.min(i, 12))); }

  /* ---------- Small shared renderers ---------- */
  const STATUS = {
    OK: { cls: 'ok', icon: 'okcircle', label: 'OK' },
    WARNING: { cls: 'warn', icon: 'alert', label: 'Warning' },
    EXCEEDED: { cls: 'bad', icon: 'xcircle', label: 'Exceeded' },
  };
  const statusOf = (pct) => (pct > 100 ? 'EXCEEDED' : pct >= 80 ? 'WARNING' : 'OK');
  const statusChip = (s) => `<span class="chip ${STATUS[s].cls}">${ic(STATUS[s].icon)}${STATUS[s].label}</span>`;
  const DAY = 86400000;
  function budgetMeta(b) {
    const start = new Date(b.start + 'T00:00:00'), end = new Date(b.end + 'T23:59:59');
    const total = Math.round((end - start) / DAY);
    const elapsed = Math.min(total, Math.max(0, Math.floor((TODAY - start) / DAY) + 1));
    const daysLeft = Math.max(0, total - elapsed);
    const pct = (b.spent / b.limit) * 100;
    const expected = (elapsed / total) * 100;
    const status = statusOf(pct);
    const pace = pct > 100 ? 'Over limit' : pct > expected + 5 ? 'Ahead of pace' : 'On track';
    return { pct, expected, daysLeft, status, pace, remaining: b.limit - b.spent };
  }
  function ring({ pct, size = 64, stroke = 9, color, track, delay = 300, label = '', center = '' }) {
    const r = 50 - stroke / 2 - 1;
    const main = Math.min(pct, 100), over = Math.max(0, Math.min(pct - 100, 100));
    return `<div class="ring bounce" style="width:${size}px;height:${size}px;--delay:${delay}ms;${track ? `--ring-track:${track}` : ''}" role="img" aria-label="${label}">
      <svg viewBox="0 0 100 100"><circle class="track" cx="50" cy="50" r="${r}" stroke-width="${stroke}"/>
      <circle class="fill" cx="50" cy="50" r="${r}" stroke-width="${stroke}" pathLength="100" stroke="${color}" style="--to:${100 - main}"/>
      ${over ? `<circle class="over" cx="50" cy="50" r="${r}" stroke-width="${stroke * 0.55}" pathLength="100" stroke="var(--neg-fill)" style="--to:${100 - over}"/>` : ''}</svg>
      <div class="center">${center}</div></div>`;
  }
  function txBadges(t) {
    const b = [];
    const cur = txCur(t);
    if (t.splits) t.splits.forEach((s) => b.push(`<span class="chip brand">${ic('split')}Split with ${esc(s.person)}</span>`));
    if (t.transfer) b.push(`<span class="chip">${ic('swap')}Transfer to ${esc(t.transfer.linked)}</span>`);
    if (t.debt) b.push(`<span class="chip warn">${ic('hand')}Paid by ${esc(t.debt.paidBy)}</span>`);
    if (t.recurring) b.push(`<span class="chip">${ic('repeat')}Recurring</span>`);
    if (t.notes) b.push(`<span class="chip">${ic('note')}Note</span>`);
    if (cur !== 'EUR') b.push(`<span class="chip">${ic('globe')}${cur}</span>`);
    return b.join('');
  }
  function txIcon(t) {
    if (t.transfer) return `<span class="ico" style="background:var(--ink);color:var(--bg)">${ic('swap')}</span>`;
    const s = catStyle(t.category_id);
    return `<span class="ico" style="${s.css}">${ic(s.cat.icon)}</span>`;
  }
  function amountCell(t) {
    const cur = txCur(t);
    const inflow = t.amount > 0;
    const kind = t.transfer ? `<span class="kind muted">${ic('swap')}Transfer</span>` : inflow ? `<span class="kind in">${ic('inflow')}Money in</span>` : '';
    return `<span class="amt"><b class="num ${inflow ? 'in' : ''}">${signed(t.amount, cur)}</b>${cur !== 'EUR' ? `<small class="num">${signed(txEur(t))}</small>` : ''}${kind}</span>`;
  }
  const accountName = (id) => M.acct(id)?.name || '';
  const catName = (t) => (t.transfer ? 'Transfer' : catOf(t.category_id).name);
  const dayLabel = (iso) => new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  const shortDate = (iso) => new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  /* ---------- Transaction detail sheet (shared by dashboard + transactions) ---------- */
  function txSheet(t, trigger, handlers = {}) {
    const s = t.transfer ? { bg: 'var(--ink)', fg: 'var(--bg)', css: 'background:var(--ink);color:var(--bg)', cat: { icon: 'swap', name: 'Transfer' } } : catStyle(t.category_id);
    const cur = txCur(t), a = M.acct(t.account_id);
    const people = M.people;
    const html = `
      <button class="icon-btn sheet-close" type="button" data-close-sheet aria-label="Close details" style="color:${s.fg}">${ic('x')}</button>
      <div class="sheet-body">
        <div class="sheet-hero" style="${s.css}">
          <span class="wobble"></span>
          <span class="cat-ico lg" style="background:rgba(255,255,255,0.22)">${ic(s.cat.icon)}</span>
          <p class="label" style="margin-top:18px">${esc(s.cat.name)} · ${shortDate(t.date)}</p>
          <h2 id="sheet-title" style="font-size:26px;font-weight:850;letter-spacing:-0.02em;margin-top:4px">${esc(t.title)}</h2>
          <p class="big num" style="margin-top:16px;font-size:48px">${signed(t.amount, cur)}</p>
          ${cur !== 'EUR' ? `<p class="num" style="font-weight:750;margin-top:6px">${signed(txEur(t))} at ${M.fx[cur]} EUR per ${cur}</p>` : ''}
          <p style="margin-top:8px;font-weight:750">${t.amount > 0 ? 'Money in' : t.transfer ? 'Transfer between your accounts' : 'Money out'}</p>
        </div>
        <div class="stagger">
          <dl class="dl">
            <dt>Account</dt><dd>${esc(a.name)} (${a.currency})</dd>
            <dt>Date</dt><dd>${dayLabel(t.date)}</dd>
            <dt>Category</dt><dd>${esc(catName(t))}</dd>
            ${t.recurring ? `<dt>Repeats</dt><dd>Monthly, recurring</dd>` : ''}
          </dl>
          ${t.splits ? `<div class="sheet-section"><h3>Split</h3>${t.splits.map((sp) => `<div class="person"><span class="avatar" aria-hidden="true">${sp.person[0]}</span><span class="grow"><b>${esc(sp.person)}</b> owes you<br><span class="muted" style="font-size:13px;font-weight:650">Synced to Splitwise</span></span><b class="num in">+${fmt(sp.amount, cur)}</b></div>`).join('')}<p class="hint" style="margin-top:8px">Your share: ${fmt(Math.abs(t.amount) - t.splits.reduce((q, x) => q + x.amount, 0), cur)}</p></div>` : ''}
          ${t.debt ? `<div class="sheet-section"><h3>Paid by someone else</h3><div class="person"><span class="avatar" aria-hidden="true">${t.debt.paidBy[0]}</span><span class="grow"><b>${esc(t.debt.paidBy)}</b> paid ${fmt(t.debt.total)} in total</span><b class="num">You owe ${fmt(Math.abs(t.amount))}</b></div></div>` : ''}
          ${t.transfer ? `<div class="sheet-section"><h3>Linked transfer</h3><div class="person"><span class="cat-ico" style="background:var(--surface-3)">${ic('link')}</span><span class="grow"><b>${esc(t.transfer.linked)}</b><br><span class="muted" style="font-size:13px;font-weight:650">Incoming leg, ${fmt(Math.abs(t.amount))}</span></span></div></div>` : ''}
          <div class="sheet-section"><h3>Notes</h3><p class="${t.notes ? '' : 'muted'}">${t.notes ? esc(t.notes) : 'No notes yet.'}</p></div>
          ${people && !t.splits && !t.transfer && t.amount < 0 ? `<div class="sheet-section"><h3>Split this</h3><p class="muted" style="margin-bottom:10px">Share it with ${people.map((p) => p.name).join(', ')} or anyone else.</p><button class="btn sm" type="button">${ic('split')}Add a split</button></div>` : ''}
        </div>
      </div>
      <div class="sheet-foot">
        <button class="btn primary sm" type="button" data-autofocus>${ic('pencil')}Edit</button>
        <button class="btn sm" type="button" data-act="dup">${ic('copy')}Duplicate</button>
        ${t.transfer ? '' : `<button class="btn sm" type="button" data-act="conv">${ic('swap')}Convert to transfer</button>`}
        <button class="btn danger sm" type="button" data-act="del">${ic('trash')}Delete</button>
      </div>`;
    const sh = openSheet(html, trigger);
    $('[data-act="del"]', sh).addEventListener('click', () => { closeOverlay(); (handlers.del || (() => toast('Moved to Trash', () => {})))(); });
    $('[data-act="dup"]', sh).addEventListener('click', () => { closeOverlay(); toast(`Duplicated "${esc(t.title)}"`); });
    $('[data-act="conv"]', sh)?.addEventListener('click', () => { closeOverlay(); toast('Pick the other leg to link as a transfer'); });
  }

  /* ---------- Generic form sheet (add transaction / transfer / import / account / budget) ---------- */
  function formSheet(kind, trigger) {
    const accOpts = M.accounts.map((a) => `<option value="${a.id}">${esc(a.name)} (${a.currency})</option>`).join('');
    const catOpts = M.categories.map((c) => `<option>${esc(c.name)}</option>`).join('');
    const K = {
      tx: { title: 'Add transaction', color: 'var(--brand)', fg: '#fff', icon: 'plus', body: `
        <div class="field"><label for="f-title">Title</label><input class="input" id="f-title" autocomplete="off" data-autofocus></div>
        <div class="row2"><div class="field"><label for="f-amt">Amount</label><input class="input num" id="f-amt" inputmode="decimal"></div>
        <div class="field"><span class="flabel" id="f-dir">Direction</span><div class="seg" role="group" aria-labelledby="f-dir"><button type="button" aria-pressed="true">Money out</button><button type="button" aria-pressed="false">Money in</button></div></div></div>
        <div class="row2"><div class="field"><label for="f-acc">Account</label><select class="select" id="f-acc">${accOpts}</select></div>
        <div class="field"><label for="f-cat">Category</label><select class="select" id="f-cat">${catOpts}</select></div></div>
        <div class="field"><label for="f-date">Date</label><input class="input" id="f-date" type="date" value="2026-09-26"></div>
        <div class="field"><label for="f-notes">Notes</label><textarea class="input" id="f-notes"></textarea><span class="hint">Notes are searchable.</span></div>` },
      transfer: { title: 'Transfer', color: 'var(--ink)', fg: 'var(--bg)', icon: 'swap', body: `
        <div class="row2"><div class="field"><label for="f-from">From</label><select class="select" id="f-from" data-autofocus>${accOpts}</select></div>
        <div class="field"><label for="f-to">To</label><select class="select" id="f-to">${accOpts.replace('value="a-save"', 'value="a-save" selected')}</select></div></div>
        <div class="row2"><div class="field"><label for="f-out">Amount sent</label><input class="input num" id="f-out" inputmode="decimal"></div>
        <div class="field"><label for="f-in">Amount received</label><input class="input num" id="f-in" inputmode="decimal"><span class="hint">Different when fees or FX apply.</span></div></div>
        <div class="field"><label for="f-tdate">Date</label><input class="input" id="f-tdate" type="date" value="2026-09-26"></div>` },
      import: { title: 'Import CSV', color: 'var(--sun)', fg: '#15102E', icon: 'upload', body: `
        <div class="field"><label for="f-iacc">Into account</label><select class="select" id="f-iacc" data-autofocus>${accOpts}</select></div>
        <div class="field"><label for="f-file">CSV file</label><input class="input" id="f-file" type="file" accept=".csv" style="padding-top:9px"><span class="hint">We will preview rows and flag duplicates before anything is saved.</span></div>` },
      account: { title: 'Add account', color: 'var(--brand)', fg: '#fff', icon: 'accounts', body: `
        <div class="field"><label for="f-an">Name</label><input class="input" id="f-an" data-autofocus></div>
        <div class="row2"><div class="field"><label for="f-at">Type</label><select class="select" id="f-at">${['Checking', 'Savings', 'Credit card', 'Investment', 'Cash', 'Debt', 'Gift card'].map((x) => `<option>${x}</option>`).join('')}</select></div>
        <div class="field"><label for="f-ac">Currency</label><select class="select" id="f-ac">${Object.keys(M.fx).map((c) => `<option>${c}</option>`).join('')}</select></div></div>
        <div class="field"><label for="f-ab">Opening balance</label><input class="input num" id="f-ab" inputmode="decimal"><span class="hint">Use a minus sign for money you owe.</span></div>` },
      connect: { title: 'Connect a provider', color: 'var(--pos-fill)', fg: '#06261A', icon: 'plug', body: `
        <div class="prov"><span class="logo" style="background:#1A1A1A">TL</span><span class="grow"><b>TrueLayer</b><span>Open Banking for EU and UK banks. Syncs transactions daily.</span></span><button class="btn sm primary" type="button" data-autofocus>Connect</button></div>
        <div class="prov"><span class="logo" style="background:#0A6EF0">212</span><span class="grow"><b>Trading 212</b><span>Portfolio value and day change via API key.</span></span><button class="btn sm" type="button">Connect</button></div>` },
      budget: { title: 'Create budget', color: 'var(--brand)', fg: '#fff', icon: 'target', body: `
        <div class="field"><label for="f-bn">Name</label><input class="input" id="f-bn" data-autofocus></div>
        <div class="row2"><div class="field"><label for="f-bc">Category</label><select class="select" id="f-bc">${catOpts}</select></div>
        <div class="field"><label for="f-bp">Period</label><select class="select" id="f-bp">${['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY'].map((p) => `<option ${p === 'MONTHLY' ? 'selected' : ''} value="${p}">${p[0] + p.slice(1).toLowerCase()}</option>`).join('')}</select></div></div>
        <div class="field"><label for="f-bl">Limit (EUR)</label><input class="input num" id="f-bl" inputmode="decimal"></div>` },
    }[kind];
    const sh = openSheet(`
      <button class="icon-btn sheet-close" type="button" data-close-sheet aria-label="Close" style="color:${K.fg}">${ic('x')}</button>
      <div class="sheet-body">
        <div class="sheet-hero" style="background:${K.color};color:${K.fg}"><span class="wobble"></span><span class="cat-ico lg" style="background:rgba(255,255,255,0.22)">${ic(K.icon)}</span><h2 id="sheet-title" style="font-size:28px;font-weight:850;margin-top:16px;letter-spacing:-0.02em">${K.title}</h2></div>
        <form class="form stagger" onsubmit="return false">${K.body}</form>
      </div>
      <div class="sheet-foot"><button class="btn primary" type="button" data-save>${ic('check')}Save</button><button class="btn" type="button" data-close-sheet>Cancel</button></div>`, trigger);
    $$('.seg button', sh).forEach((b, _, all) => b.addEventListener('click', () => all.forEach((x) => x.setAttribute('aria-pressed', String(x === b)))));
    $('[data-save]', sh).addEventListener('click', () => { closeOverlay(); toast(`${K.title}: saved (mock)`); });
  }
  function wireQuick(root = document) {
    $$('[data-form]', root).forEach((b) => b.addEventListener('click', () => formSheet(b.dataset.form, b)));
  }

  /* ==================================================================== */
  /* DASHBOARD                                                            */
  /* ==================================================================== */
  function dashboard() {
    const nw = M.netWorth, hist = M.netWorthHistory;
    const delta = nw - hist[0], deltaPct = (delta / hist[0]) * 100;
    const mo = M.monthly[M.monthly.length - 1], prev = M.monthly[M.monthly.length - 2];
    const assets = M.accounts.filter((a) => M.toEur(a) >= 0), liabs = M.accounts.filter((a) => M.toEur(a) < 0);
    const aSum = assets.reduce((s, a) => s + M.toEur(a), 0), lSum = liabs.reduce((s, a) => s + M.toEur(a), 0);

    // Net worth area chart (white on brand)
    const W = 800, H = 150, pad = 6;
    const min = Math.min(...hist) * 0.97, max = Math.max(...hist) * 1.01;
    const X = (i) => pad + (i / (hist.length - 1)) * (W - pad * 2), Y = (v) => H - pad - ((v - min) / (max - min)) * (H - pad * 2);
    const pts = hist.map((v, i) => [X(i), Y(v)]);
    const d = pts.map((p, i) => {
      if (!i) return `M${p[0]},${p[1]}`;
      const [x0, y0] = pts[i - 1], cx = (x0 + p[0]) / 2;
      return `C${cx},${y0} ${cx},${p[1]} ${p[0]},${p[1]}`;
    }).join('');
    const last = pts[pts.length - 1];
    const nwChart = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-labelledby="nw-sum">
        <defs><linearGradient id="nwg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.32"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>
        <path class="area-reveal" d="${d}L${W - pad},${H}L${pad},${H}Z" fill="url(#nwg)"/>
        <path class="line-draw" d="${d}" pathLength="1" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
        ${pts.map((p, i) => `<rect x="${p[0] - W / 24}" y="0" width="${W / 12}" height="${H}" fill="transparent" tabindex="0" data-tip="${M.monthly[i].m}: ${fmt(hist[i])}" aria-label="${M.monthly[i].m}, net worth ${fmt(hist[i])}"/>`).join('')}
      </svg>
      <span class="dot-pop" style="position:absolute;left:calc(${(last[0] / W) * 100}% - 8px);top:${last[1] - 8}px;width:16px;height:16px;border-radius:50%;background:var(--sun);box-shadow:0 0 0 3px var(--brand)"></span>
      <p class="sr-only" id="nw-sum">Net worth rose from ${fmt(hist[0])} in ${M.monthly[0].m} to ${fmt(nw)} in ${mo.m}, up ${deltaPct.toFixed(1)} percent over 12 months.</p>`;

    // Category mosaic
    const brk = M.categoryBreakdown;
    const mosaic = brk.map((b, j) => {
      const s = catStyle(b.category_id);
      const narrow = b.percentage < 12;
      return `<button type="button" class="tile ${narrow ? 'narrow' : ''}" style="${s.css};flex:${b.percentage} 1 0;--j:${j}" data-tip="${esc(s.cat.name)}: ${fmt(b.total)}, ${b.percentage}% of spend" aria-label="${esc(s.cat.name)}, ${fmt(b.total)}, ${b.percentage} percent">
        ${ic(s.cat.icon)}<span><span class="t-name">${esc(s.cat.name)}</span><br><span class="t-val num">${compact(b.total)}</span></span><span class="t-pct num">${Math.round(b.percentage)}%</span></button>`;
    }).join('');
    const top = brk.filter((b) => b.category_id !== 'other').slice(0, 5);
    const ranked = top.map((b, j) => {
      const s = catStyle(b.category_id);
      return `<li><span class="cat-ico" style="${s.css}">${ic(s.cat.icon)}</span><span><b style="display:flex;justify-content:space-between;gap:8px"><span>${esc(s.cat.name)}</span><span class="muted num" style="font-weight:700">${b.percentage}%</span></b><span class="bar"><i style="width:${(b.percentage / top[0].percentage) * 100}%;background:${s.bg};--j:${j}"></i></span></span><b class="num">${fmt(b.total)}</b></li>`;
    }).join('');

    // Budgets
    const buds = M.budgets.map((b) => ({ b, m: budgetMeta(b) })).sort((x, y) => y.m.pct - x.m.pct).slice(0, 4);
    const budHtml = buds.map(({ b, m }, j) => {
      const s = catStyle(b.category_id);
      return `<a class="bm" href="budgets.html#${b.id}">${ring({ pct: m.pct, size: 64, stroke: 11, color: s.bg, track: soft(s.bg), delay: 400 + j * 90, label: `${Math.round(m.pct)} percent used`, center: `<b class="num" style="font-size:15px">${Math.round(m.pct)}%</b>` })}
        <span class="bm-meta"><b>${esc(b.name)}</b><span class="small num">${fmt(b.spent, 'EUR', { maximumFractionDigits: 0 })} of ${fmt(b.limit, 'EUR', { maximumFractionDigits: 0 })}</span>${statusChip(m.status)}</span></a>`;
    }).join('');

    // Income vs spend bars
    const BW = 800, BH = 280, bl = 252, maxV = 7000;
    const band = (BW - 40) / 12;
    const bars = M.monthly.map((r, j) => {
      const x = 40 + j * band, bw = Math.min(18, band / 2 - 4);
      const hi = (r.income / maxV) * (bl - 10), hs = (r.spend / maxV) * (bl - 10);
      const net = r.income - r.spend;
      return `<rect class="hit" x="${x}" y="0" width="${band}" height="${BH}" tabindex="0" data-tip="<b>${r.m}</b><br>Income ${fmt(r.income)}<br>Spend ${fmt(r.spend)}<br>Net ${signed(net)}" aria-label="${r.m}: income ${fmt(r.income)}, spend ${fmt(r.spend)}"/>
        <rect class="hl" x="${x + 2}" y="0" width="${band - 4}" height="${bl}" rx="12"/>
        <path class="b" style="--j:${j}" fill="var(--pos-fill)" d="M${x + band / 2 - bw - 2},${bl} v${-hi + 5} q0,-5 5,-5 h${bw - 10} q5,0 5,5 v${hi - 5} z"/>
        <path class="b" style="--j:${j}" fill="var(--brand)" d="M${x + band / 2 + 2},${bl} v${-hs + 5} q0,-5 5,-5 h${bw - 10} q5,0 5,5 v${hs - 5} z"/>
        <text class="axis" x="${x + band / 2}" y="${BH - 6}" text-anchor="middle" ${j === 11 ? 'style="fill:var(--ink);font-weight:800"' : ''}>${r.m}</text>`;
    }).join('');
    const ticks = [0, 2000, 4000, 6000].map((v) => { const y = bl - (v / maxV) * (bl - 10); return `<line class="gridline" x1="40" x2="${BW}" y1="${y}" y2="${y}"/><text class="axis" x="32" y="${y + 4}" text-anchor="end">${v ? v / 1000 + 'k' : '0'}</text>`; }).join('');
    const avgSave = M.monthly.reduce((s, r) => s + r.income - r.spend, 0) / 12;

    // Accounts summary by type
    const TYPE = { CHECKING: 'Current accounts', SAVINGS: 'Savings', INVESTMENT: 'Investments', CASH: 'Cash', GIFT_CARD: 'Gift cards', CREDIT_CARD: 'Credit cards', DEBT: 'Loans and debt' };
    const byType = (list) => { const g = {}; list.forEach((a) => { (g[a.account_type] ||= []).push(a); }); return Object.entries(g).map(([t, as]) => `<li><span><span class="n">${TYPE[t]}</span><br><span class="t">${as.length} account${as.length > 1 ? 's' : ''}</span></span><b class="num">${signed(as.reduce((s, a) => s + M.toEur(a), 0))}</b></li>`).join(''); };

    // Debts
    const owed = M.people.reduce((s, p) => s + p.owes_me, 0), owe = M.people.reduce((s, p) => s + p.i_owe, 0);
    const ppl = M.people.map((p) => `<div class="person"><span class="avatar" aria-hidden="true" style="background:${p.owes_me ? 'var(--pos-fill)' : 'var(--warn-fill)'};color:#15102E">${p.name[0]}</span><span class="grow"><b>${esc(p.name)}</b><br><span class="muted" style="font-size:13px;font-weight:650">${p.owes_me ? 'Owes you' : 'You owe'}</span></span><b class="num ${p.owes_me ? 'in' : ''}">${p.owes_me ? '+' + fmt(p.owes_me) : '-' + fmt(p.i_owe)}</b><button class="btn sm" type="button">${p.owes_me ? 'Remind' : 'Settle'}</button></div>`).join('');

    const recent = M.transactions.slice(0, 7).map((t) => `<li class="tx compact" data-id="${t.id}">${txIcon(t)}<button class="main-btn" type="button" aria-label="${esc(t.title)}, ${signed(t.amount, txCur(t))}, open details"><span class="ttl">${esc(t.title)}</span><span class="meta">${esc(catName(t))} · ${esc(accountName(t.account_id))} · ${shortDate(t.date)}</span></button>${amountCell(t)}</li>`).join('');

    const greet = 'Good morning, ' + M.user.name.split(' ')[0];
    shell(`
      <header class="topbar pop"><div><span class="eyebrow">${TODAY.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</span><h1>${greet}</h1></div>
        <div class="actions"><button class="btn primary" type="button" data-form="tx">${ic('plus')}Add transaction</button><button class="btn" type="button" data-form="transfer">${ic('swap')}Transfer</button><button class="btn" type="button" data-form="import">${ic('upload')}Import</button></div></header>
      <div class="grid">
        <section class="block brandblock hero pop on-block" aria-labelledby="nw-h">
          <span class="hero-blob"></span><span class="hero-blob two"></span>
          <div class="hero-top"><h2 id="nw-h" class="label up on-brand-2">Net worth</h2><span title="The 12 month history chart needs a backend endpoint">${nb()}</span></div>
          <div><p class="mega num" data-count="${nw}" data-mode="split" data-dur="1600">${fmt(nw)}</p>
            <span class="trend" style="margin-top:12px">${ic('up')}Up ${fmt(delta, 'EUR', { maximumFractionDigits: 0 })} (${deltaPct.toFixed(1)}%) in 12 months</span></div>
          <div class="kv"><div><span class="label on-brand-2">Assets</span><b class="mid num">${fmt(aSum, 'EUR', { maximumFractionDigits: 0 })}</b></div><div><span class="label on-brand-2">Liabilities</span><b class="mid num">-${fmt(-lSum, 'EUR', { maximumFractionDigits: 0 })}</b></div><div><span class="label on-brand-2">Accounts</span><b class="mid num">${M.accounts.length}</b></div></div>
          <div class="hero-chart">${nwChart}</div>
        </section>
        <section class="block sunblock month-block pop" aria-labelledby="mo-h">
          <div><h2 id="mo-h" class="label up">September so far</h2><p class="big num" style="margin-top:10px;font-size:52px" data-count="${mo.income - mo.spend}" data-mode="signed">${signed(mo.income - mo.spend)}</p><p style="font-weight:750;margin-top:6px">Net saved, ${Math.round(((mo.income - mo.spend) / mo.income) * 100)}% of income</p></div>
          <div><div class="row"><span style="display:flex;gap:8px;align-items:center;font-weight:750">${ic('inflow', 'width="20" height="20"')}Money in</span><b class="mid num">+${fmt(mo.income)}</b></div>
          <div class="row"><span style="display:flex;gap:8px;align-items:center;font-weight:750">${ic('outflow', 'width="20" height="20"')}Money out</span><b class="mid num">-${fmt(mo.spend)}</b></div>
          <p style="font-size:13.5px;font-weight:700">Spend ${mo.spend > prev.spend ? 'up' : 'down'} ${fmt(Math.abs(mo.spend - prev.spend), 'EUR', { maximumFractionDigits: 0 })} on August</p></div>
          <div class="qa"><button class="btn onsun" type="button" data-form="tx">${ic('plus')}Add</button><button class="btn onsun-2" type="button" data-form="transfer">${ic('swap')}Transfer</button><button class="btn onsun-2" type="button" data-form="import">${ic('upload')}Import</button></div>
        </section>

        <section class="card s7 pop" aria-labelledby="cat-h">
          <div class="card-head"><div><h2 id="cat-h">Where it went</h2><p class="sub">Spending by category, September, ${fmt(brk.reduce((s, b) => s + b.total, 0))}</p></div><a class="more" href="transactions.html">All spending</a></div>
          <div class="mosaic" role="group" aria-label="Spending by category">${mosaic}</div>
          <h3 style="font-size:15px;font-weight:820;margin-bottom:12px">Top categories</h3>
          <ol class="ranked">${ranked}</ol>
        </section>
        <section class="card s5 pop" aria-labelledby="bud-h">
          <div class="card-head"><div><h2 id="bud-h">Budgets</h2><p class="sub">Closest to the limit first</p></div><a class="more" href="budgets.html">All budgets</a></div>
          <div class="budget-mini">${budHtml}</div>
          <div style="margin-top:18px">
            <div class="card-head" style="margin-bottom:12px"><h2 style="font-size:17px">Debts</h2><a class="more" href="#" aria-disabled="true">People</a></div>
            <div class="debt-sum"><div class="owed"><span class="label">Owed to you</span><b class="mid num" style="display:block;margin-top:4px">+${fmt(owed)}</b></div><div class="owe"><span class="label">You owe</span><b class="mid num" style="display:block;margin-top:4px">-${fmt(owe)}</b></div></div>
            <div class="people">${ppl}</div>
          </div>
        </section>

        <section class="card s7 pop bars" aria-labelledby="ivs-h">
          <div class="card-head"><div><h2 id="ivs-h">Income vs spend</h2><p class="sub">Last 12 months, you kept ${fmt(avgSave, 'EUR', { maximumFractionDigits: 0 })} a month on average</p></div>${nb()}</div>
          <div class="legend" style="margin-bottom:10px"><span><i style="background:var(--pos-fill)"></i>Income</span><span><i style="background:var(--brand)"></i>Spend</span></div>
          <div class="bars-scroll" tabindex="0" aria-label="Income vs spend chart, scrolls sideways on small screens"><svg viewBox="0 0 ${BW} ${BH}" role="img" aria-labelledby="ivs-sum">${ticks}${bars}</svg></div>
          <p class="sr-only" id="ivs-sum">Income was between ${fmt(5180)} and ${fmt(6900)} each month. Spend peaked at ${fmt(5210)} in December and was ${fmt(mo.spend)} in September.</p>
        </section>
        <section class="card s5 pop" aria-labelledby="acc-h">
          <div class="card-head"><div><h2 id="acc-h">Accounts</h2><p class="sub">What you own and what you owe</p></div><a class="more" href="accounts.html">All accounts</a></div>
          <div class="split-bar" role="img" aria-label="Assets ${fmt(aSum)}, liabilities ${fmt(-lSum)}"><i class="asset" style="flex:${aSum}"></i><i class="liab" style="flex:${-lSum}"></i></div>
          <div class="two-col">
            <div><p class="group-h"><span class="sw" style="background:var(--pos-fill)"></span>Assets <span class="num" style="margin-inline-start:auto">${fmt(aSum, 'EUR', { maximumFractionDigits: 0 })}</span></p><ul class="acct-list">${byType(assets)}</ul></div>
            <div><p class="group-h"><span class="sw" style="background:repeating-linear-gradient(135deg,var(--neg-fill) 0 3px,transparent 3px 6px)"></span>Liabilities <span class="num" style="margin-inline-start:auto">-${fmt(-lSum, 'EUR', { maximumFractionDigits: 0 })}</span></p><ul class="acct-list">${byType(liabs)}</ul></div>
          </div>
        </section>

        <section class="card s12 pop" aria-labelledby="rec-h">
          <div class="card-head"><div><h2 id="rec-h">Recent transactions</h2><p class="sub">Latest ${7} of 214 this month</p></div><a class="more" href="transactions.html">See all</a></div>
          <ul class="tx-list" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(min(420px,100%),1fr));column-gap:24px">${recent}</ul>
        </section>
      </div>`);
    $$('.tx.compact .main-btn').forEach((b) => b.addEventListener('click', () => txSheet(M.transactions.find((t) => t.id === b.closest('.tx').dataset.id), b)));
    wireQuick();
  }

  /* ==================================================================== */
  /* TRANSACTIONS                                                         */
  /* ==================================================================== */
  function transactions() {
    const months = ['2026-07', '2026-08', '2026-09', '2026-10'];
    const st = { mi: 2, q: '', sign: 'all', acc: '', cat: '', person: '', from: '', to: '', min: '', max: '', splits: false, transfer: false, view: 'data', sel: new Set(), deleted: new Set() };
    const TOTAL = 214;
    const monthName = (k) => new Date(k + '-15').toLocaleDateString('en-US', { month: 'long' });
    const opt = (list, lab) => `<option value="">${lab}</option>` + list;
    shell(`
      <header class="topbar pop"><div><span class="eyebrow">Activity</span><h1>Transactions</h1></div>
        <div class="actions"><button class="btn primary" type="button" data-form="tx">${ic('plus')}Add transaction</button><button class="btn" type="button" data-form="transfer">${ic('swap')}Transfer</button><button class="btn" type="button" data-form="import">${ic('upload')}Import CSV</button></div></header>
      <section class="month-hero pop" aria-label="Month summary">
        <div class="block brandblock month-nav">
          <div class="ctrl"><button class="icon-btn" type="button" id="m-prev" aria-label="Previous month">${ic('chevL')}</button><button class="icon-btn" type="button" id="m-next" aria-label="Next month">${ic('chevR')}</button></div>
          <h2 class="month-title" id="m-title" aria-live="polite"></h2>
        </div>
        <div class="summary" id="m-sum"></div>
      </section>
      <div class="toolbar pop">
        <div class="field search"><label for="q">Search title and notes</label><input class="input" id="q" type="search" autocomplete="off">${ic('search')}</div>
        <div class="field"><span class="flabel" id="sign-l">Direction</span><div class="seg" role="group" aria-labelledby="sign-l" id="sign">${[['all', 'All'], ['out', 'Money out'], ['in', 'Money in']].map(([v, l]) => `<button type="button" data-v="${v}" aria-pressed="${v === 'all'}">${l}</button>`).join('')}</div></div>
        <button class="btn" type="button" id="f-toggle" aria-expanded="false" aria-controls="filters">${ic('filter')}Filters <span class="chip brand" id="f-count" hidden></span></button>
      </div>
      <section class="filters" id="filters" hidden aria-label="Filters">
        <div class="field"><label for="f-acc">Account</label><select class="select" id="f-acc">${opt(M.accounts.map((a) => `<option value="${a.id}">${esc(a.name)}</option>`).join(''), 'All accounts')}</select></div>
        <div class="field"><label for="f-cat">Category</label><select class="select" id="f-cat">${opt(M.categories.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join(''), 'All categories')}</select></div>
        <div class="field"><label for="f-per">Person</label><select class="select" id="f-per">${opt(M.people.map((p) => `<option>${esc(p.name)}</option>`).join(''), 'Anyone')}</select></div>
        <div class="field"><span class="flabel">Date range</span><div class="range"><label class="sr-only" for="f-from">From date</label><input class="input" type="date" id="f-from" aria-label="From date"><label class="sr-only" for="f-to">To date</label><input class="input" type="date" id="f-to" aria-label="To date"></div></div>
        <div class="field"><span class="flabel">Amount (EUR)</span><div class="range"><input class="input num" id="f-min" inputmode="decimal" aria-label="Minimum amount" placeholder="Min"><input class="input num" id="f-max" inputmode="decimal" aria-label="Maximum amount" placeholder="Max"></div></div>
        <div class="field" style="grid-column:span 2"><span class="flabel">Only show</span><div class="checks"><label><input type="checkbox" class="cbx" id="f-spl">Has splits</label><label><input type="checkbox" class="cbx" id="f-trf">In a transfer</label></div></div>
        <div class="field" style="justify-content:flex-end"><button class="btn sm" type="button" id="f-clear">Clear filters</button></div>
      </section>
      <div class="active-filters" id="chips"></div>
      <div class="bulk" id="bulk" hidden role="region" aria-label="Bulk actions"><b id="bulk-n"></b><button class="btn sm" type="button">${ic('categories')}Categorise</button><button class="btn sm" type="button" id="bulk-del">${ic('trash')}Delete</button><button class="icon-btn" type="button" id="bulk-x" aria-label="Clear selection" style="background:transparent;color:inherit">${ic('x')}</button></div>
      <section class="card list-card pop" aria-label="Transaction list">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;padding:4px 8px 12px;flex-wrap:wrap">
          <label style="display:inline-flex;gap:10px;align-items:center;font-weight:750"><input type="checkbox" class="cbx" id="sel-all">Select all shown</label>
          <div class="state-demo" role="group" aria-label="Mock state preview">Preview state <div class="seg" id="view">${['data', 'loading', 'empty', 'error'].map((v) => `<button type="button" data-v="${v}" aria-pressed="${v === 'data'}">${v[0].toUpperCase() + v.slice(1)}</button>`).join('')}</div></div>
        </div>
        <div id="list"></div>
      </section>`);
    wireQuick();

    const inputs = { q: $('#q'), acc: $('#f-acc'), cat: $('#f-cat'), person: $('#f-per'), from: $('#f-from'), to: $('#f-to'), min: $('#f-min'), max: $('#f-max') };
    const LABELS = { acc: (v) => accountName(v), cat: (v) => catOf(v).name, person: (v) => 'With ' + v, from: (v) => 'From ' + shortDate(v), to: (v) => 'Until ' + shortDate(v), min: (v) => 'At least ' + fmt(+v), max: (v) => 'At most ' + fmt(+v) };

    function filtered() {
      if (months[st.mi] !== '2026-09') return [];
      return M.transactions.filter((t) => {
        if (st.deleted.has(t.id)) return false;
        const q = st.q.trim().toLowerCase();
        if (q && !(t.title.toLowerCase().includes(q) || (t.notes || '').toLowerCase().includes(q))) return false;
        if (st.sign === 'in' && t.amount <= 0) return false;
        if (st.sign === 'out' && t.amount >= 0) return false;
        if (st.acc && t.account_id !== st.acc) return false;
        if (st.cat && t.category_id !== st.cat) return false;
        if (st.person && !((t.splits || []).some((s) => s.person === st.person) || t.debt?.paidBy === st.person || t.title.includes(st.person))) return false;
        if (st.from && t.date < st.from) return false;
        if (st.to && t.date > st.to) return false;
        const e = Math.abs(txEur(t));
        if (st.min && e < +st.min) return false;
        if (st.max && e > +st.max) return false;
        if (st.splits && !t.splits) return false;
        if (st.transfer && !t.transfer) return false;
        return true;
      });
    }
    function renderMonth(animate) {
      const k = months[st.mi];
      const t = $('#m-title');
      t.innerHTML = `${monthName(k)}<span>${k.slice(0, 4)}</span>`;
      if (animate) { t.classList.remove('swap'); void t.offsetWidth; t.classList.add('swap'); }
      $('#m-prev').disabled = st.mi === 0; $('#m-next').disabled = st.mi === months.length - 1;
      const mm = M.monthly.find((r) => r.m === monthName(k).slice(0, 3));
      const inc = k === '2026-10' ? 0 : mm.income, sp = k === '2026-10' ? 0 : mm.spend;
      $('#m-sum').innerHTML = `
        <div class="sum inc"><span class="lab">${ic('inflow')}Income</span><b class="mid num" ${animate ? '' : `data-count="${inc}" data-mode="signed"`}>${signed(inc)}</b></div>
        <div class="sum out"><span class="lab">${ic('outflow')}Spend</span><b class="mid num" ${animate ? '' : `data-count="${-sp}" data-mode="signed"`}>${signed(-sp)}</b></div>
        <div class="sum net"><span class="lab">${ic('coin')}Net</span><b class="mid num" ${animate ? '' : `data-count="${inc - sp}" data-mode="signed"`}>${signed(inc - sp)}</b></div>`;
      if (!animate) countUps($('#m-sum'));
    }
    function renderChips() {
      const act = Object.keys(LABELS).filter((k) => st[k]);
      const n = act.length + (st.splits ? 1 : 0) + (st.transfer ? 1 : 0);
      const c = $('#f-count'); c.hidden = !n; c.textContent = n;
      $('#chips').innerHTML = act.map((k) => `<button type="button" class="fchip" data-k="${k}" aria-label="Remove filter ${esc(LABELS[k](st[k]))}">${esc(LABELS[k](st[k]))}${ic('x')}</button>`).join('') +
        (st.splits ? `<button type="button" class="fchip" data-k="splits" aria-label="Remove filter has splits">Has splits${ic('x')}</button>` : '') +
        (st.transfer ? `<button type="button" class="fchip" data-k="transfer" aria-label="Remove filter in a transfer">In a transfer${ic('x')}</button>` : '');
      $$('#chips .fchip').forEach((b) => b.addEventListener('click', () => { const k = b.dataset.k; if (k === 'splits' || k === 'transfer') { st[k] = false; $(k === 'splits' ? '#f-spl' : '#f-trf').checked = false; } else { st[k] = ''; inputs[k].value = ''; } update(); }));
    }
    const skel = (n) => Array.from({ length: n }, () => '<div class="skel" aria-hidden="true"><i class="sq"></i><span style="display:flex;flex-direction:column;gap:8px"><i style="width:55%"></i><i style="width:35%;height:10px"></i></span><i></i></div>').join('');
    function renderList() {
      const L = $('#list');
      if (st.view === 'loading') { L.innerHTML = `<p class="sr-only" role="status">Loading transactions</p>${skel(7)}`; return; }
      if (st.view === 'error') { L.innerHTML = `<div class="empty err" role="alert"><span class="art">${ic('alert')}</span><h3>We could not load transactions</h3><p>The server did not answer. Nothing was lost, your data is safe.</p><button class="btn primary" type="button" id="retry">${ic('sync')}Try again</button></div>`; $('#retry').onclick = () => setView('data'); return; }
      const rows = st.view === 'empty' ? [] : filtered();
      if (!rows.length) {
        const filteredOut = st.view !== 'empty' && months[st.mi] === '2026-09';
        L.innerHTML = `<div class="empty"><span class="art">${ic(filteredOut ? 'search' : 'coin')}</span><h3>${filteredOut ? 'Nothing matches these filters' : `No transactions in ${monthName(months[st.mi])} yet`}</h3><p>${filteredOut ? 'Try a wider date range or clear a filter.' : 'Add one by hand, or import a CSV from your bank.'}</p><div class="actions" style="justify-content:center">${filteredOut ? '<button class="btn" type="button" id="e-clear">Clear filters</button>' : `<button class="btn primary" type="button" data-form="tx">${ic('plus')}Add transaction</button><button class="btn" type="button" data-form="import">${ic('upload')}Import CSV</button>`}</div></div>`;
        $('#e-clear')?.addEventListener('click', clearAll); wireQuick(L); return;
      }
      const days = {};
      rows.forEach((t) => (days[t.date] ||= []).push(t));
      L.innerHTML = Object.entries(days).map(([d, ts]) => {
        const sub = ts.reduce((s, t) => s + txEur(t), 0);
        return `<section class="day" aria-label="${dayLabel(d)}"><div class="day-h"><h3>${dayLabel(d)}</h3><span class="sub num">${signed(sub)}<span class="sr-only"> day total</span></span></div><ul class="tx-list">${ts.map((t) => `
          <li class="tx ${st.sel.has(t.id) ? 'selected' : ''}" data-id="${t.id}">
            <input type="checkbox" class="cbx check" aria-label="Select ${esc(t.title)}" ${st.sel.has(t.id) ? 'checked' : ''}>
            ${txIcon(t)}
            <button class="main-btn" type="button" aria-label="${esc(t.title)}, ${signed(t.amount, txCur(t))}, open details"><span class="ttl">${esc(t.title)}</span><span class="meta">${esc(catName(t))} · ${esc(accountName(t.account_id))}</span></button>
            ${amountCell(t)}
            <button class="icon-btn kebab" type="button" aria-label="Actions for ${esc(t.title)}" aria-haspopup="menu" aria-expanded="false">${ic('dots')}</button>
          </li>`).join('').replace(/<button class="main-btn"([^>]*)>(.*?)<\/button>/gs, (m0) => m0)}</ul></section>`;
      }).join('') + `<div class="list-foot"><span role="status">${rows.length === M.transactions.length - st.deleted.size ? `Showing ${rows.length} of ${TOTAL - st.deleted.size}` : `${rows.length} matching in the loaded rows, searching the rest of the month`}</span><span>Loading more as you scroll</span></div>${skel(2)}`;
      // add badges under meta (kept inside the row button's column)
      $$('.tx', L).forEach((li) => {
        const t = M.transactions.find((x) => x.id === li.dataset.id);
        const bd = txBadges(t);
        if (bd) $('.main-btn', li).insertAdjacentHTML('beforeend', `<span class="badges">${bd}</span>`);
        $('.main-btn', li).addEventListener('click', (e) => txSheet(t, e.currentTarget, { del: () => del([t.id]) }));
        $('.check', li).addEventListener('change', (e) => { e.target.checked ? st.sel.add(t.id) : st.sel.delete(t.id); li.classList.toggle('selected', e.target.checked); renderBulk(); });
        $('.kebab', li).addEventListener('click', (e) => openMenu(e.currentTarget, [
          { icon: 'pencil', label: 'Edit', run: () => txSheet(t, $('.main-btn', li), { del: () => del([t.id]) }) },
          { icon: 'copy', label: 'Duplicate', run: () => toast(`Duplicated "${esc(t.title)}"`) },
          ...(t.transfer ? [] : [{ icon: 'swap', label: 'Convert to transfer', run: () => toast('Pick the other leg to link as a transfer') }]),
          '-',
          { icon: 'trash', label: 'Delete', danger: true, run: () => del([t.id]) },
        ]));
      });
    }
    function renderBulk() {
      const n = st.sel.size;
      $('#bulk').hidden = !n; $('#bulk-n').textContent = `${n} selected`;
      const shown = $$('.tx .check'); $('#sel-all').checked = shown.length > 0 && shown.every((c) => c.checked);
    }
    function del(ids) {
      const els = ids.map((id) => $(`.tx[data-id="${id}"]`)).filter(Boolean);
      els.forEach((el) => el.classList.add('removing'));
      setTimeout(() => {
        ids.forEach((id) => { st.deleted.add(id); st.sel.delete(id); });
        renderList(); renderBulk();
      }, reduced() ? 0 : 200);
      toast(`${ids.length === 1 ? 'Transaction' : ids.length + ' transactions'} moved to Trash`, () => { ids.forEach((id) => st.deleted.delete(id)); renderList(); });
    }
    function setView(v) { st.view = v; $$('#view button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === v))); renderList(); }
    function clearAll() { Object.keys(LABELS).forEach((k) => { st[k] = ''; inputs[k].value = ''; }); st.splits = st.transfer = false; $('#f-spl').checked = $('#f-trf').checked = false; update(); }
    function update() { renderChips(); renderList(); renderBulk(); }

    inputs.q.addEventListener('input', () => { st.q = inputs.q.value; renderList(); renderBulk(); });
    ['acc', 'cat', 'person', 'from', 'to', 'min', 'max'].forEach((k) => inputs[k].addEventListener('change', () => { st[k] = inputs[k].value; update(); }));
    $('#f-spl').addEventListener('change', (e) => { st.splits = e.target.checked; update(); });
    $('#f-trf').addEventListener('change', (e) => { st.transfer = e.target.checked; update(); });
    $('#f-clear').addEventListener('click', clearAll);
    $$('#sign button').forEach((b) => b.addEventListener('click', () => { st.sign = b.dataset.v; $$('#sign button').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); renderList(); renderBulk(); }));
    $('#f-toggle').addEventListener('click', (e) => { const f = $('#filters'); f.hidden = !f.hidden; e.currentTarget.setAttribute('aria-expanded', String(!f.hidden)); });
    $$('#view button').forEach((b) => b.addEventListener('click', () => setView(b.dataset.v)));
    $('#m-prev').addEventListener('click', () => { st.mi--; renderMonth(true); renderList(); });
    $('#m-next').addEventListener('click', () => { st.mi++; renderMonth(true); renderList(); });
    $('#sel-all').addEventListener('change', (e) => { $$('.tx').forEach((li) => { const id = li.dataset.id; e.target.checked ? st.sel.add(id) : st.sel.delete(id); li.classList.toggle('selected', e.target.checked); $('.check', li).checked = e.target.checked; }); renderBulk(); });
    $('#bulk-del').addEventListener('click', () => del([...st.sel]));
    $('#bulk-x').addEventListener('click', () => { st.sel.clear(); update(); });
    renderMonth(false); update();
    // Screenshot / demo hooks
    const hash = location.hash.slice(1);
    if (hash === 'detail') setTimeout(() => $('.tx[data-id="t2"] .main-btn')?.click(), 50);
    if (hash === 'show-filters') { $('#f-toggle').click(); inputs.cat.value = 'c-groc'; st.cat = 'c-groc'; $('#f-spl').checked = false; update(); }
    if (hash === 'bulk') { ['t1', 't5'].forEach((id) => st.sel.add(id)); update(); }
    if (['loading', 'empty', 'error'].includes(hash)) setView(hash);
  }

  /* ==================================================================== */
  /* ACCOUNTS                                                             */
  /* ==================================================================== */
  function accounts() {
    const TYPES = [
      ['CHECKING', 'Current accounts', '#4318FF'], ['SAVINGS', 'Savings', '#16A34A'], ['INVESTMENT', 'Investments', '#0EA5E9'],
      ['CASH', 'Cash', '#FFC400', 0.82], ['GIFT_CARD', 'Gift cards', '#EC4899'], ['CREDIT_CARD', 'Credit cards', null], ['DEBT', 'Loans and debt', null],
    ];
    const LIAB = new Set(['CREDIT_CARD', 'DEBT']);
    const total = M.netWorth;
    const assets = M.accounts.filter((a) => !LIAB.has(a.account_type)), liabs = M.accounts.filter((a) => LIAB.has(a.account_type));
    const aSum = assets.reduce((s, a) => s + M.toEur(a), 0), lSum = liabs.reduce((s, a) => s + M.toEur(a), 0);
    const typeLabel = (t) => TYPES.find((x) => x[0] === t)[1].replace(/s$/, '').replace('Current account', 'Current account').replace('Loans and debt', 'Loan');
    const card = (a, base, L = 0.6) => {
      const liab = LIAB.has(a.account_type);
      const { bg, fg } = liab ? { bg: null, fg: null } : blockColor(base, L);
      const eur = M.toEur(a);
      const style = liab ? '' : `background:${bg};color:${fg}`;
      const dark = fg && fg !== '#FFFFFF';
      return `<article class="acard pop ${liab ? 'liability' : ''} ${dark ? 'dark-text' : ''}" style="${style}" data-id="${a.id}" aria-labelledby="an-${a.id}">
        <span class="shine"></span>
        <div class="top"><div><h3 class="nm" id="an-${a.id}">${esc(a.name)}</h3><p class="ty">${typeLabel(a.account_type)} <span class="cur">${a.currency}</span>${liab ? `<span class="chip bad">${ic('alert')}Liability</span>` : ''}</p></div>
          <button class="icon-btn kebab" type="button" aria-label="Actions for ${esc(a.name)}" aria-haspopup="menu" aria-expanded="false">${ic('dots')}</button></div>
        <div class="bal">${liab ? '<span class="label" style="display:block;margin-bottom:4px">You owe</span>' : ''}<b class="num">${signed(a.balance, a.currency).replace(/^\+/, '')}</b>${a.currency !== 'EUR' ? `<small class="num">About ${fmt(eur)} at ${M.fx[a.currency]}</small>` : ''}</div>
        <div class="foot">${a.provider ? `<span class="sync">${ic('sync')}<span>${a.provider}, synced <span data-synced>${a.synced}</span></span></span><button class="btn syncbtn" type="button" data-sync>${ic('sync')}Sync now</button>` : '<span class="sync">Manual account</span>'}
          ${a.dayChange != null ? `<span class="day-change" aria-label="Day change ${a.dayChange > 0 ? 'up' : 'down'} ${Math.abs(a.dayChange)} percent">${ic(a.dayChange > 0 ? 'up' : 'down')}${a.dayChange > 0 ? '+' : '-'}${Math.abs(a.dayChange)}% today</span>` : ''}</div>
      </article>`;
    };
    const groups = TYPES.map(([t, label, base, L]) => {
      const list = M.accounts.filter((a) => a.account_type === t);
      if (!list.length) return '';
      const sum = list.reduce((s, a) => s + M.toEur(a), 0);
      return `<section class="acct-group" style="--n:${list.length}" aria-labelledby="g-${t}"><header><h2 id="g-${t}">${label} <span class="count">${list.length}</span></h2><span class="num">${LIAB.has(t) ? 'You owe ' + fmt(-sum) : fmt(sum)}</span></header>
        <div class="acct-cards">${list.map((a) => card(a, base || '#999', L)).join('')}</div></section>`;
    });
    const linked = M.accounts.filter((a) => a.provider);
    shell(`
      <header class="topbar pop"><div><span class="eyebrow">Money</span><h1>Accounts</h1></div>
        <div class="actions"><button class="btn primary" type="button" data-form="account">${ic('plus')}Add account</button><button class="btn" type="button" data-form="connect">${ic('plug')}Connect provider</button></div></header>
      <div class="acct-hero">
        <section class="block brandblock pop" aria-labelledby="tb-h"><span class="hero-blob"></span>
          <h2 id="tb-h" class="label up on-brand-2">Total balance in EUR</h2>
          <p class="mega num" data-count="${total}" data-mode="split">${fmt(total)}</p>
          <div class="split-bar" role="img" aria-label="Assets ${fmt(aSum)}, liabilities ${fmt(-lSum)}"><i class="asset" style="flex:${aSum}"></i><i class="liab" style="flex:${-lSum}"></i></div>
          <div class="kv"><div><span class="label on-brand-2">Assets, ${assets.length} accounts</span><b class="mid num">${fmt(aSum)}</b></div><div><span class="label on-brand-2">Liabilities, ${liabs.length} accounts (striped)</span><b class="mid num">-${fmt(-lSum)}</b></div><div><span class="label on-brand-2">Currencies</span><b class="mid">${[...new Set(M.accounts.map((a) => a.currency))].join(', ')}</b></div></div>
        </section>
        <section class="card provider-card pop" aria-labelledby="pv-h">
          <div class="card-head" style="margin-bottom:0"><div><h2 id="pv-h">Connected</h2><p class="sub">${linked.length} accounts sync automatically</p></div><button class="btn sm" type="button" data-form="connect">${ic('plus')}Connect</button></div>
          ${linked.map((a) => `<div class="prov"><span class="logo" style="background:${a.provider === 'TrueLayer' ? '#1A1A1A' : '#0A6EF0'}">${a.provider === 'TrueLayer' ? 'TL' : '212'}</span><span class="grow"><b>${esc(a.name)}</b><span>${a.provider}, last synced ${a.synced}</span></span><span class="chip ok">${ic('check')}Healthy</span></div>`).join('')}
          <p class="hint">Archived accounts ${nb()}</p>
        </section>
      </div>
      <div class="acct-groups">${groups.join('')}
      <div class="acct-group" style="--n:2"><header aria-hidden="true"><h2>&nbsp;</h2></header>
      <button class="acard add pop" type="button" data-form="account" style="width:100%;height:calc(100% - 50px);min-height:180px;border-radius:var(--r-xl)"><span class="plus">${ic('plus')}</span><b style="font-size:18px">Add another account</b><span class="muted">Checking, savings, cards, cash, investments or debt</span></button></div></div>`);
    wireQuick();
    // tilt on hover (fine pointers only, not under reduced motion)
    if (matchMedia('(hover: hover) and (pointer: fine)').matches && !reduced()) {
      $$('.acard:not(.add)').forEach((c) => {
        c.addEventListener('pointermove', (e) => {
          const r = c.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
          c.style.transform = `rotateX(${(0.5 - py) * 7}deg) rotateY(${(px - 0.5) * 9}deg) translateY(-4px)`;
          c.style.setProperty('--mx', px * 100 + '%'); c.style.setProperty('--my', py * 100 + '%');
        });
        c.addEventListener('pointerleave', () => { c.style.transform = ''; });
      });
    }
    $$('[data-sync]').forEach((b) => b.addEventListener('click', () => {
      b.classList.add('spinning'); b.disabled = true; b.lastChild.textContent = 'Syncing';
      setTimeout(() => { b.classList.remove('spinning'); b.disabled = false; b.lastChild.textContent = 'Sync now'; const s = b.closest('.acard').querySelector('[data-synced]'); s.textContent = 'just now'; toast(`${esc(b.closest('.acard').querySelector('.nm').textContent)} synced`); }, 1400);
    }));
    $$('.acard .kebab').forEach((k) => k.addEventListener('click', (e) => {
      const a = M.acct(k.closest('.acard').dataset.id);
      openMenu(e.currentTarget, [
        { icon: 'pencil', label: 'Edit account', run: () => formSheet('account', k) },
        ...(a.provider ? [{ icon: 'sync', label: 'Sync now', run: () => k.closest('.acard').querySelector('[data-sync]').click() }] : [{ icon: 'plug', label: 'Connect provider', run: () => formSheet('connect', k) }]),
        { icon: 'archive', label: 'Archive', disabled: true, chip: '<span class="nb" style="margin-inline-start:auto">Needs backend</span>' },
        '-',
        { icon: 'trash', label: 'Delete account', danger: true, run: () => toast(`${esc(a.name)} deleted`, () => {}) },
      ]);
    }));
  }

  /* ==================================================================== */
  /* BUDGETS                                                              */
  /* ==================================================================== */
  function budgets() {
    const list = M.budgets.map((b) => ({ b, m: budgetMeta(b) }));
    const lim = M.budgets.reduce((s, b) => s + b.limit, 0), spent = M.budgets.reduce((s, b) => s + b.spent, 0);
    const pct = (spent / lim) * 100;
    const counts = { OK: 0, WARNING: 0, EXCEEDED: 0 }; list.forEach(({ m }) => counts[m.status]++);
    const periodName = (p) => p[0] + p.slice(1).toLowerCase();
    const card = ({ b, m }, j) => {
      const s = catStyle(b.category_id);
      const trackOn = s.dark ? 'rgba(21,16,46,0.14)' : 'rgba(255,255,255,0.28)';
      const ringColor = s.dark ? '#15102E' : '#FFFFFF';
      return `<article class="bcard pop" id="${b.id}" aria-labelledby="bn-${b.id}">
        <div class="bhead ${s.dark ? 'dark-text' : ''}" style="${s.css}">
          ${ring({ pct: m.pct, size: 104, stroke: 12, color: ringColor, track: trackOn, delay: 350 + j * 90, label: `${Math.round(m.pct)} percent of limit used`, center: `<span style="display:block"><b class="num">${Math.round(m.pct)}%</b><span>used</span></span>` })}
          <div style="min-width:0"><h3 class="nm" id="bn-${b.id}">${esc(b.name)}</h3><p class="sub">${ic(s.cat.icon, 'width="15" height="15"')}${esc(s.cat.name)} · ${periodName(b.period)}</p></div>
          <button class="icon-btn kebab" type="button" aria-label="Actions for ${esc(b.name)} budget" aria-haspopup="menu" aria-expanded="false">${ic('dots')}</button>
        </div>
        <div class="bbody">
          <div style="display:flex;gap:6px;flex-wrap:wrap">${statusChip(m.status)}<span class="chip ${m.pace === 'On track' ? '' : m.pace === 'Over limit' ? 'bad' : 'warn'}">${ic(m.pace === 'On track' ? 'check' : 'up')}${m.pace}</span><span class="chip">${ic('clock')}${m.daysLeft} day${m.daysLeft === 1 ? '' : 's'} left</span></div>
          <div class="bstats"><div><span>Spent</span><b class="num">${fmt(b.spent)}</b></div><div><span>Limit</span><b class="num">${fmt(b.limit, 'EUR', { maximumFractionDigits: 0 })}</b></div><div><span>${m.remaining < 0 ? 'Over by' : 'Remaining'}</span><b class="num" style="${m.remaining < 0 ? 'color:var(--neg)' : ''}">${m.remaining < 0 ? '-' : ''}${fmt(Math.abs(m.remaining))}</b></div></div>
          <div><div class="pace-bar" role="img" aria-label="${Math.round(m.pct)} percent spent, ${Math.round(m.expected)} percent of the period gone"><i style="width:${Math.min(100, m.pct)}%;background:${m.status === 'EXCEEDED' ? 'var(--neg-fill)' : m.status === 'WARNING' ? 'var(--warn-fill)' : s.bg}"></i><span class="today" style="left:calc(${m.expected}% - 1.5px)"></span></div>
          <p class="hint" style="margin-top:6px">Marker shows how much of the ${periodName(b.period).toLowerCase()} period has passed (${Math.round(m.expected)}%)</p></div>
          <button class="btn sm open" type="button" data-open="${b.id}">${ic('transactions')}Details and transactions</button>
        </div></article>`;
    };
    shell(`
      <header class="topbar pop"><div><span class="eyebrow">Plan</span><h1>Budgets</h1></div>
        <div class="actions"><button class="btn primary" type="button" data-form="budget">${ic('plus')}Create budget</button></div></header>
      <section class="block brandblock bud-hero pop" aria-labelledby="ov-h"><span class="hero-blob"></span>
        ${ring({ pct, size: 220, stroke: 13, color: 'var(--sun)', track: 'rgba(255,255,255,0.2)', delay: 250, label: `${Math.round(pct)} percent of all budgets used`, center: `<span style="display:block"><b class="num" data-count="${pct}" data-mode="pct">${Math.round(pct)}%</b><span>of all limits</span></span>` })}
        <div style="display:flex;flex-direction:column;gap:16px;position:relative">
          <h2 id="ov-h" class="label up on-brand-2">This period, ${list.length} budgets</h2>
          <p class="mega num" style="font-size:clamp(44px,6vw,88px)"><span data-count="${spent}">${fmt(spent)}</span></p>
          <p style="font-weight:750;font-size:18px">spent of ${fmt(lim, 'EUR', { maximumFractionDigits: 0 })}, ${fmt(lim - spent)} left across all budgets</p>
          <div class="statuses">${['OK', 'WARNING', 'EXCEEDED'].map((k) => `<span class="chip ${STATUS[k].cls}">${ic(STATUS[k].icon)}${counts[k]} ${STATUS[k].label}</span>`).join('')}</div>
        </div>
      </section>
      <div class="bud-grid">${list.map(card).join('')}</div>`);
    wireQuick();
    const openB = (id, trig) => budgetSheet(list.find((x) => x.b.id === id), trig);
    $$('[data-open]').forEach((b) => b.addEventListener('click', () => openB(b.dataset.open, b)));
    $$('.bcard .kebab').forEach((k) => k.addEventListener('click', (e) => {
      const id = k.closest('.bcard').id;
      openMenu(e.currentTarget, [
        { icon: 'transactions', label: 'Open details', run: () => openB(id, k) },
        { icon: 'pencil', label: 'Edit budget', run: () => formSheet('budget', k) },
        '-',
        { icon: 'trash', label: 'Delete budget', danger: true, run: () => toast('Budget deleted', () => {}) },
      ]);
    }));
    if (location.hash === '#detail') setTimeout(() => openB('b-shop', $('[data-open="b-shop"]')), 50);
    else if (location.hash.startsWith('#b-')) { const el = $(location.hash); if (el) { el.classList.add('featured'); el.scrollIntoView({ block: 'center' }); } }
  }
  function budgetSheet({ b, m }, trigger) {
    const s = catStyle(b.category_id);
    const tx = M.transactions.filter((t) => t.category_id === b.category_id && t.date >= b.start && t.date <= b.end);
    // Illustrative previous periods (range history is not served by the backend yet)
    const hist = [0.82, 0.95, 1.12, 0.74, 1.03, m.pct / 100].map((r, i) => ({ r, label: ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'][i] }));
    const HW = 420, HH = 120, base = 100;
    const bw = 34, gap = (HW - hist.length * bw) / (hist.length - 1);
    const hbars = hist.map((h, i) => { const hh = Math.min(1.3, h.r) / 1.3 * (base - 6); const x = i * (bw + gap); return `<path class="b" style="--j:${i}" fill="${h.r > 1 ? 'var(--neg-fill)' : s.bg}" d="M${x},${base} v${-hh + 6} q0,-6 6,-6 h${bw - 12} q6,0 6,6 v${hh - 6} z"/><text class="axis" x="${x + bw / 2}" y="${HH - 2}" text-anchor="middle">${h.label}</text>`; }).join('');
    const limY = base - (1 / 1.3) * (base - 6);
    const sh = openSheet(`
      <button class="icon-btn sheet-close" type="button" data-close-sheet aria-label="Close budget details" style="color:${s.fg}">${ic('x')}</button>
      <div class="sheet-body">
        <div class="sheet-hero" style="${s.css}"><span class="wobble"></span>
          <div style="display:flex;gap:18px;align-items:center">
            ${ring({ pct: m.pct, size: 116, stroke: 12, color: s.dark ? '#15102E' : '#fff', track: s.dark ? 'rgba(21,16,46,0.14)' : 'rgba(255,255,255,0.28)', delay: 250, label: `${Math.round(m.pct)} percent used`, center: `<b class="num" style="font-size:26px">${Math.round(m.pct)}%</b>` })}
            <div><p class="label">${esc(s.cat.name)} · ${b.period[0] + b.period.slice(1).toLowerCase()}</p><h2 id="sheet-title" style="font-size:28px;font-weight:850;letter-spacing:-0.02em;margin-top:4px">${esc(b.name)}</h2>
            <p style="font-weight:750;margin-top:6px" class="num">${fmt(b.spent)} of ${fmt(b.limit, 'EUR', { maximumFractionDigits: 0 })}</p></div>
          </div>
        </div>
        <div class="stagger">
          <div style="display:flex;gap:6px;flex-wrap:wrap">${statusChip(m.status)}<span class="chip">${ic('clock')}${m.daysLeft} days left</span><span class="chip">${shortDate(b.start)} to ${shortDate(b.end)}</span></div>
          <div class="sheet-section" style="margin-top:16px"><h3>Counting toward this budget (${tx.length})</h3>
            <ul class="tx-list">${tx.length ? tx.map((t) => `<li class="tx compact">${txIcon(t)}<span style="min-width:0"><span class="ttl" style="display:block">${esc(t.title)}</span><span class="meta">${shortDate(t.date)} · ${esc(accountName(t.account_id))}</span></span>${amountCell(t)}</li>`).join('') : '<li class="muted">Nothing yet this period.</li>'}</ul>
            <p class="hint">Sample rows. The full period has more transactions than this mock shows.</p></div>
          <div class="sheet-section bars hist"><div class="card-head" style="margin-bottom:8px"><h3 style="margin:0">Range history</h3>${nb()}</div>
            <svg viewBox="0 0 ${HW} ${HH}" role="img" aria-label="Spend versus limit for the last six periods: ${hist.map((h) => `${h.label} ${Math.round(h.r * 100)} percent`).join(', ')}"><line x1="0" x2="${HW}" y1="${limY}" y2="${limY}" stroke="var(--ink)" stroke-width="2" stroke-dasharray="4 4"/>${hbars}</svg>
            <p class="hint">Dashed line is the limit. Red bars went over.</p>
            <button class="btn sm" type="button" aria-disabled="true" style="margin-top:10px">${ic('pencil')}Edit ranges</button></div>
          <div class="sheet-section"><div class="card-head" style="margin-bottom:8px"><h3 style="margin:0">Notes</h3>${nb()}</div><label class="flabel" for="b-note" style="font-size:13px;font-weight:750;color:var(--ink-2)">Note for this budget</label><textarea class="input" id="b-note" disabled style="margin-top:6px">Birthday month, allow a little extra.</textarea></div>
        </div>
      </div>
      <div class="sheet-foot"><button class="btn primary sm" type="button" data-autofocus>${ic('pencil')}Edit budget</button><button class="btn danger sm" type="button" data-close-sheet>${ic('trash')}Delete</button></div>`, trigger);
    return sh;
  }

  /* ---------- Boot ---------- */
  ({ dashboard, transactions, accounts, budgets })[page]();
  stagger(); countUps();
  if (location.hash === '#collapsed') { $('#app').classList.add('collapsed'); }
})();
