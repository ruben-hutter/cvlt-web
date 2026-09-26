import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      // Route handlers import the payload config via the '@payload-config'
      // alias (same as tsconfig.json); tests boot the real config through the
      // same alias so route code and test code share one Payload instance.
      '@payload-config': fileURLToPath(new URL('./src/payload.config.ts', import.meta.url)),
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    fileParallelism: false,
    setupFiles: ['tests/helpers/test-env.ts'],
  },
})
