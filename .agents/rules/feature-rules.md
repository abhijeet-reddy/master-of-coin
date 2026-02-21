# Feature Development Rules

## Table of Contents

- [Overview](#overview)
- [Folder Structure](#folder-structure)
- [Feature Workflow](#feature-workflow)
  - [Phase 1: Requirements](#phase-1-requirements)
  - [Phase 2: Design](#phase-2-design)
  - [Phase 3: Implementation](#phase-3-implementation)
- [File Templates](#file-templates)
  - [requirements.md Template](#requirementsmd-template)
  - [design.md Template](#designmd-template)
  - [implementation.md Template](#implementationmd-template)
- [Naming Conventions](#naming-conventions)
- [Progress Tracking Rules](#progress-tracking-rules)
- [Checklist](#checklist)

---

## Overview

Every task in Master of Coin — whether a new feature, bug fix, enhancement, or refactor — follows a structured 3-phase workflow: **Requirements → Design → Implementation**. Each task gets its own folder under `.agents/features/` with three standardized files. This ensures consistent documentation, clear scope, and trackable progress across all work.

> **Note:** Despite the folder being called `features/`, it is used for all tracked work items, not just new features.

---

## Folder Structure

```
.agents/features/
├── <feature-name>/
│   ├── requirements.md      # What to build and why
│   ├── design.md            # How to build it technically
│   └── implementation.md    # Detailed task list for execution
├── <another-feature>/
│   ├── requirements.md
│   ├── design.md
│   └── implementation.md
└── ...
```

---

## Feature Workflow

### Phase 1: Requirements

**Mode**: Architect  
**Output**: `requirements.md`  
**Gate**: User approval required before proceeding to Phase 2

1. Create the feature folder: `.agents/features/<feature-name>/`
2. Write `requirements.md` using the [template](#requirementsmd-template)
3. Source requirements from GitHub issues, user requests, or design discussions
4. Define clear acceptance criteria with checkboxes
5. Identify what's in scope and what's explicitly out of scope
6. **Present to user for approval** before moving to Design

### Phase 2: Design

**Mode**: Architect  
**Output**: `design.md`  
**Gate**: User approval required before proceeding to Phase 3

1. Write `design.md` using the [template](#designmd-template)
2. Define the technical architecture, database changes, API contracts, and frontend components
3. Include diagrams (Mermaid or ASCII) where they add clarity
4. Reference existing project patterns from `.agents/rules/rust-rules.md` and `.agents/rules/react-rules.md`
5. **Present to user for approval** before moving to Implementation

### Phase 3: Implementation

**Mode**: Architect (to create the plan) → Code (to execute)  
**Output**: `implementation.md`

1. Write `implementation.md` using the [template](#implementationmd-template)
2. Break work into **phases** (e.g., Phase 1: Database, Phase 2: Backend, Phase 3: Frontend)
3. Each phase contains granular, checkboxed tasks
4. Each task should be specific enough for an agent to execute independently
5. Switch to **Code mode** to begin executing the checklist
6. **Mark each task `[x]` immediately after completing it** (see [Progress Tracking Rules](#progress-tracking-rules))

---

## File Templates

### requirements.md Template

```markdown
# <Feature Name> — Requirements

**GitHub Issue**: [#<number> - <title>](url)
**Date**: <YYYY-MM-DD>
**Status**: Draft | Approved | In Progress | Complete

## Summary

<1-2 paragraph description of what this feature does and why it's needed>

## User Stories

1. As a user, I can ...
2. As a user, I can ...
3. As a user, when I ..., then ...

## Acceptance Criteria

- [ ] <Criterion 1>
- [ ] <Criterion 2>
- [ ] <Criterion 3>

## Scope

| Feature              | In Scope | Future |
| -------------------- | -------- | ------ |
| <Feature aspect 1>   | ✅       |        |
| <Feature aspect 2>   | ✅       |        |
| <Future enhancement> |          | ✅     |

## Out of Scope

- <Explicitly excluded item 1>
- <Explicitly excluded item 2>

## Dependencies

- <Other features, issues, or external services this depends on>

## Open Questions

- <Any unresolved questions that need answers before design>
```

### design.md Template

```markdown
# <Feature Name> — Design

**Requirements**: [requirements.md](./requirements.md)
**GitHub Issue**: [#<number>](url)
**Date**: <YYYY-MM-DD>

## 1. Overview

<Brief summary of the technical approach>

## 2. Architecture

<High-level architecture description with diagram if helpful>

### 2.1 <Component/Pattern Name>

<Description of the key architectural pattern or component>

## 3. Database Changes

### 3.1 New Tables

<Table definitions with columns, types, constraints>

### 3.2 Migrations

<Migration descriptions>

### 3.3 Models

<Rust model structs needed>

## 4. API Changes

### 4.1 New Endpoints

| Method | Path        | Description   | Request Body | Response |
| ------ | ----------- | ------------- | ------------ | -------- |
| POST   | /api/v1/... | <description> | `{...}`      | `{...}`  |

### 4.2 Modified Endpoints

<Any changes to existing endpoints>

## 5. Frontend Changes

### 5.1 New Components

- `<ComponentName>` — <description>

### 5.2 New Hooks

- `use<HookName>` — <description>

### 5.3 New Services

- `<serviceName>` — <description>

### 5.4 Modified Components

<Any changes to existing components>

## 6. Error Handling

<How errors are handled for this feature>

## 7. Testing Strategy

<What tests are needed — integration tests, unit tests, manual testing>
```

### implementation.md Template

```markdown
# <Feature Name> — Implementation

**Design**: [design.md](./design.md)
**GitHub Issue**: [#<number>](url)

---

## Backend Implementation

### Phase 1: <Phase Name> (e.g., Database & Models)

#### 1.1 <Sub-section>

- [ ] Task description
  - [ ] Sub-task if needed
  - [ ] Sub-task if needed
- [ ] Task description
- [ ] Run migrations and verify: `diesel migration run`

#### 1.2 <Sub-section>

- [ ] Task description
- [ ] Task description

### Phase 2: <Phase Name> (e.g., Services & Handlers)

#### 2.1 <Sub-section>

- [ ] Task description
- [ ] Task description

### Phase 3: <Phase Name> (e.g., Testing)

- [ ] Write integration tests for <area>
- [ ] All tests passing

---

## Frontend Implementation

### Phase 4: <Phase Name> (e.g., Types & Services)

- [ ] Task description
- [ ] Task description

### Phase 5: <Phase Name> (e.g., Hooks & Components)

- [ ] Task description
- [ ] Task description

### Phase 6: <Phase Name> (e.g., UI Polish & Testing)

- [ ] Task description
- [ ] TypeScript compiles cleanly
- [ ] Frontend testing checklist completed (see .agents/testing/testing-front-end.md)
```

---

## Naming Conventions

### Feature Folder Names

- Use **kebab-case**: `split-provider-integration`, `budget-multi-filter`, `paid-by-others`
- Keep names concise but descriptive
- Match the GitHub issue topic when possible

### Phase Naming

- Number phases sequentially: Phase 1, Phase 2, etc.
- Give each phase a descriptive name: "Database & Models", "Services & Handlers", "Frontend Components"
- Backend phases come before frontend phases

---

## Progress Tracking Rules

### ⚠️ Mark Tasks Done Immediately

**Every checklist item in `implementation.md` MUST be marked as `[x]` as soon as it is completed.** Do not batch-update checkboxes later — mark each one done right after finishing the task. This ensures:

- Other agents (or the same agent in a new session) can see exactly where work left off
- No work is accidentally repeated
- Progress is always accurate

### Status Updates

- Update the `Status` field in `requirements.md` as the feature progresses:
  - `Draft` → Requirements being written
  - `Approved` → User approved, ready for design/implementation
  - `In Progress` → Implementation underway
  - `Complete` → All tasks done, feature shipped

### Resuming Work

When resuming work on an existing feature:

1. Read `implementation.md` to find the first unchecked `[ ]` task
2. Read `design.md` for technical context on that task
3. Continue from where the checklist left off
4. Read the appropriate coding rules (`.agents/rules/react-rules.md` or `.agents/rules/rust-rules.md`) for the type of code you're writing

---

## Checklist

Use this checklist before starting a new feature:

- [ ] Feature folder created at `.agents/features/<feature-name>/`
- [ ] `requirements.md` written and approved by user
- [ ] `design.md` written and approved by user
- [ ] `implementation.md` written with phased task list
- [ ] All implementation tasks marked `[x]` as they are completed
- [ ] Testing completed (backend tests passing, frontend tested in browser)
- [ ] Feature status updated to `Complete`
