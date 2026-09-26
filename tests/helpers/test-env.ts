/**
 * Environment variables required by the app's validation (src/lib/env.ts).
 * Import this module BEFORE any application module in a test file: ESM
 * evaluates imports in order, so placing `import './helpers/test-env'` first
 * guarantees the variables exist before anything calls `requireEnv`.
 *
 * The values are inert: no test sends real email (sendShopOrderNotification is
 * mocked at the module boundary) and no test performs network requests.
 */
const TEST_ENV: Record<string, string> = {
  PAYLOAD_SECRET: 'cvlt-test-payload-secret',
  DATABASE_URI: 'file:./.tmp/test-payload.db',
  NEXT_PUBLIC_SERVER_URL: 'https://cvlt.ch',
  SMTP_USER: 'cvlt-test-smtp-user',
  SMTP_PASS: 'cvlt-test-smtp-pass',
  SMTP_FROM: 'test-sender@cvlt.ch',
  MEMBERSHIP_EMAIL: 'membership@cvlt.ch',
  SHOP_EMAIL: 'shop@cvlt.ch',
  CONTACT_EMAIL: 'contact@cvlt.ch',
  SHOP_PAYLINK_URL: 'https://pay.raisenow.io/cvlt-shop-checkout',
  SHOP_ORDER_TOKEN_SECRET: 'cvlt-test-shop-order-token-secret',
}

for (const [key, value] of Object.entries(TEST_ENV)) {
  if (!process.env[key]) process.env[key] = value
}
