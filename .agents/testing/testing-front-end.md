# Frontend Testing Guidelines

## 🚨 NON-NEGOTIABLE REQUIREMENT

**ALL UI changes MUST be tested in a browser before committing.**

This is not optional. Any changes to the user interface, components, styling, or frontend functionality must be verified in an actual browser environment to ensure they work as expected.

## 🐳 Testing with Docker

### Prerequisites

- Docker and Docker Compose installed
- Project repository cloned locally

### Testing Workflow

1. **Stop any running containers:**

   ```bash
   docker-compose down
   ```

2. **Rebuild the containers with your changes:**

   ```bash
   docker-compose build
   ```

3. **Start the application:**

   ```bash
   docker-compose up
   ```

4. **Access the application:**
   - Open your browser
   - Navigate to `http://localhost:13153`

5. **Login with test credentials:**
   - **Email:** `test@local.com`
   - **Password:** `test@password`

### What to Test

When testing UI changes, verify:

- ✅ **Visual Appearance:** Does the UI look correct across different screen sizes?
- ✅ **Functionality:** Do all interactive elements work as expected?
- ✅ **Navigation:** Can users navigate between pages without issues?
- ✅ **Forms:** Do forms submit correctly and show appropriate validation?
- ✅ **Data Display:** Is data rendered correctly from the backend?
- ✅ **Error Handling:** Are errors displayed appropriately to users?
- ✅ **Responsive Design:** Does the UI work on mobile, tablet, and desktop viewports?
- ✅ **Browser Console:** Are there any JavaScript errors or warnings?
- ✅ **Network Tab:** Are API calls succeeding and returning expected data?

### Browser Testing Checklist

Before committing frontend changes:

- [ ] Docker containers rebuilt with latest changes
- [ ] Application starts without errors
- [ ] Successfully logged in with test credentials
- [ ] All modified components/pages tested manually
- [ ] Tested on at least one modern browser (Chrome, Firefox, Safari, or Edge)
- [ ] No console errors or warnings
- [ ] All interactive features work as expected
- [ ] Responsive design verified (if applicable)
- [ ] Cross-browser compatibility checked (if significant changes)

## 🔄 Quick Test Cycle

For rapid iteration during development:

```bash
# One-liner to restart with fresh build
docker-compose down && docker-compose build && docker-compose up
```

## 📝 Notes

- The test account credentials are hardcoded for local development testing
- Always test with a clean browser session or incognito mode to avoid cache issues
- Document any browser-specific issues you encounter
- The application runs on port 13153 in the Docker environment

## ⚠️ Remember

**No UI changes should be committed without browser testing. This ensures quality and prevents broken user experiences from reaching the codebase.**
