# Cashfree fee payments

## Environment

Copy the Cashfree entries from `.env.example` into the backend environment. Keep the client secret on the backend only.

```text
CASHFREE_ENVIRONMENT=sandbox
CASHFREE_CLIENT_ID=...
CASHFREE_CLIENT_SECRET=...
CASHFREE_API_VERSION=2025-01-01
FRONTEND_URL=https://app.example.com
BACKEND_PUBLIC_URL=https://api.example.com
CORS_ORIGIN=https://app.example.com
```

Student records must have an email and phone in `StudentProfile`, or the fallback contact values must be configured. Cashfree requires a customer phone for hosted checkout.

## Database

The application may use Supabase’s transaction pooler on port `6543`, while Prisma migrations need a session/direct connection on port `5432`. If the direct host (`db.<project-ref>.supabase.co`) is unreachable, use Supabase Dashboard → Connect → Session pooler and set `DIRECT_URL` to the session-pooler URL on port `5432`. Keep `DATABASE_URL` on the application pooler URL.

Deploy the migration from the backend directory:

```bash
npx prisma migrate deploy
npx prisma generate
```

## Cashfree dashboard

In Payment Gateway → Developers → Webhooks, register:

```text
https://api.example.com/api/v1/payments/cashfree/webhook

## Production URL requirement

When `CASHFREE_ENVIRONMENT=production`, both public URLs must use HTTPS. Do not leave either variable unset or use localhost:

```env
CASHFREE_ENVIRONMENT=production
FRONTEND_URL=https://next.radora.tech
BACKEND_PUBLIC_URL=https://<your-public-backend-domain>
```

Restart the backend after changing `.env`. `FRONTEND_URL` is used for Cashfree's student return URL and `BACKEND_PUBLIC_URL` is used for the signed Cashfree webhook URL. If the backend is running locally, use an HTTPS tunnel such as a configured ngrok/Cloudflare Tunnel URL for testing; Cashfree production cannot redirect to `http://localhost`.
```

Enable payment success, payment failed, and user-dropped events. The webhook must be publicly reachable over HTTPS. The application verifies `x-webhook-signature` against the raw request body and rejects stale or invalid requests.

## Flow

1. Admin issues an invoice from `/fees`.
2. The student opens `/student-fees` and starts hosted checkout.
3. The backend creates the Cashfree order and stores the payment session without exposing credentials.
4. The webhook and the server-side order-status check both reconcile the payment idempotently.
5. The invoice, payment, receipt, and accounting journal are committed together in one database transaction.
6. The student can view or download the generated PDF receipt.

Test the complete flow in `sandbox` before switching to `production` and registering the production webhook URL.
