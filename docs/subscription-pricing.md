# Subscription pricing

The public catalog lives in `shared/subscriptionPlans.ts`. Landing, Pricing, Premium upgrades, and the server checkout allowlist use these same four live Stripe Price IDs. To change a price, create the recurring price in the RealtorsDashboard Stripe account, then update its ID and displayed amount together and deploy. Existing subscriptions retain their Stripe prices.

The production account is `acct_1SuatK2MffYVRFnw`. `STRIPE_SECRET_KEY` must remain an active live key for this account; fixed pricing removes catalog lookups but Stripe still creates checkout sessions, handles subscriptions and fulfills webhooks. Rotate this secret in the Cloudflare Worker settings when necessary. Never commit API keys.

`/api/products` and the legacy `/api/stripe/products` alias return the fixed public catalog without contacting Stripe. Trial duration remains 14 days. Checkout accepts only the configured Price IDs and sends no client-supplied amount to Stripe.

Run `npm run test:stripe`, `npm run check`, and `npm run build` before deploying a pricing change. Verify the displayed amounts against Stripe and open a checkout session without completing payment.
