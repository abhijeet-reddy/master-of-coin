# Release Management Rules

## Semantic Versioning (SemVer)

This project follows **Semantic Versioning** with the format: `MAJOR.MINOR.PATCH`

### Version Number Guidelines

```
v1.2.3
│ │ │
│ │ └─── PATCH: Bug fixes, minor changes (increment last number)
│ └───── MINOR: New features, backward compatible (increment middle number)
└─────── MAJOR: Breaking changes (increment first number)
```

### When to Increment Each Number

#### PATCH Version (v1.0.X) - Last Number

**Increment when:**

- Bug fixes
- Performance improvements
- Documentation updates
- Code refactoring (no behavior change)
- Dependency updates (patch versions)
- Minor UI tweaks
- Any changes that don't add features or break compatibility

**Examples:**

- `v1.0.0` → `v1.0.1`: Fix transaction calculation bug
- `v1.0.1` → `v1.0.2`: Update documentation and fix typos
- `v1.0.2` → `v1.0.3`: Improve query performance

#### MINOR Version (v1.X.0) - Middle Number

**Increment when:**

- New features added
- New API endpoints
- New UI components or pages
- Enhanced functionality (backward compatible)
- Deprecating features (but not removing them)

**Examples:**

- `v1.0.3` → `v1.1.0`: Add budget tracking feature
- `v1.1.0` → `v1.2.0`: Add expense categories and filtering
- `v1.2.0` → `v1.3.0`: Add multi-currency support

**Note:** Reset PATCH to 0 when incrementing MINOR

#### MAJOR Version (vX.0.0) - First Number

**Increment when:**

- Breaking API changes
- Removing deprecated features
- Major architecture changes
- Database schema changes requiring migration
- Incompatible with previous versions
- Complete redesign or rewrite

**Examples:**

- `v1.3.5` → `v2.0.0`: Complete API redesign with breaking changes
- `v2.0.0` → `v3.0.0`: Migrate from REST to GraphQL
- `v3.0.0` → `v4.0.0`: Major database schema overhaul

**Note:** Reset MINOR and PATCH to 0 when incrementing MAJOR

## Release Workflow

### 1. Prepare for Release

```bash
# Ensure you're on main branch with latest changes
git checkout main
git pull origin main

# Verify all tests pass
npm test  # or cargo test for backend

# Verify the build works
npm run build  # or cargo build --release for backend
```

### 2. Determine Version Number

Review changes since last release:

```bash
# View commits since last tag
git log $(git describe --tags --abbrev=0)..HEAD --oneline

# Or view all tags
git tag -l
```

**Decision Matrix:**

- Only bug fixes and minor changes? → Increment PATCH
- New features added? → Increment MINOR
- Breaking changes? → Increment MAJOR

### 3. Create Release Notes

**Write release notes to a temporary file** (`tmp/release-note.md`) so they can be passed to `gh release create` via the `-F` / `--notes-file` flag. This avoids shell escaping issues with inline notes.

```bash
# Create the tmp directory if it doesn't exist
mkdir -p tmp
```

**Write the release notes to `tmp/release-note.md` using this format:**

```markdown
# Version X.Y.Z - Release Title

## 🎉 New Features (for MINOR/MAJOR releases)

- Feature 1 description (closes #123)
- Feature 2 description (closes #145)

## 🐛 Bug Fixes

- Fix description 1 (fixes #156)
- Fix description 2 (fixes #167)

## 🔧 Improvements

- Performance improvement 1
- Code refactoring 2

## 💥 Breaking Changes (for MAJOR releases only)

- Breaking change 1 description
- Migration guide or instructions

## 📝 Documentation

- Documentation updates

## 🔗 Dependencies

- Updated dependency X to version Y
```

**Gather changes from commits:**

```bash
# List commits with issue references since last tag
git log $(git describe --tags --abbrev=0)..HEAD --pretty=format:"- %s" --reverse
```

> **Note:** `tmp/` is gitignored. The file is temporary and will be cleaned up after the release is created.

### 4. Create Git Tag

```bash
# Create annotated tag with version
git tag -a v1.2.3 -m "Release version 1.2.3"

# Push tag to remote
git push origin v1.2.3
```

### 5. Create GitHub Release

**Always use `-F tmp/release-note.md`** (or `--notes-file tmp/release-note.md`) to pass release notes from the file created in step 3:

```bash
# Create release with notes from tmp/release-note.md
gh release create v1.2.3 \
  --title "Version 1.2.3 - Release Title" \
  -F tmp/release-note.md

# Clean up the temporary file after release is created
rm tmp/release-note.md
```

> **Why `-F` / `--notes-file`?** Using a file avoids shell escaping issues with special characters, markdown formatting, and multi-line content. Never use inline `-n` / `--notes` for release notes — always write to `tmp/release-note.md` first.

## Release Notes Best Practices

### 1. Comprehensive Change Documentation

**Include ALL changes between releases:**

- Every feature added
- Every bug fixed
- Every improvement made
- Every breaking change
- Dependencies updated

**Example:**

```markdown
# Version 1.2.0 - Budget Tracking & Performance

## 🎉 New Features

- Add budget tracking with monthly limits (closes #45)
- Add budget progress visualization (closes #46)
- Add budget alerts when approaching limit (closes #47)

## 🐛 Bug Fixes

- Fix transaction date timezone handling (fixes #78)
- Fix account balance calculation rounding error (fixes #82)
- Fix category dropdown not showing all categories (fixes #85)

## 🔧 Improvements

- Improve dashboard loading performance by 40%
- Optimize database queries for transaction list
- Add loading states to all async operations

## 📝 Documentation

- Update API documentation for budget endpoints
- Add budget feature guide to README

## 🔗 Dependencies

- Update React to 18.3.1
- Update Actix-web to 4.5.0
```

### 2. User-Friendly Language

- Write for users, not just developers
- Explain what changed and why it matters
- Include screenshots for UI changes (optional)
- Link to related issues for more context

### 3. Migration Guides (for MAJOR releases)

For breaking changes, include:

- What changed
- Why it changed
- How to migrate from previous version
- Code examples if applicable

**Example:**

````markdown
## 💥 Breaking Changes

### API Endpoint Changes

The `/api/transactions` endpoint now requires authentication.

**Before (v1.x):**

```javascript
fetch("/api/transactions");
```
````

**After (v2.0):**

```javascript
fetch("/api/transactions", {
  headers: { Authorization: `Bearer ${token}` },
});
```

**Migration:** Update all API calls to include authentication token.

````

## Pre-release Versions

For beta, alpha, or release candidate versions:

```bash
# Create pre-release tag
git tag -a v1.2.0-beta.1 -m "Beta release for version 1.2.0"
git push origin v1.2.0-beta.1

# Write pre-release notes to tmp/release-note.md, then create GitHub pre-release
gh release create v1.2.0-beta.1 \
  --title "Version 1.2.0 Beta 1" \
  -F tmp/release-note.md \
  --prerelease

# Clean up
rm tmp/release-note.md
````

**Pre-release naming:**

- `v1.2.0-alpha.1` - Alpha release (early testing)
- `v1.2.0-beta.1` - Beta release (feature complete, testing)
- `v1.2.0-rc.1` - Release candidate (final testing)

## Release Checklist

Before creating a release:

- [ ] All tests pass locally
- [ ] Code builds without errors
- [ ] All related issues are closed
- [ ] Documentation is updated
- [ ] CHANGELOG.md is updated (if applicable)
- [ ] Version number follows SemVer rules
- [ ] Release notes written to `tmp/release-note.md`
- [ ] Release notes include ALL changes since last release
- [ ] Breaking changes are clearly documented
- [ ] Migration guide provided (for MAJOR releases)
- [ ] `tmp/release-note.md` cleaned up after release creation

## Common Release Scenarios

### Scenario 1: Bug Fix Release

```bash
# Current version: v1.2.3
# Fixed 2 bugs, no new features

# Increment PATCH: v1.2.3 → v1.2.4
git tag -a v1.2.4 -m "Release version 1.2.4"
git push origin v1.2.4

# Write release notes to tmp/release-note.md:
# ## 🐛 Bug Fixes
# - Fix transaction calculation bug (fixes #123)
# - Fix date picker timezone issue (fixes #124)

gh release create v1.2.4 \
  --title "Version 1.2.4 - Bug Fixes" \
  -F tmp/release-note.md

rm tmp/release-note.md
```

### Scenario 2: Feature Release

```bash
# Current version: v1.2.4
# Added budget tracking feature

# Increment MINOR: v1.2.4 → v1.3.0
git tag -a v1.3.0 -m "Release version 1.3.0"
git push origin v1.3.0

# Write release notes to tmp/release-note.md:
# ## 🎉 New Features
# - Add budget tracking with monthly limits (closes #45)
# - Add budget progress visualization (closes #46)
#
# ## 🐛 Bug Fixes
# - Fix account balance display (fixes #130)

gh release create v1.3.0 \
  --title "Version 1.3.0 - Budget Tracking" \
  -F tmp/release-note.md

rm tmp/release-note.md
```

### Scenario 3: Breaking Change Release

```bash
# Current version: v1.3.5
# Complete API redesign

# Increment MAJOR: v1.3.5 → v2.0.0
git tag -a v2.0.0 -m "Release version 2.0.0"
git push origin v2.0.0

# Write release notes to tmp/release-note.md:
# ## 💥 Breaking Changes
# - Complete API redesign with new endpoint structure
# - Authentication now required for all endpoints
# - See migration guide: docs/migration-v2.md
#
# ## 🎉 New Features
# - Add GraphQL API support
# - Add real-time updates via WebSocket
#
# ## Migration Guide
# [Link to detailed migration guide]

gh release create v2.0.0 \
  --title "Version 2.0.0 - Major API Redesign" \
  -F tmp/release-note.md

rm tmp/release-note.md
```

## Managing Releases

### View Releases

```bash
# List all releases
gh release list

# View specific release
gh release view v1.2.3

# List all tags
git tag -l

# View tag details
git show v1.2.3
```

### Delete/Edit Releases

```bash
# Delete a release (keeps the tag)
gh release delete v1.2.3

# Delete a tag locally
git tag -d v1.2.3

# Delete a tag remotely
git push origin --delete v1.2.3

# Edit a release (write updated notes to tmp/release-note.md first)
gh release edit v1.2.3 --notes-file tmp/release-note.md
rm tmp/release-note.md
```

## Summary

**Golden Rules:**

1. ✅ Follow SemVer: MAJOR.MINOR.PATCH
2. ✅ PATCH for bug fixes and minor changes
3. ✅ MINOR for new features (backward compatible)
4. ✅ MAJOR for breaking changes
5. ✅ Include ALL changes in release notes
6. ✅ Document breaking changes with migration guides
7. ✅ Test thoroughly before releasing
8. ✅ Use annotated tags with descriptive messages
9. ✅ Always write release notes to `tmp/release-note.md` and use `-F` / `--notes-file`

**Quick Reference:**

```bash
# Bug fix release (PATCH)
git tag -a v1.0.1 -m "Release version 1.0.1"
git push origin v1.0.1
# Write release notes to tmp/release-note.md first
gh release create v1.0.1 --title "Version 1.0.1 - Bug Fixes" -F tmp/release-note.md
rm tmp/release-note.md

# Feature release (MINOR)
git tag -a v1.1.0 -m "Release version 1.1.0"
git push origin v1.1.0
# Write release notes to tmp/release-note.md first
gh release create v1.1.0 --title "Version 1.1.0 - New Features" -F tmp/release-note.md
rm tmp/release-note.md

# Breaking change release (MAJOR)
git tag -a v2.0.0 -m "Release version 2.0.0"
git push origin v2.0.0
# Write release notes to tmp/release-note.md first
gh release create v2.0.0 --title "Version 2.0.0 - Major Update" -F tmp/release-note.md
rm tmp/release-note.md
```

---

_Following these release rules ensures clear version history, proper change documentation, and smooth upgrades for users._
