# Master of Coin v2: mock brief

Goal: five genuinely different visual directions, each rendered as 4 pages
(Dashboard, Transactions, Accounts, Budgets), so the owner can pick one.
The mocks are a design exploration, NOT the implementation. The backend is
read-only; do not touch anything outside `.agents/features/ui-v2/mocks/`.

## Deliverable layout

```
mocks/
  index.html              gallery: 3 directions x 4 pages, links + one-line pitch each
  shared/data.js          sample data (window.MOC). EVERY page uses it, nothing hardcoded
  a-precision/ {dashboard,transactions,accounts,budgets}.html + style.css + app.js
  b-editorial/ ...
  c-telemetry/ ...
  d-glass/ ...
  e-bold/ ...
```

- Plain static HTML + CSS + vanilla JS (ES modules ok). No build step, no
  network: no CDNs, no web fonts from the internet (use system stacks, or a
  locally-described fallback). Must open via file:// or `npx serve`.
- Charts: hand-built inline SVG (area/line, bars, donut or ring, sparklines).
- Shared app shell per direction: sidebar with all 11 nav items in this order:
  Dashboard, Transactions, Accounts, Budgets, Categories, People, Reports,
  Jobs, Schedules, Trash, Settings. Brand "Master of Coin", user block
  (initials, name, email), version line `v0.24.0`, collapsible. The 4 mocked
  pages link to each other; the other 7 can be inert.
- Include a light AND dark theme toggle in each direction (direction C may be
  dark-first but still needs to be legible).
- Responsive: must hold at 1440px and at 390px (sidebar becomes a bottom bar
  or drawer).

## Hard rules

- Copy: NO arrow glyphs (the right-arrow character or "->") and NO en or em
  dashes anywhere in visible text. Use words, commas, or icons.
- Money: `Intl.NumberFormat('en-US')` via `MOC.fmt`. Tabular numerals
  (`font-variant-numeric: tabular-nums`) on every figure. Negative = money out.
  Never encode in/out by colour alone: pair colour with sign, icon or label.
  Brand accent must be distinct from the negative/error colour.
- Multi-currency: non-EUR accounts show native amount plus EUR equivalent.
- Motion: rich but disciplined.
  - Go big on: page entrance (staggered, once per mount), net worth
    count-up, chart draw-in, budget rings filling, account card hover/tilt
    or reveal, theme switch, drawer/sheet open, row expand.
  - Stay quiet on: filters, form fields, high-frequency row hover.
  - Animations fire once per page load, never re-trigger on scroll.
  - Everything honours `prefers-reduced-motion: reduce` (disable transforms,
    keep instant state changes).
  - Only animate transform/opacity/filter/clip-path/stroke-dashoffset.
  - Use deliberate curves, e.g. flow `cubic-bezier(0.22,0,0.12,1)`,
    durations 100/200/300/400/600ms. Springs (CSS `linear()`) only for layout.
- Accessibility: visible focus rings, keyboard reachable controls, labels
  above inputs (never placeholder-as-label), contrast AA, charts get an
  accessible text summary.
- Panels that need data the backend does NOT provide yet must carry a small
  "Needs backend" chip: net-worth history chart, spending trend over months,
  budget range history/editing, account archive, budget notes.

## Capability checklist (what each page must be able to do)

Do not copy the current layout. Design the right layout for the job. But
every capability below must be present or reachable.

**Dashboard**: net worth (hero figure) with trend; account summary grouped by
type (assets vs liabilities); budget progress (top budgets with status OK /
WARNING / EXCEEDED); spending by category (breakdown for the month);
top spending categories; recent transactions (5 to 8); debt overview (owed
to me / I owe, per person from `MOC.people`); income vs spend by month.
Quick actions: add transaction, transfer, import.

**Transactions**: month navigation (prev/next, current month label) with a
month summary (income, spend, net); search box (backend supports title +
notes search already); filters: account, category, person, date range,
min/max amount, sign (in/out), has splits, in transfer; date-grouped list
with day subtotals; each row shows title, category (icon+colour), account,
amount, and badges for split (with person), transfer (linked account),
"paid by someone else" debt, recurring, notes indicator, foreign currency;
row actions: edit, duplicate, delete (soft delete, goes to Trash, undo
toast), convert to transfer; bulk select; add transaction, transfer,
import CSV entry points; infinite scroll with a real total count
("Showing 15 of 214"); empty, loading (skeleton) and error states.
Also mock the transaction detail as a side drawer or sheet (open one row).

**Accounts**: total balance in EUR; accounts grouped by type; each account:
name, type, currency, balance (native + EUR), provider sync status for
TrueLayer / Trading 212 accounts (last synced, sync now), investment day
change; add / edit / delete account; connect provider entry point. Negative
balances (credit card, debt) clearly read as liabilities.

**Budgets**: overall progress for the period; each budget: name, category,
period (DAILY/WEEKLY/MONTHLY/QUARTERLY/YEARLY), limit, spent, remaining,
percentage, status, days left in period, pace (on track / ahead of pace);
create / edit / delete budget; budget detail preview (open one) with the
transactions counting toward it and the range history ("Needs backend" for
editing ranges).

## The five directions

**A. Precision** (`a-precision/`): modern fintech product UI in the vein of
Mercury, Linear and Monzo's web tokens. Crisp neutral surfaces, one confident
accent, layered soft shadows for elevation, concentric radii, springy but
restrained motion, the richest charts. Light-first, polished dark.

**B. Editorial** (`b-editorial/`): the installed `minimalist-ui` skill. Warm
monochrome canvas (#F7F6F3 / #FBFBFA / white), off-black text, hairline
borders, typographic hierarchy doing the work (a serif display face for
headline figures via system serif stack), muted pastel status chips, flat
bento grid, no gradients, almost no shadows. Motion is soft fades and
reveals, very calm.

**C. Telemetry** (`c-telemetry/`): the installed `industrial-brutalist-ui`
skill, Tactical Telemetry mode. Dark-first (#0A0A0A / #121212), monospace
figures, zero radius, 1px grid hairlines (`display:grid; gap:1px`), a single
hazard accent, dense data, ticker and scan-line style motion (count-ups,
bars that fill like meters, blinking cursor on sync). Feels like a trading
terminal, still readable and accessible.

**D. Glass** (`d-glass/`): premium dark glass. Deep layered background with
slow ambient colour fields, translucent panels (`backdrop-filter: blur`),
luminous edges (1px inner highlight), soft glow on the accent, real depth
and parallax on hover, Apple visionOS / Arc browser feel. Dark-first with a
frosted light mode. Glass must never cost legibility: text sits on panels
with enough opacity for AA, and there is a solid fallback when
`backdrop-filter` is unsupported or reduced transparency is preferred.

**E. Bold** (`e-bold/`): bold expressive colour, Revolut / Cash App / Monzo
Hot Coral energy. Big saturated colour blocks, each category owns its colour,
oversized display numerals, chunky rounded shapes, playful springy motion
(pop-ins, bouncy rings, confetti-free delight). Confident, fun, still a
serious finance tool: colour never replaces labels, contrast AA.

## Before you start

Read the relevant skills in `.claude/skills/` for your direction and for
motion/polish: `emil-design-eng`, `animate`, `better-ui`, `better-colors`,
`better-typography`, `better-layout`, `better-accessibility`, plus
`dataviz` for charts. For capability detail, skim
`frontend/src/pages/{Dashboard,Transactions,Accounts,Budgets}.tsx` and
`frontend/src/components/{dashboard,transactions,accounts,budgets}/`.
Do not modify anything under `frontend/` or `backend/`.

## Verify

Screenshot every page at 1440x900 (light and dark) and 390x844 with
Playwright (`e2e/` has it installed: `cd e2e && npx playwright ...` or a
small node script using `playwright` from `e2e/node_modules`). Save to
`mocks/<direction>/screenshots/`. Look at the screenshots and fix what looks
wrong before reporting. Also grep your HTML for the banned glyphs.
