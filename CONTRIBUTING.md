# Contributing to Master of Coin

Thank you for your interest in contributing to Master of Coin! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Commit Convention](#commit-convention)
- [Pull Request Process](#pull-request-process)
- [Testing Guidelines](#testing-guidelines)

## Code of Conduct

We are committed to providing a welcoming and inclusive environment for all contributors. Please be respectful and professional in all interactions.

## Getting Started

### Prerequisites

- Rust 1.75+
- Node.js 18+ LTS
- PostgreSQL 16
- Docker Desktop

### Setup Development Environment

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/master-of-coin.git
   cd master-of-coin
   ```

2. Copy environment variables:
   ```bash
   cp .env.example .env
   ```

3. Install dependencies:
   ```bash
   # Backend
   cd backend
   cargo build
   
   # Frontend
   cd ../frontend
   npm install
   ```

4. Start development services:
   ```bash
   docker-compose up -d
   ```

## Development Workflow

### Branch Strategy

- `main` - Production-ready code
- `develop` - Integration branch for features
- `feature/*` - New features
- `bugfix/*` - Bug fixes
- `hotfix/*` - Urgent production fixes

### Creating a Feature Branch

```bash
git checkout develop
git pull origin develop
git checkout -b feature/your-feature-name
```

## Coding Standards

### Rust (Backend)

- Follow Rust naming conventions
- Use `rustfmt` for code formatting
- Run `clippy` for linting: `cargo clippy`
- Write documentation comments for public APIs
- Keep functions focused and small
- Use meaningful variable names

Example:
```rust
/// Calculates the total balance for a user
pub async fn calculate_total_balance(user_id: Uuid) -> Result<Decimal, Error> {
    // Implementation
}
```

### TypeScript/React (Frontend)

- Use TypeScript for all new code
- Follow React best practices and hooks patterns
- Use functional components
- Keep components small and focused
- Use meaningful component and variable names
- Write JSDoc comments for complex functions

Example:
```typescript
/**
 * Formats a currency amount for display
 * @param amount - The amount to format
 * @param currency - The currency code (default: USD)
 */
export function formatCurrency(amount: number, currency = 'USD'): string {
  // Implementation
}
```

### General Guidelines

- Write self-documenting code
- Add comments for complex logic
- Keep files under 300 lines when possible
- Use consistent indentation (2 spaces for TS/JS, 4 spaces for Rust)
- Remove unused imports and variables
- Avoid deeply nested code

## Commit Convention

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, missing semicolons, etc.)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Maintenance tasks, dependency updates
- `ci`: CI/CD changes

### Examples

```bash
feat(auth): add JWT token refresh endpoint

Implements automatic token refresh to improve user experience
and reduce authentication errors.

Closes #123
```

```bash
fix(transactions): correct balance calculation for split transactions

The previous implementation didn't account for partial amounts
in split transactions, leading to incorrect balances.
```

## Pull Request Process

1. **Update your branch** with the latest changes from `develop`:
   ```bash
   git checkout develop
   git pull origin develop
   git checkout your-branch
   git rebase develop
   ```

2. **Run tests** and ensure they pass:
   ```bash
   # Backend
   cd backend
   cargo test
   cargo clippy
   
   # Frontend
   cd frontend
   npm run test
   npm run lint
   ```

3. **Create a pull request** with:
   - Clear title following commit convention
   - Description of changes
   - Screenshots for UI changes
   - Reference to related issues

4. **Code review**:
   - Address reviewer feedback
   - Keep discussions professional and constructive
   - Make requested changes in new commits

5. **Merge**:
   - Squash commits if requested
   - Ensure CI/CD passes
   - Delete branch after merge

## Testing Guidelines

### Backend Tests

- Write unit tests for business logic
- Write integration tests for API endpoints
- Use test fixtures for database tests
- Mock external dependencies

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_calculate_balance() {
        // Test implementation
    }
}
```

### Frontend Tests

- Write unit tests for utility functions
- Write component tests using React Testing Library
- Test user interactions and edge cases
- Mock API calls

```typescript
describe('formatCurrency', () => {
  it('formats USD correctly', () => {
    expect(formatCurrency(1234.56)).toBe('$1,234.56');
  });
});
```

## Questions?

If you have questions or need help, please:
- Open an issue for bugs or feature requests
- Start a discussion for general questions
- Reach out to maintainers

Thank you for contributing to Master of Coin! 🎉