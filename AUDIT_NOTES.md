# CafeFlow audit notes

## Improvements applied
- Removed the development fallback for session signing; the server now refuses placeholder/weak session secrets and admin passwords.
- Enabled a Content Security Policy and Helmet security headers.
- Added same-origin checks for state-changing requests.
- Added in-memory limits for admin sign-in and customer order creation.
- Regenerates the session ID after successful login and invalidates it on logout.
- Keeps admin API responses out of caches.
- Validates menu prices, categories, IDs, and HTTPS image URLs on the server.
- Uses server-side database prices and transaction-based order + line-item creation.
- Restricts order status changes to a valid workflow and checks for concurrent updates.
- Added safer image fallback handling without inline JavaScript event attributes.
- Updated setup instructions to require unique local secrets.

## Verification performed here
- Node.js syntax checks passed for `server.js`, `public/js/app.js`, and `public/js/admin.js`.
- Both HTML files passed a parser check.
- Static assertions passed for the security and transaction safeguards listed above.

## Not verified in this environment
The full runtime integration was not executed because dependency installation did not complete within the available execution window and no live MySQL instance was available. Before pushing, run `npm install`, import `db/schema.sql`, configure `.env`, start MySQL, run `npm start`, and test menu loading, checkout, admin login, menu CRUD, and order status changes locally.

This remains a portfolio/demo starter, not a production-ready payment platform. Use a persistent session store, HTTPS, production database permissions, monitoring, backups, and deployment-specific CSRF/rate-limit controls before a public launch.
