# Playwright E2E Testing for Agent-Autonomous UI Verification

## Problem Statement

The current frontend testing workflow (`.agents/testing/testing-front-end.md`) requires manual browser interaction — rebuilding Docker, opening a browser, visually inspecting pages. An AI agent cannot do this. We need a way for the agent to **programmatically verify** that UI changes are correct without human intervention.

## Requirements

### Functional Requirements

1. **Agent can run E2E tests autonomously** — via CLI commands (`npx playwright test`), reading pass/fail from terminal output
2. **Tests run against the full Docker stack** — real backend, real database, real API calls
3. **Authentication is handled automatically** — tests log in with test credentials before running
4. **Screenshot capture** — agent can take screenshots of pages/components and view them using its vision capabilities
5. **Visual regression detection** — baseline screenshots stored in repo; agent can compare against them
6. **Tests cover critical user flows** — login, dashboard, accounts, transactions, budgets, categories, people
7. **Agent can write new tests** — clear patterns and helpers so the agent can create tests for new features
8. **Fast feedback loop** — tests should run quickly (parallel execution, shared auth state)

### Non-Functional Requirements

1. **Headless execution** — no GUI required
2. **Deterministic** — tests produce consistent results
3. **Self-contained** — no external services beyond the Docker stack
4. **Clear error reporting** — when tests fail, the agent gets actionable error messages
5. **Screenshot storage** — organized directory structure for screenshots

## Success Criteria

- Agent can execute `npx playwright test` and get pass/fail results
- Agent can take a screenshot of any page and view it
- Agent can detect visual regressions by comparing screenshots
- Tests cover login flow, dashboard rendering, and at least 3 CRUD flows
- New test creation follows a clear, documented pattern
