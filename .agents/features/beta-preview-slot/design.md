# MOC Beta-Preview Slot — Design

**Requirements**: N/A (design-only proposal; decisions locked by Abhijeet)
**GitHub Issue**: N/A
**Date**: 2026-07-18
**Status**: Proposal — for review. **No implementation in this PR.**

## 1. Overview

A single, persistent **beta-preview slot** that serves a running, click-through instance of any chosen PR branch at **`moc.beta.abhijeetreddy.in`**.

Goals:

- Preview **one** PR branch live at a time (single persistent slot — the newest preview replaces the previous one).
- **Never** touch production or real financial data — separate container, separate throwaway DB, sandboxed external providers.
- Deploy on demand via a manual trigger ("preview PR #NN") — **not** per-merge, and **not** a semver release.

This follows two standard patterns:

- **Single persistent preview slot** — one long-lived environment repointed at whatever branch is being reviewed (as opposed to ephemeral per-PR environments).
- **Branch-image tagging** — a moving `:beta` tag for "what's live now" plus an immutable `:sha-<commit>` tag per build for traceability.

Production is completely unaffected: prod continues to run semver releases (`v0.x.0`) on `:latest`; the beta flow never publishes a release and never moves `:latest`.

## 2. Locked Decisions

These were decided by Abhijeet and are captured here verbatim as the design's fixed constraints:

| # | Decision | Choice |
|---|----------|--------|
| a | **Auth** | MOC's own app login only. **No** Cloudflare Access gate (it would be a redundant second login in front of MOC's existing auth). |
| b | **Beta worker** | **Omit for now.** Background jobs (bank/portfolio/split sync) will not run in beta initially. Cleanly addable later as an extra compose service on sandbox creds. |
| c | **Compose network reconcile** | **Skip.** The current prod network pattern is already correct — the server sits on the external `kings-road` net (+ its default net) so the tunnel can reach it, while `db`/`redis` stay on the internal/default net only and are never exposed on `kings-road`. Beta simply **replicates** this pattern. |
| d | **Persistence** | **Yes** — commit this as a design doc at `.agents/features/beta-preview-slot/design.md` (this file). |

## 3. Architecture

### 3.1 High-level flow

```
Abhijeet: "preview PR #NN"
   │
   ▼
deploy-branch helper (app repo)
   │  1. resolve PR #NN → branch
   │  2. trigger beta-image.yml (workflow_dispatch, branch input)
   ▼
GitHub Actions: beta-image.yml
   │  build branch → push ghcr.io/abhijeet-reddy/master-of-coin:beta
   │                      + :sha-<commit>   (leaves :latest untouched)
   ▼
deploy-branch helper (cont.)
   │  3. recreate beta stack (pull :beta + up -d) on the home server
   ▼
moc-beta-server (Portainer stack, host port 13253, :beta image)
   │  boots → runs embedded migrations against beta DB
   ▼
Cloudflare Tunnel ingress  moc.beta.abhijeetreddy.in → moc-beta-server:13153
   ▼
User clicks through the previewed branch (MOC login only)
```

### 3.2 Component / repo split

The work spans **two git repos** plus **one manual Cloudflare step**. All three are PR/approval-gated.

#### A. App repo — `abhijeet-reddy/master-of-coin`

1. **`beta-image.yml`** — a new GitHub Actions workflow, `workflow_dispatch` with a `branch` input.
   - Checks out the given branch, builds the existing multi-arch `Dockerfile` (reusing the build/push steps from `docker-publish.yml`).
   - Pushes **two** tags to GHCR:
     - `:beta` — moving tag, always points at the latest previewed build.
     - `:sha-<commit>` — immutable, one per build, for traceability.
   - **Does NOT** touch `:latest`, `:0.x.0`, or any semver tag — prod image tags are owned solely by the release flow (`docker-publish.yml`).
2. **`deploy-branch` helper** — a one-command wrapper (e.g. `scripts/deploy-beta.sh <branch-or-PR>`), that:
   - Triggers `beta-image.yml` for the branch (`gh workflow run`), waits for it to go green,
   - Then recreates the beta stack on the home server (repull `:beta` + `up -d`),
   - And reports the live commit (the `:sha-<commit>` now serving).
   - This is what makes "preview PR #NN" effectively one step.

#### B. Deploy repo — `valyria-home-server/master-of-coin` (Portainer stack 20, git-backed)

3. **`docker-compose.beta.yml`** — a **separate** beta stack (never merged into prod's compose so a beta redeploy can never recreate prod containers). Contains:
   - `moc-beta-server` — pinned to `ghcr.io/abhijeet-reddy/master-of-coin:beta`, `pull_policy: always`. Host port **13253** (prod's **13153** untouched; container still listens on 13153 internally). On the **`kings-road`** external net (web tier, so the tunnel reaches it) **plus** the beta stack's own private/default net.
   - `moc-beta-db` — its own throwaway `postgres:16-alpine`, own volume, on the beta stack's **private/default net only** (never on `kings-road`), mirroring prod's db isolation.
   - `moc-beta-redis` (only if required by the app at boot) — same private-net isolation.
   - Beta env: `DATABASE_URL` → beta DB; **distinct `ENCRYPTION_KEY`**; `TRUELAYER_ENVIRONMENT=sandbox`; empty/sandbox Splitwise/SplitPro/TrueLayer creds (see §4).
   - **No** `moc-beta-worker` (decision b) — leave a commented stub noting it's addable later on sandbox creds.

#### C. Cloudflare (manual, not config-as-code) — home-server-agent

4. **Tunnel ingress + DNS** — add a Cloudflare Tunnel ingress rule `moc.beta.abhijeetreddy.in → http://moc-beta-server:13153` (container name + internal port, reached over the shared `kings-road` net) and a DNS CNAME `moc.beta → <tunnel-id>.cfargotunnel.com`.
   - **No Cloudflare Access gate** (decision a).
   - This is done via the Cloudflare API by **home-server-agent as an explicit approval**, not committed config. **Noted here, not built.**

### 3.3 Where each piece lives

| Piece | Repo / owner | Gate |
|-------|--------------|------|
| `beta-image.yml` CI workflow | app repo `abhijeet-reddy/master-of-coin` | PR review |
| `deploy-branch` helper script | app repo | PR review |
| `docker-compose.beta.yml` beta stack | deploy repo `valyria-home-server/master-of-coin` | PR review |
| Tunnel ingress + DNS CNAME | Cloudflare (home-server-agent) | explicit approval (CF-API) |

## 4. Data & Safety

Beta must be structurally incapable of touching real finance data or real provider accounts:

- **Own throwaway demo DB** — `moc-beta-db`, completely separate from prod's finance DB, which is **never** referenced by the beta stack. Schema is created automatically at boot via the app's embedded migrations.
- **Seeded demo data** — a demo user plus sample accounts, categories, budgets, and transactions, so the preview is clickable immediately. **Reset-on-demand** (`down -v && up -d` wipes the beta volume and re-seeds → clean slate in one command).
- **Distinct `ENCRYPTION_KEY`** — different from prod. Even if beta's DB were ever seeded from a prod snapshot, prod-encrypted provider tokens could not be decrypted, so beta physically cannot act on real provider credentials.
- **`TRUELAYER_ENVIRONMENT=sandbox`** — the app already switches host by this var, so any TrueLayer connect in beta uses sandbox, never live banking.
- **Empty/sandbox Splitwise & SplitPro creds** — connect flows either no-op or hit sandbox; combined with the `skip_split_sync` flag (v0.18.0), splits can be recorded in beta with no upstream call.

Net guarantee: beta can never mutate real Splitwise/TrueLayer accounts or read/write prod's finance DB.

## 5. Trigger & Workflow

- **Manual trigger:** Abhijeet says **"preview PR #NN"** → the `deploy-branch` helper builds `:beta` from that PR's branch, recreates the beta stack, and reports the now-live commit.
- **Single slot semantics:** each new preview replaces whatever was live — only one PR is previewable at a time (by design).
- **Optional later nicety (not in scope):** a `/preview` PR-comment GitHub Action that invokes the same helper, so previewing can be driven from a PR comment.

## 6. Tagging Model

| Tag | Meaning | Moved by |
|-----|---------|----------|
| `:beta` | Whatever build is currently previewable | `beta-image.yml` (beta flow) |
| `:sha-<commit>` | Immutable record of a specific previewed build | `beta-image.yml` (beta flow) |
| `:latest`, `:0.x.0`, `:0.x`, `:0` | Production releases | `docker-publish.yml` (release flow) **only** |

The beta and release flows write **disjoint** sets of tags — the beta flow never touches prod tags, so previewing a branch can never affect what prod pulls.

## 7. Rough Effort & Open Questions

**Effort:** ~half a day of implementation once approved.

- `beta-image.yml` — ~1–2h (largely a copy of `docker-publish.yml`'s build/push with a `branch` input and beta tags).
- `docker-compose.beta.yml` + beta DB + seed — ~1–2h.
- `deploy-branch` helper — ~1h.
- Cloudflare ingress + DNS — small, home-server-agent's side.
- No application source code changes.

**Open questions for review:**

1. **Seed source** — hand-authored SQL/fixture seed committed to the deploy repo, vs a small seed script the beta container runs on first boot? (Recommend a committed seed script for repeatability.)
2. **Redis in beta** — include `moc-beta-redis` only if the app requires it at boot; confirm whether beta needs it at all (prod's redis is currently unused by the Rust code).
3. **`:sha-<commit>` retention** — do we prune old `:sha-*` tags from GHCR periodically, or keep all? (Recommend a retention policy / periodic prune to avoid registry bloat.)
4. **Reboot persistence** — assume `restart: unless-stopped` on `moc-beta-server` so the slot survives host reboots.
5. **Migration divergence** — if a previewed branch adds a migration that a later-previewed branch doesn't have, the persistent beta DB can drift. Mitigation: prefer a DB reset (`down -v`) when switching between branches with divergent migrations. Worth calling out in the deploy helper's output.

## 8. Non-Goals

- No ephemeral per-PR environments (single persistent slot only).
- No production changes; no release per PR.
- No Cloudflare Access / SSO gate.
- No beta worker initially.
- This PR is **design only** — it commits this document and builds nothing.
