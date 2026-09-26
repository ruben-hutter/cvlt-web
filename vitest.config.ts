import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      // Route handlers import the payload config via the '@payload-config'
      // alias (same as tsconfig.json); tests boot the real config through the
      // same alias so route code and test code share one Payload instance.
      '@payload-config': path.resolve(rootDir, 'src/payload.config.ts'),
      '@': path.resolve(rootDir, 'src'),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    fileParallelism: false,
    setupFiles: ['tests/helpers/test-env.ts'],
    // Booting the real Payload config (route-level tests) comfortably exceeds
    // vitest's 10s defaults on modest hardware.
    hookTimeout: 60_000,
    testTimeout: 30_000,
  },
})
