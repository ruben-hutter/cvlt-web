/**
 * Deterministic environment for route-level tests. Loaded before every test
 * file via test.setupFiles in vitest.config.ts; values are forced (not merged)
 * so a developer's shell environment can't leak into test runs. Importing this
 * module directly at the top of a test file also works: ESM evaluates imports
 * in order, so the variables exist before anything calls `requireEnv`.
 *
 * The values are inert: no test sends real email (sendShopOrderNotification is
 * mocked at the module boundary) and no test performs real network requests.
 */
const TEST_ENV: Record<string, string> = {
  PAYLOAD_SECRET: 'cvlt-test-payload-secret',
  // IMPORTANT: this URI is only used by boots of the REAL src/payload.config.ts
  // (webhook tests), which rm this file before booting. It must stay DIFFERENT
  // from tests/helpers/test-payload.ts's own './.tmp/test-payload.db': the
  // full config deadlocks in schema push when pointed at a DB created with
  // the helper's reduced schema (and vice versa).
  DATABASE_URI: 'file:./.tmp/test-webhook-config.db',
  NEXT_PUBLIC_SERVER_URL: 'https://cvlt.ch',
  SMTP_USER: 'cvlt-test-smtp-user',
  SMTP_PASS: 'cvlt-test-smtp-pass',
  SMTP_FROM: 'test-sender@cvlt.ch',
  MEMBERSHIP_EMAIL: 'membership@cvlt.ch',
  SHOP_EMAIL: 'shop@cvlt.ch',
  CONTACT_EMAIL: 'contact@cvlt.ch',
  SHOP_PAYLINK_URL: 'https://pay.raisenow.io/cvlt-shop-checkout',
  SHOP_ORDER_TOKEN_SECRET: 'cvlt-test-shop-order-token-secret',
  SHOP_WEBHOOK_SECRET: 'test-webhook-secret',
}

for (const [key, value] of Object.entries(TEST_ENV)) {
  process.env[key] = value
}
