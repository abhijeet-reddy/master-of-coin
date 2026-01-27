# Git Commit Rules

## Commit Message Guidelines

### 1. Keep Messages Simple and Single Line

- **One line only**: Commit messages should be concise and fit on a single line.
- **No multi-line descriptions**: Keep it brief and to the point.
- **Maximum 72 characters**: Aim for 50, but don't exceed 72 characters.
- **Use imperative mood**: Write as if giving a command (e.g., "Add feature" not "Added feature").

**Example:**

```bash
# ❌ Bad: Multi-line, too verbose
git commit -m "Added new feature for user authentication
This commit includes the login page, registration form,
and password reset functionality. Also updated the database
schema to support the new user table."

# ✅ Good: Single line, concise
git commit -m "Add user authentication with login and registration"

# ✅ Good: Simple and clear
git commit -m "Fix transaction calculation bug"

# ✅ Good: Direct and imperative
git commit -m "Update account balance display format"
```

### 2. Associate and Close GitHub Issues

- **Always reference issues**: Link commits to GitHub issues when working on tracked work.
- **Use closing keywords**: Automatically close issues when merging to main branch.
- **Format**: `<message> (closes #<issue-number>)` or `<message> (fixes #<issue-number>)`

**Closing Keywords:**

- `closes #123`
- `fixes #123`
- `resolves #123`
- `fix #123`
- `close #123`
- `resolve #123`

**Example:**

```bash
# ✅ Good: References and closes issue
git commit -m "Add budget tracking feature (closes #45)"

# ✅ Good: Fixes bug and closes issue
git commit -m "Fix date picker timezone issue (fixes #78)"

# ✅ Good: Multiple issues
git commit -m "Refactor transaction service (closes #12, closes #15)"

# ✅ Good: Just referencing without closing
git commit -m "Update API documentation for #23"
```

## Commit Best Practices

### 3. Commit Frequency and Scope

- **Commit often**: Small, focused commits are better than large ones.
- **One logical change per commit**: Each commit should represent a single logical change.
- **Complete changes**: Don't commit half-finished work (use branches instead).

**Example:**

```bash
# ❌ Bad: Too many unrelated changes
git commit -m "Add login, fix bugs, update styles, refactor utils"

# ✅ Good: Separate commits for each change
git commit -m "Add login form component (closes #34)"
git commit -m "Fix transaction date formatting bug (fixes #35)"
git commit -m "Update button styles for consistency"
git commit -m "Refactor currency formatting utils"
```

### 4. Commit Message Prefixes (Optional but Recommended)

Use conventional commit prefixes for clarity:

- `feat:` - New feature
- `fix:` - Bug fix
- `refactor:` - Code refactoring
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

**Example:**

```bash
git commit -m "feat: add budget progress visualization (closes #56)"
git commit -m "fix: resolve account balance calculation error (fixes #67)"
git commit -m "refactor: simplify transaction filtering logic"
git commit -m "docs: update API endpoint documentation"
git commit -m "test: add unit tests for budget service"
git commit -m "chore: update dependencies to latest versions"
```

## Branch and Workflow Guidelines

### 5. Branch Naming

- **Use descriptive names**: Branch names should indicate what you're working on.
- **Include issue number**: Reference the GitHub issue in the branch name.
- **Use hyphens**: Separate words with hyphens, not underscores or spaces.

**Format:** `<type>/<issue-number>-<brief-description>`

**Example:**

```bash
# ✅ Good branch names
feature/45-budget-tracking
fix/78-date-picker-timezone
refactor/12-transaction-service
docs/23-api-documentation

# ❌ Bad branch names
new-feature
fix_bug
my_branch
test
```

### 6. Pull Request Guidelines

- **Link to issues**: Always reference related issues in PR description.
- **Keep PRs focused**: One feature or fix per PR.
- **Update PR description**: Keep it current with any changes during review.
- **Use closing keywords in PR**: Can also close issues from PR description.

**Example PR Description:**

```markdown
## Description

Adds budget tracking feature with progress visualization

## Related Issues

Closes #45
Relates to #46

## Changes

- Add budget progress component
- Implement budget calculation logic
- Add budget API endpoints

## Testing

- Tested with various budget scenarios
- Added unit tests for calculations
```

### 7. Before Committing Checklist

- [ ] Code compiles without errors
- [ ] Tests pass locally
- [ ] Code follows project style guidelines
- [ ] No debug code or console.logs left in
- [ ] Commit message is clear and single-line
- [ ] Issue number is referenced (if applicable)
- [ ] Only related changes are included

## Common Patterns

### Working on a Feature

```bash
# Create branch from issue
git checkout -b feature/45-budget-tracking

# Make changes and commit frequently
git commit -m "Add budget model and database schema (ref #45)"
git commit -m "Add budget API endpoints (ref #45)"
git commit -m "Add budget UI components (closes #45)"

# Push and create PR
git push origin feature/45-budget-tracking
```

### Fixing a Bug

```bash
# Create fix branch
git checkout -b fix/78-date-picker-timezone

# Fix and commit
git commit -m "Fix date picker timezone handling (fixes #78)"

# Push and create PR
git push origin fix/78-date-picker-timezone
```

### Quick Fixes (Hotfix)

```bash
# For urgent production fixes
git checkout -b hotfix/critical-security-issue

# Fix and commit
git commit -m "Fix authentication bypass vulnerability (fixes #99)"

# Push and merge quickly
git push origin hotfix/critical-security-issue
```

## Git Commands Reference

### Essential Commands

```bash
# Check status
git status

# Stage changes
git add <file>
git add .  # Stage all changes

# Commit
git commit -m "Your message here (closes #123)"

# Push
git push origin <branch-name>

# Pull latest changes
git pull origin main

# Create new branch
git checkout -b <branch-name>

# Switch branches
git checkout <branch-name>

# View commit history
git log --oneline

# Amend last commit (before pushing)
git commit --amend -m "New message"
```

### Undoing Changes

```bash
# Unstage file
git reset HEAD <file>

# Discard local changes
git checkout -- <file>

# Undo last commit (keep changes)
git reset --soft HEAD~1

# Undo last commit (discard changes)
git reset --hard HEAD~1
```

## Summary

**Golden Rules:**

1. ✅ One line commit messages
2. ✅ Always reference/close issues
3. ✅ Commit often, commit focused changes
4. ✅ Use descriptive branch names with issue numbers
5. ✅ Test before committing

**Common Format:**

```bash
git commit -m "<type>: <description> (closes #<issue>)"
```

---

_Following these Git rules ensures clean commit history, better traceability, and easier collaboration._
