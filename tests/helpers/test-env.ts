// Deterministic environment for route-level tests. Loaded before every test
// file via test.setupFiles in vitest.config.ts. Values are forced (not merged)
// so a developer's shell environment can't leak into test runs.
const TEST_ENV: Record<string, string> = {
  PAYLOAD_SECRET: 'cvlt-test-secret-not-for-prod',
  DATABASE_URI: 'file:./.tmp/test-webhook-config.db',
  NEXT_PUBLIC_SERVER_URL: 'http://localhost:3000',
  SMTP_USER: 'test-smtp-user',
  SMTP_PASS: 'test-smtp-pass',
  SMTP_FROM: 'test-from@cvlt.ch',
  MEMBERSHIP_EMAIL: 'membership@test.cvlt.ch',
  SHOP_EMAIL: 'shop@test.cvlt.ch',
  CONTACT_EMAIL: 'contact@test.cvlt.ch',
  SHOP_PAYLINK_URL: 'https://pay.raisenow.io/test-link',
  SHOP_ORDER_TOKEN_SECRET: 'test-order-token-secret',
  SHOP_WEBHOOK_SECRET: 'test-webhook-secret',
}

for (const [key, value] of Object.entries(TEST_ENV)) {
  process.env[key] = value
}
