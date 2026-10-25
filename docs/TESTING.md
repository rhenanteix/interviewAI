# Testing with npm

Requirements: Node.js 22+, npm 10+.

1. `npm install` in repository root.
2. `cp .env.example .env` (set JWT_SECRET to a random secret; `DATA_FILE=./data/local.json`).
3. `npm run dev` then open http://localhost:5173 and http://localhost:3001/docs.
4. `npm test`, `npm run typecheck`, `npm run build`.
5. Swagger: POST `/api/v1/auth/register` with email/name/password (10+ characters). Copy `accessToken`. In Swagger Authorize, paste the token (if security configured) or use curl header `Authorization: Bearer TOKEN`.
6. GET `/api/v1/me`; POST `/api/v1/profiles`; GET `/api/v1/profiles`; POST multipart `/api/v1/documents` with TXT/PDF/DOCX; POST `/api/v1/retrieve` with `{"query":"typescript"}`; POST `/api/v1/sessions`; GET `/api/v1/export`; DELETE account only in disposable test user.
7. Test `/api/v1/billing/checkout` without Stripe key: response must explicitly be mock. With a Stripe test key and valid test price ID, verify redirect in Stripe test mode. No webhook fulfillment is implemented.
8. Test `/api/v1/capabilities`: verify mock/real flags. Browser live mode is text-based; binary audio is not supported by current WebSocket.
9. Electron: `npm run dev --workspace @copilot/desktop` after starting web. Desktop screen capture depends on OS permissions.
10. Chrome extension: chrome://extensions → Developer mode → Load unpacked → apps/extension. Capture permission only; it does not stream audio yet.

Do not use this build with real confidential meetings or customer data: auth lacks hardening, local JSON is not encrypted, and the service is not production-ready.
