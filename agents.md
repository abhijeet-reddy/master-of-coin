# Agent Guidelines

## 🎯 Purpose

This file serves as an index and navigation guide for AI agents working on the Master of Coin project. It helps AI agents efficiently locate and apply project-specific rules, patterns, and best practices by directing them to the appropriate rule files based on their current task.

## ⚠️ Important: Read Only What You Need

**DO NOT read all rule files just because they exist.** Each file is comprehensive and reading unnecessary files wastes time and context. Only read the specific rule file that's relevant to your current task.

## 📚 Available Rule Files

### [`.agents/rules/react-rules.md`](.agents/rules/react-rules.md)

**When to read:** Working on React/TypeScript frontend code

**Read this when you're:**

- Creating or modifying React components
- Working with hooks (useState, useEffect, custom hooks)
- Implementing React Query for data fetching
- Managing component state or props
- Refactoring frontend code
- Reviewing frontend code quality

**Don't read if:** You're working on backend Rust code, database queries, or Git operations only.

---

### [`.agents/rules/rust-rules.md`](.agents/rules/rust-rules.md)

**When to read:** Working on Rust backend code

**Read this when you're:**

- Creating or modifying Rust services, handlers, or models
- Working with Diesel ORM and database queries
- Implementing error handling in Rust
- Writing async/await code
- Setting up API endpoints
- Working with authentication/authorization
- Writing tests for backend code

**Don't read if:** You're working on frontend React code or just making Git commits.

---

### [`.agents/rules/git-rules.md`](.agents/rules/git-rules.md)

**When to read:** Making commits or managing Git workflow

**Read this when you're:**

- Writing commit messages
- Creating branches
- Preparing to commit code
- Creating pull requests
- Closing GitHub issues via commits
- Setting up Git workflow

**Don't read if:** You're actively coding and not ready to commit yet.

---

### [`.agents/rules/release-rules.md`](.agents/rules/release-rules.md)

**When to read:** Creating version releases or managing releases

**Read this when you're:**

- Creating a new release version
- Tagging a release in Git
- Writing release notes
- Determining version numbers (MAJOR.MINOR.PATCH)
- Publishing releases to GitHub
- Managing pre-release versions (alpha, beta, RC)

**Don't read if:** You're just making regular commits or working on features without releasing.

---

### [`.agents/rules/feature-rules.md`](.agents/rules/feature-rules.md)

**When to read:** Starting a new feature, resuming work on an existing feature, or checking feature status

**Read this when you're:**

- Starting work on a new feature (from a GitHub issue or user request)
- Creating requirements, design, or implementation docs for a feature
- Resuming work on a partially-implemented feature
- Checking what phase a feature is in or what tasks remain
- Setting up the `.agents/features/<feature-name>/` folder structure

**Don't read if:** You're only making a quick one-line fix or documentation-only change that doesn't need tracked requirements/design/implementation.

---

### [`.agents/rules/e2e-testing-rules.md`](.agents/rules/e2e-testing-rules.md)

**When to read:** Writing or running Playwright E2E tests for frontend verification

**Read this when you're:**

- Writing new E2E tests for UI features
- Running Playwright tests to verify UI changes
- Taking screenshots for visual verification
- Adding a new page to the smoke test suite
- Debugging failing E2E tests
- Need to understand available test helpers and fixtures

**Don't read if:** You're only working on backend code, documentation, or Git operations without UI impact.

---

## 📁 Feature Documentation

All feature documentation lives in `.agents/features/`. Each feature gets its own folder with three standardized files:

```
.agents/features/<feature-name>/
├── requirements.md      # What to build and why
├── design.md            # How to build it technically
└── implementation.md    # Detailed task list for execution
```

See [`.agents/rules/feature-rules.md`](.agents/rules/feature-rules.md) for the full workflow, templates, and conventions.

---

## 📋 Testing Guidelines

### [`.agents/testing/testing-front-end.md`](.agents/testing/testing-front-end.md)

**When to read:** Before committing any frontend/UI changes

**Read this when you're:**

- Making changes to React components that affect the UI
- Modifying styles, layouts, or visual elements
- Adding new frontend features or pages
- Fixing UI bugs or visual issues
- Making any changes that users will see or interact with
- About to commit frontend code

**Critical requirement:** ALL UI changes MUST be tested in a browser using Docker before committing.

**Don't read if:** You're only working on backend Rust code, database queries, or documentation without UI impact.

---

### [`.agents/testing/testing-backend.md`](.agents/testing/testing-backend.md)

**When to read:** Before committing any backend code changes

**Read this when you're:**

- Making changes to Rust backend code (services, handlers, models)
- Modifying API endpoints or business logic
- Changing database models or queries
- Adding new backend features
- Fixing backend bugs
- About to commit backend code

**Critical requirement:** ALL backend changes MUST have tests written and passing before committing.

**Don't read if:** You're only working on frontend React code or documentation without backend impact.

---

## 🔄 Workflow Decision Tree

```
Are you starting or working on a feature/task?
├─ Yes → Read .agents/rules/feature-rules.md
│        └─ Feature folder exists in .agents/features/?
│           ├─ No → Create .agents/features/<name>/ with 3 files (requirements, design, implementation)
│           └─ Yes → Resume from where implementation.md left off
│
Are you writing code?
├─ Yes → What language?
│  ├─ React/TypeScript → Read .agents/rules/react-rules.md
│  │                     └─ Making UI changes? → MUST read .agents/testing/testing-front-end.md
│  └─ Rust → Read .agents/rules/rust-rules.md
│           └─ Making backend changes? → MUST read .agents/testing/testing-backend.md
│
└─ No → Are you committing/managing Git?
   ├─ Yes → Read .agents/rules/git-rules.md
   │        ├─ Committing UI changes? → MUST read .agents/testing/testing-front-end.md
   │        ├─ Committing backend changes? → MUST read .agents/testing/testing-backend.md
   │        └─ Creating a release? → Read .agents/rules/release-rules.md
   └─ No → Don't read any rules yet
```

## 💡 Best Practices for Using These Rules

### 1. **Just-In-Time Reading**

Only read a rule file when you're about to work on that specific technology. Don't pre-read all files.

### 2. **Reference, Don't Memorize**

These files are references. Consult them when needed, but don't try to memorize everything.

### 3. **Context-Specific**

If you're working on multiple technologies in one session:

- Read React rules when working on components
- Switch to Rust rules when working on backend
- Check frontend testing guidelines before committing UI changes
- Check backend testing guidelines before committing backend changes
- Check Git rules before committing
- Check release rules before creating version releases

### 4. **Quick Lookups**

Each rule file has a table of contents and is organized by topic. Use it to quickly find what you need.

### 5. **Checklist Usage**

Each rule file ends with a checklist. Use these before:

- Committing React code → React checklist
- Committing UI changes → Frontend testing checklist (MANDATORY)
- Committing Rust code → Rust checklist
- Committing backend changes → Backend testing checklist (MANDATORY)
- Making Git commits → Git checklist
- Creating releases → Release checklist

## 📝 Updating These Rules

These rules should evolve with the project. If you discover a pattern or practice that should be documented:

1. Discuss with the team
2. Update the relevant rule file
3. Keep examples practical and project-specific
4. Maintain the "when to read" guidance in this index

---

**Remember: Quality over quantity. Read what you need, when you need it.**
